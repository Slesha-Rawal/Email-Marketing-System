import db from "../config/dbConnect.js";
import fs from "fs";
import csv from "csv-parser";
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

const mapColumnName = (column) => {
  const columnMap = {
    name: "contact_name",
    "full name": "contact_name",
    "contact name": "contact_name",
    email: "contact_email",
    "email address": "contact_email",
    "e-mail": "contact_email",
    status: "contact_status",
  };

  const normalized = column.toLowerCase().trim();
  return columnMap[normalized] || column;
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
  const validationMessage = validateContactPayload(payload);

  if (validationMessage) {
    return res.status(400).json({ error: validationMessage });
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
    const result = await queryDb("DELETE FROM contacts WHERE contact_id = ?", [
      id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Contact not found" });
    }

    return res.json({ message: "Contact deleted successfully" });
  } catch (err) {
    console.error("Error deleting contact:", err);
    return res.status(500).json({ error: "Failed to delete contact" });
  }
};

const uploadCSV = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const results = [];
  const filePath = req.file.path;

  fs.createReadStream(filePath)
    .pipe(csv())
    .on("data", (data) => {
      const mappedData = {};
      Object.keys(data).forEach((key) => {
        const mappedKey = mapColumnName(key);
        mappedData[mappedKey] = data[key];
      });

      const payload = normalizeContactPayload(mappedData);
      if (payload.contact_name && payload.contact_email) {
        results.push({
          contact_name: payload.contact_name,
          contact_email: payload.contact_email,
          contact_status: payload.contact_status,
        });
      }
    })
    .on("end", () => {
      fs.unlinkSync(filePath);

      if (results.length === 0) {
        return res.status(400).json({
          message:
            "No valid contacts found in CSV. Make sure the file has Name and Email columns.",
        });
      }

      const query =
        "INSERT IGNORE INTO contacts (contact_name, contact_email, contact_status, created_by) VALUES ?";
      const values = results.map((contact) => [
        contact.contact_name,
        contact.contact_email,
        contact.contact_status,
        req.user.userId,
      ]);

      db.query(query, [values], (err, result) => {
        if (err) {
          console.error("Error inserting contacts:", err);
          return res.status(500).json({ message: "Error uploading contacts" });
        }

        return res.json({
          message: `Imported ${result.affectedRows} contacts successfully`,
          count: result.affectedRows,
          skipped: results.length - result.affectedRows,
        });
      });
    })
    .on("error", (err) => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      console.error("Error parsing CSV:", err);
      return res.status(500).json({ message: "Error parsing CSV file" });
    });
};

export default {
  getAllContacts,
  addContact,
  updateContact,
  deleteContact,
  uploadCSV,
};
