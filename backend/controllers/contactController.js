import fs from "fs";
import { promises as dnsPromises } from "dns";

import { processEmailCsv } from "../utils/emailCsvProcessor.js";
import {
  isDisposableDomain,
  loadDisposableDomainsFromFile,
} from "../utils/disposableDomainService.js";
import { queryDb } from "../utils/db.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_STATUSES = new Set(["active", "unsubscribed", "bounced"]);

const normalizeContactPayload = (payload) => {
  const contact_name = payload.contact_name?.trim();
  const contact_email = payload.contact_email?.trim().toLowerCase();
  const requestedStatus = payload.contact_status?.trim().toLowerCase();

  return {
    contact_name,
    contact_email,
    contact_status: VALID_STATUSES.has(requestedStatus)
      ? requestedStatus
      : "active",
  };
};

const validateContactPayload = ({ contact_name, contact_email }) => {
  if (!contact_name || !contact_email) {
    return "Name and email are required";
  }

  if (!EMAIL_PATTERN.test(contact_email)) {
    return "Enter a valid email address";
  }

  return null;
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

const verifyEmailDomainRules = async (email) => {
  const domain = email.split("@")[1];
  if (!domain) {
    return "Invalid email format";
  }

  await loadDisposableDomainsFromFile();

  if (isDisposableDomain(domain)) {
    return "Disposable email domain";
  }

  try {
    const records = await dnsPromises.resolveMx(domain);
    const mxValidationError = getMxValidationError(domain, records);
    if (mxValidationError) {
      return mxValidationError;
    }
  } catch {
    return "MX lookup failed";
  }

  return null;
};

const getAllContacts = async (req, res) => {
  try {
    const data = await queryDb(
      `SELECT c.contact_id, c.contact_name, c.contact_email, c.contact_status,
              c.created_at, c.updated_at, u.user_name AS created_by_name
       FROM contacts c
       LEFT JOIN users u ON u.user_id = c.created_by
       ORDER BY c.created_at DESC`,
    );

    return res.json(data);
  } catch (err) {
    console.error("Error fetching contacts:", err);
    return res.status(500).json({ error: "Failed to fetch contacts" });
  }
};

const addContact = async (req, res) => {
  const payload = normalizeContactPayload(req.body);
  const verify = parseVerifyFlag(req.body?.verify);
  const validationMessage = validateContactPayload(payload);

  if (validationMessage) {
    return res.status(400).json({ error: validationMessage });
  }

  if (verify) {
    const verificationError = await verifyEmailDomainRules(
      payload.contact_email,
    );
    if (verificationError) {
      return res.status(400).json({ error: verificationError });
    }
  }

  try {
    const result = await queryDb(
      `INSERT INTO contacts (contact_name, contact_email, contact_status, created_by)
       VALUES (?, ?, ?, ?)`,
      [
        payload.contact_name,
        payload.contact_email,
        payload.contact_status,
        req.user.userId,
      ],
    );

    return res.status(201).json({
      message: "Contact added successfully",
      id: result.insertId,
    });
  } catch (err) {
    console.error("Error adding contact:", err);

    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Contact email already exists" });
    }

    return res.status(500).json({ error: "Failed to add contact" });
  }
};

const updateContact = async (req, res) => {
  const { id } = req.params;
  const payload = normalizeContactPayload(req.body);
  const validationMessage = validateContactPayload(payload);

  if (validationMessage) {
    return res.status(400).json({ error: validationMessage });
  }

  try {
    const result = await queryDb(
      `UPDATE contacts
       SET contact_name = ?, contact_email = ?, contact_status = ?
       WHERE contact_id = ?`,
      [payload.contact_name, payload.contact_email, payload.contact_status, id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Contact not found" });
    }

    return res.json({ message: "Contact updated successfully" });
  } catch (err) {
    console.error("Error updating contact:", err);

    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Contact email already exists" });
    }

    return res.status(500).json({ error: "Failed to update contact" });
  }
};

