import fs from "fs";
import { promises as dnsPromises } from "dns";
import { Readable } from "stream";
import path from "path";
import csv from "csv-parser";
import iconv from "iconv-lite";
import validator from "validator";
import XLSX from "xlsx";
import {
  isDisposableDomain,
  loadDisposableDomainsFromFile,
} from "./disposableDomainService.js";

const DEFAULT_EMAIL_COLUMN_CANDIDATES = [
  "email",
  "email address",
  "e-mail",
  "contact_email",
  "contact email",
];

const DEFAULT_NAME_COLUMN_CANDIDATES = [
  "name",
  "full name",
  "contact_name",
  "contact name",
];

const normalizeEmail = (value) => value.trim().toLowerCase();

const normalizeName = (value) => value.trim();

const normalizeHeader = (value) => value.trim().toLowerCase();

const decodeCsvBuffer = (buffer) => {
  if (!buffer || buffer.length === 0) {
    return "";
  }

  // UTF-8 BOM
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.toString("utf8").replace(/^\uFEFF/, "");
  }

  // UTF-16 LE BOM
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.toString("utf16le").replace(/^\uFEFF/, "");
  }

  // UTF-16 BE BOM
  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.from(buffer);
    for (let index = 0; index + 1 < swapped.length; index += 2) {
      const temp = swapped[index];
      swapped[index] = swapped[index + 1];
      swapped[index + 1] = temp;
    }
    return swapped.toString("utf16le").replace(/^\uFEFF/, "");
  }

  const utf8Text = buffer.toString("utf8");
  if (!utf8Text.includes("\uFFFD")) {
    return utf8Text.replace(/^\uFEFF/, "");
  }

  const windows1252Text = iconv.decode(buffer, "win1252");
  const windows1251Text = iconv.decode(buffer, "win1251");
  const latin1Text = iconv.decode(buffer, "latin1");

  const scoreDecodedText = (text) => {
    const replacementCount = (text.match(/\uFFFD/g) || []).length;
    const controlCount = (
      text.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g) || []
    ).length;
    const mixedScriptWordCount = (
      text.match(
        /(?:[\p{Script=Latin}]+[\p{Script=Cyrillic}]+|[\p{Script=Cyrillic}]+[\p{Script=Latin}]+)/gu,
      ) || []
    ).length;
    const readableCount = (text.match(/[\p{L}\p{N}\s,.;:@_\-"']/gu) || [])
      .length;
    return (
      readableCount -
      replacementCount * 20 -
      controlCount * 10 -
      mixedScriptWordCount * 30
    );
  };

  const bestText = [windows1252Text, windows1251Text, latin1Text].sort(
    (left, right) => scoreDecodedText(right) - scoreDecodedText(left),
  )[0];

  return bestText.replace(/^\uFEFF/, "");
};

const getDomainFromEmail = (email) => {
  const parts = email.split("@");
  if (parts.length !== 2) {
    return "";
  }

  return parts[1];
};

const normalizeMxExchange = (exchange) =>
  String(exchange || "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");

const getMxValidationError = (domain, records) => {
  if (!records || records.length === 0) {
    return "Domain has no MX records";
  }

  const normalizedDomain = String(domain)
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
  const exchanges = records.map((record) =>
    normalizeMxExchange(record.exchange),
  );

  const hasNullMx = exchanges.some(
    (exchange) => exchange === "" || exchange === ".",
  );
  if (hasNullMx) {
    return "Null MX record (domain does not accept email)";
  }

  const hasNonSelfMx = exchanges.some(
    (exchange) => exchange !== normalizedDomain,
  );
  if (!hasNonSelfMx) {
    return "MX records are self-pointing only";
  }

  return null;
};

const chunkArray = (items, chunkSize) => {
  const chunks = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
};

const resolveEmailColumn = (headers, emailColumn) => {
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));
  const requested = normalizeHeader(emailColumn || "email");

  const directIndex = normalizedHeaders.indexOf(requested);
  if (directIndex !== -1) {
    return headers[directIndex];
  }

  const fallbackIndex = normalizedHeaders.findIndex((header) =>
    DEFAULT_EMAIL_COLUMN_CANDIDATES.includes(header),
  );

  return fallbackIndex === -1 ? null : headers[fallbackIndex];
};

const resolveNameColumn = (headers) => {
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));
  const fallbackIndex = normalizedHeaders.findIndex((header) =>
    DEFAULT_NAME_COLUMN_CANDIDATES.includes(header),
  );

  return fallbackIndex === -1 ? null : headers[fallbackIndex];
};

const parseCsvRows = async (filePath, emailColumn) => {
  const fileBuffer = await fs.promises.readFile(filePath);
  const csvText = decodeCsvBuffer(fileBuffer);
  const rows = [];
  let parsedRowCount = 0;
  let resolvedEmailColumn = null;
  let resolvedNameColumn = null;

  await new Promise((resolve, reject) => {
    Readable.from([csvText])
      .pipe(csv())
      .on("headers", (headers) => {
        resolvedEmailColumn = resolveEmailColumn(headers, emailColumn);
        resolvedNameColumn = resolveNameColumn(headers);

        if (!resolvedEmailColumn) {
          reject(
            new Error(
              `Email column not found. Expected one of: ${[
                emailColumn,
                ...DEFAULT_EMAIL_COLUMN_CANDIDATES,
              ].join(", ")}`,
            ),
          );
        }
      })
      .on("data", (row) => {
        parsedRowCount += 1;

        rows.push({
          email: row[resolvedEmailColumn] ?? "",
          name: resolvedNameColumn ? (row[resolvedNameColumn] ?? "") : "",
        });
      })
      .on("end", resolve)
      .on("error", reject);
  });

  return { rows, parsedRowCount };
};

