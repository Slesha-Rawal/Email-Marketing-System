import db from "../config/dbConnect.js";
import fs from "fs";
import csv from "csv-parser";

// Helper function to map CSV columns to database columns
const mapColumnName = (column) => {
  const columnMap = {
    name: "contact_name",
    "full name": "contact_name",
    "contact name": "contact_name",
    email: "contact_email",
    "email address": "contact_email",
    "e-mail": "contact_email",
    status: "status",
  };

  const normalized = column.toLowerCase().trim();
  return columnMap[normalized] || column;
};

// Get all contacts
const getAllContacts = (req, res) => {
  const query = "SELECT * FROM contacts ORDER BY added_at DESC";

  db.query(query, (err, data) => {
    if (err) {
      console.error("Error fetching contacts:", err);
      return res.status(500).json({ error: "Failed to fetch contacts" });
    }
    return res.json(data);
  });
};

// Add new contact
const addContact = (req, res) => {
  const { contact_name, contact_email, status } = req.body;

  if (!contact_name || !contact_email) {
    return res.status(400).json({ error: "Name and email are required" });
  }

  const query =
    "INSERT INTO contacts (contact_name, contact_email, status, added_at) VALUES (?, ?, ?, NOW())";

  db.query(
    query,
    [contact_name, contact_email, status || "Active"],
    (err, result) => {
      if (err) {
        console.error("Error adding contact:", err);
        // return res.status(500).json({ error: "Failed to add contact" });
      }
      return res.json({
        message: "Contact added successfully",
        id: result.insertId,
      });
    }
  );
};

// Update contact
const updateContact = (req, res) => {
  const { id } = req.params;
  const { contact_name, contact_email, status } = req.body;

  if (!contact_name || !contact_email) {
    return res.status(400).json({ error: "Name and email are required" });
  }

  const query =
    "UPDATE contacts SET contact_name = ?, contact_email = ?, status = ? WHERE contact_id = ?";

  db.query(query, [contact_name, contact_email, status, id], (err, result) => {
    if (err) {
      console.error("Error updating contact:", err);
      return res.status(500).json({ error: "Failed to update contact" });
    }
    return res.json({ message: "Contact updated successfully" });
  });
};

// Delete contact
const deleteContact = (req, res) => {
  const { id } = req.params;

  const query = "DELETE FROM contacts WHERE contact_id = ?";

  db.query(query, [id], (err, result) => {
    if (err) {
      console.error("Error deleting contact:", err);
      return res.status(500).json({ error: "Failed to delete contact" });
    }
    return res.json({ message: "Contact deleted successfully" });
  });
};

// Upload CSV
const uploadCSV = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const results = [];
  const filePath = req.file.path;

  fs.createReadStream(filePath)
    .pipe(csv())
    .on("data", (data) => {
      // Map CSV columns to database columns
      const mappedData = {};
      Object.keys(data).forEach((key) => {
        const mappedKey = mapColumnName(key);
        mappedData[mappedKey] = data[key];
      });

      // Validate required fields
      if (mappedData.contact_name && mappedData.contact_email) {
        results.push({
          contact_name: mappedData.contact_name.trim(),
          contact_email: mappedData.contact_email.trim(),
          status: mappedData.status?.trim() || "active",
        });
      }
    })
    .on("end", () => {
      // Delete uploaded file
      fs.unlinkSync(filePath);

      if (results.length === 0) {
        return res.status(400).json({
          message:
            "No valid contacts found in CSV. Make sure the file has Name and Email columns.",
        });
      }

      // Bulk insert contacts
      const query =
        "INSERT INTO contacts (contact_name, contact_email, status, added_at) VALUES ?";
      const values = results.map((contact) => [
        contact.contact_name,
        contact.contact_email,
        contact.status,
        new Date(),
      ]);

      db.query(query, [values], (err, result) => {
        if (err) {
          console.error("Error inserting contacts:", err);
          return res.status(500).json({ message: "Error uploading contacts" });
        }

        res.json({
          message: `Successfully uploaded ${result.affectedRows} contacts`,
          count: result.affectedRows,
        });
      });
    })
    .on("error", (err) => {
      // Delete uploaded file in case of error
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      console.error("Error parsing CSV:", err);
      res.status(500).json({ message: "Error parsing CSV file" });
    });
};

export default {
  getAllContacts,
  addContact,
  updateContact,
  deleteContact,
  uploadCSV,
};