const deleteContact = async (req, res) => {
  const { id } = req.params;

  try {
    const contactRows = await queryDb(
      `SELECT contact_id, contact_name, contact_email
       FROM contacts
       WHERE contact_id = ?
       LIMIT 1`,
      [id],
    );

    if (contactRows.length === 0) {
      return res.status(404).json({ error: "Contact not found" });
    }

    const contact = contactRows[0];
    const recipientName =
      contact.contact_name || toDisplayNameFromEmail(contact.contact_email);
    const recipientEmail = String(contact.contact_email || "")
      .trim()
      .toLowerCase();
    const recipientInitials = (() => {
      const nameTokens = String(recipientName)
        .trim()
        .split(/\s+/)
        .filter(Boolean);

      if (nameTokens.length >= 2) {
        return `${(nameTokens[0][0] || "").toUpperCase()}${(nameTokens[nameTokens.length - 1][0] || "").toUpperCase()}`;
      }

      if (nameTokens.length === 1 && nameTokens[0].length >= 2) {
        return nameTokens[0].slice(0, 2).toUpperCase();
      }

      const localPart = recipientEmail.split("@")[0] || "";
      return localPart.slice(0, 2).toUpperCase() || "NA";
    })();

    await queryDb(
      `CREATE TABLE IF NOT EXISTS campaign_recipient_snapshots (
         snapshot_id INT PRIMARY KEY AUTO_INCREMENT,
         campaign_id INT NOT NULL,
         contact_id INT NULL,
         recipient_name VARCHAR(255) NULL,
         recipient_email VARCHAR(255) NOT NULL,
         recipient_initials VARCHAR(10) NULL,
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
         FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
         UNIQUE KEY unique_campaign_recipient_email (campaign_id, recipient_email),
         INDEX idx_campaign_snapshot_campaign (campaign_id),
         INDEX idx_campaign_snapshot_email (recipient_email)
       )`,
    );

    await queryDb(
      `INSERT INTO campaign_recipient_snapshots (
         campaign_id,
         contact_id,
         recipient_name,
         recipient_email,
         recipient_initials
       )
       SELECT
         ce.campaign_id,
         ce.contact_id,
         ?,
         ?,
         ?
       FROM campaign_emails ce
       INNER JOIN campaigns c ON c.campaign_id = ce.campaign_id
       WHERE ce.contact_id = ?
         AND c.campaign_status = 'sent'
       ON DUPLICATE KEY UPDATE
         contact_id = COALESCE(campaign_recipient_snapshots.contact_id, VALUES(contact_id)),
         recipient_name = COALESCE(
           NULLIF(campaign_recipient_snapshots.recipient_name, ''),
           VALUES(recipient_name)
         ),
         recipient_initials = COALESCE(
           NULLIF(campaign_recipient_snapshots.recipient_initials, ''),
           VALUES(recipient_initials)
         )`,
      [recipientName, recipientEmail, recipientInitials, contact.contact_id],
    );

    const result = await queryDb("DELETE FROM contacts WHERE contact_id = ?", [
      id,
    ]);

    return res.json({ message: "Contact deleted successfully" });
  } catch (err) {
    console.error("Error deleting contact:", err);
    return res.status(500).json({ error: "Failed to delete contact" });
  }
};

const toDisplayNameFromEmail = (email) => {
  const localPart = email.split("@")[0] || "subscriber";
  return localPart
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 255);
};

const parseVerifyFlag = (value) => {
  if (value === undefined || value === null || value === "") {
    return false;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) {
      return true;
    }

    if (["false", "0", "no", "off"].includes(normalized)) {
      return false;
    }

    return false;
  }

  return false;
};

const chunkArray = (items, size) => {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

const findExistingContactEmails = async (emails, batchSize = 500) => {
  if (!emails.length) {
    return new Set();
  }

  const existingEmailSet = new Set();
  const batches = chunkArray(emails, batchSize);

  for (const batch of batches) {
    const placeholders = batch.map(() => "?").join(", ");
    const rows = await queryDb(
      `SELECT contact_email FROM contacts WHERE contact_email IN (${placeholders})`,
      batch,
    );

    rows.forEach((row) => {
      existingEmailSet.add(String(row.contact_email).toLowerCase());
    });
  }

  return existingEmailSet;
};

const uploadCSV = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const filePath = req.file.path;
  const verify = parseVerifyFlag(req.body?.verify);
  const requestedGroupId = req.body?.groupId;
  const newGroupName = req.body?.newGroupName?.trim();

  try {
    const { validEmails, validRows, rejectedEmails } = await processEmailCsv({
      filePath,
      verify,
      emailColumn: "email",
      mxBatchSize: 25,
    });

    const existingEmailSet = await findExistingContactEmails(validEmails);
    const rowsToInsert = [];

    validRows.forEach((row) => {
      if (!existingEmailSet.has(row.contact_email)) {
        rowsToInsert.push(row);
      }
    });

    // 1. Insert NEW contacts into contacts table
    if (rowsToInsert.length > 0) {
      const values = rowsToInsert.map((row) => [
        row.contact_name || toDisplayNameFromEmail(row.contact_email),
        row.contact_email,
        "active",
        req.user.userId,
      ]);

      await queryDb(
        "INSERT IGNORE INTO contacts (contact_name, contact_email, contact_status, created_by) VALUES ?",
        [values],
      );
    }

    // 2. Resolve Group ID
    let finalGroupId = requestedGroupId;
    if (newGroupName) {
      const groupResult = await queryDb(
        "INSERT INTO contact_groups (group_name, created_by) VALUES (?, ?) ON DUPLICATE KEY UPDATE group_id=LAST_INSERT_ID(group_id)",
        [newGroupName, req.user.userId],
      );
      finalGroupId = groupResult.insertId;
    }

    // 3. Assign ALL valid contacts from CSV to the group
    if (finalGroupId && validEmails.length > 0) {
      const contactRows = await queryDb(
        "SELECT contact_id FROM contacts WHERE contact_email IN (?)",
        [validEmails],
      );

      if (contactRows.length > 0) {
        const groupValues = contactRows.map((row) => [
          finalGroupId,
          row.contact_id,
          req.user.userId,
        ]);

        await queryDb(
          "INSERT IGNORE INTO contact_group_members (group_id, contact_id, added_by) VALUES ?",
          [groupValues],
        );
      }
    }

    return res.json({
      message: `Processed ${validEmails.length} contacts successfully`,
      verify,
      newlyAdded: rowsToInsert.length,
      groupId: finalGroupId,
      validEmails: validEmails,
      rejectedEmails,
    });
  } catch (err) {
    console.error("Error parsing CSV:", err);
    return res.status(500).json({ message: "Error parsing CSV file" });
  } finally {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
};

export default {
  getAllContacts,
  addContact,
  updateContact,
  deleteContact,
  uploadCSV,
};
