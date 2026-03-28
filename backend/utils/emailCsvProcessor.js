import fs from "fs";
import { promises as dnsPromises } from "dns";
import csv from "csv-parser";
import validator from "validator";
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

  const seenEmailSet = new Set();
  const validRowsNoVerify = [];
  const rejectedEmails = [];
  const mxCandidates = [];
  let parsedRowCount = 0;
  let resolvedEmailColumn = null;
  let resolvedNameColumn = null;

  await new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
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

        const rawEmail = row[resolvedEmailColumn] ?? "";
        const normalizedEmail = normalizeEmail(String(rawEmail || ""));
        const rawName = resolvedNameColumn
          ? (row[resolvedNameColumn] ?? "")
          : "";
        const normalizedName = normalizeName(String(rawName || ""));

        if (!normalizedEmail) {
          rejectedEmails.push({
            email: "",
            reason: "Missing email value",
          });
          return;
        }

        if (!validator.isEmail(normalizedEmail)) {
          rejectedEmails.push({
            email: normalizedEmail,
            reason: "Invalid email format",
          });
          return;
        }

        if (seenEmailSet.has(normalizedEmail)) {
          rejectedEmails.push({
            email: normalizedEmail,
            reason: "Duplicate email",
          });
          return;
        }

        seenEmailSet.add(normalizedEmail);

        if (!verify) {
          validRowsNoVerify.push({
            contact_email: normalizedEmail,
            contact_name: normalizedName,
          });
          return;
        }

        const domain = getDomainFromEmail(normalizedEmail);
        if (!domain) {
          rejectedEmails.push({
            email: normalizedEmail,
            reason: "Invalid email format",
          });
          return;
        }

        if (isDisposableDomain(domain)) {
          rejectedEmails.push({
            email: normalizedEmail,
            reason: "Disposable email domain",
          });
          return;
        }

        mxCandidates.push({
          email: normalizedEmail,
          domain,
          contact_name: normalizedName,
        });
      })
      .on("end", resolve)
      .on("error", reject);
  });

  if (!verify) {
    return {
      validEmails: validRowsNoVerify.map((row) => row.contact_email),
      validRows: validRowsNoVerify,
      rejectedEmails,
      parsedRowCount,
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
    parsedRowCount,
  };
};