const parseXlsxRows = async (filePath, emailColumn) => {
  const workbook = XLSX.readFile(filePath, { cellText: true, cellDates: true });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error("Workbook has no sheets");
  }

  const sheet = workbook.Sheets[firstSheetName];
  const jsonRows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  const parsedRowCount = jsonRows.length;
  const headers = Object.keys(jsonRows[0] || {});

  const resolvedEmailColumn = resolveEmailColumn(headers, emailColumn);
  const resolvedNameColumn = resolveNameColumn(headers);

  if (!resolvedEmailColumn) {
    throw new Error(
      `Email column not found. Expected one of: ${[
        emailColumn,
        ...DEFAULT_EMAIL_COLUMN_CANDIDATES,
      ].join(", ")}`,
    );
  }

  const rows = jsonRows.map((row) => ({
    email: row[resolvedEmailColumn] ?? "",
    name: resolvedNameColumn ? (row[resolvedNameColumn] ?? "") : "",
  }));

  return { rows, parsedRowCount };
};

const validateRows = async ({ rows, verify, mxBatchSize }) => {
  const seenEmailSet = new Set();
  const validRowsNoVerify = [];
  const rejectedEmails = [];
  const mxCandidates = [];

  for (const row of rows) {
    const normalizedEmail = normalizeEmail(String(row.email || ""));
    const normalizedName = normalizeName(String(row.name || ""));

    if (!normalizedEmail) {
      rejectedEmails.push({
        email: "",
        reason: "Missing email value",
      });
      continue;
    }

    if (!validator.isEmail(normalizedEmail)) {
      rejectedEmails.push({
        email: normalizedEmail,
        reason: "Invalid email format",
      });
      continue;
    }

    if (seenEmailSet.has(normalizedEmail)) {
      rejectedEmails.push({
        email: normalizedEmail,
        reason: "Duplicate email",
      });
      continue;
    }

    seenEmailSet.add(normalizedEmail);

    if (!verify) {
      validRowsNoVerify.push({
        contact_email: normalizedEmail,
        contact_name: normalizedName,
      });
      continue;
    }

    const domain = getDomainFromEmail(normalizedEmail);
    if (!domain) {
      rejectedEmails.push({
        email: normalizedEmail,
        reason: "Invalid email format",
      });
      continue;
    }

    if (isDisposableDomain(domain)) {
      rejectedEmails.push({
        email: normalizedEmail,
        reason: "Disposable email domain",
      });
      continue;
    }

    mxCandidates.push({
      email: normalizedEmail,
      domain,
      contact_name: normalizedName,
    });
  }

  if (!verify) {
    return {
      validEmails: validRowsNoVerify.map((row) => row.contact_email),
      validRows: validRowsNoVerify,
      rejectedEmails,
    };
  }

  const validRows = await verifyMxRecordsInBatches(
    mxCandidates,
    mxBatchSize,
    rejectedEmails,
  );

  return {
    validEmails: validRows.map((row) => row.contact_email),
    validRows,
    rejectedEmails,
  };
};

const verifyMxRecordsInBatches = async (
  candidates,
  batchSize,
  rejectedEmails,
) => {
  const validRows = [];
  const batches = chunkArray(candidates, batchSize);

  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map(async ({ email, domain, contact_name }) => {
        try {
          const records = await dnsPromises.resolveMx(domain);
          const mxValidationError = getMxValidationError(domain, records);
          if (mxValidationError) {
            return {
              email,
              contact_name,
              valid: false,
              reason: mxValidationError,
            };
          }

          return { email, contact_name, valid: true };
        } catch {
          return {
            email,
            contact_name,
            valid: false,
            reason: "MX lookup failed",
          };
        }
      }),
    );

    batchResults.forEach((result) => {
      if (result.valid) {
        validRows.push({
          contact_email: result.email,
          contact_name: result.contact_name,
        });
        return;
      }

      rejectedEmails.push({ email: result.email, reason: result.reason });
    });
  }

  return validRows;
};

export const processEmailCsv = async ({
  filePath,
  verify = false,
  emailColumn = "email",
  mxBatchSize = 25,
} = {}) => {
  if (!filePath) {
    throw new Error("filePath is required");
  }

  if (mxBatchSize < 1) {
    throw new Error("mxBatchSize must be at least 1");
  }

  if (verify) {
    await loadDisposableDomainsFromFile();
  }

  const extension = path.extname(filePath || "").toLowerCase();
  const parser = extension === ".xlsx" ? parseXlsxRows : parseCsvRows;
  const { rows, parsedRowCount } = await parser(filePath, emailColumn);
  const result = await validateRows({ rows, verify, mxBatchSize });

  return {
    ...result,
    parsedRowCount,
  };
};
