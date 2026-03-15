import { queryDb } from "../utils/db.js";

let groupTablesReady = false;

const ensureGroupTables = async () => {
  if (groupTablesReady) {
    return;
  }

  await queryDb(
    `CREATE TABLE IF NOT EXISTS contact_groups (
      group_id INT PRIMARY KEY AUTO_INCREMENT,
      group_name VARCHAR(255) NOT NULL UNIQUE,
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
    )`,
  );

  await queryDb(
    `CREATE TABLE IF NOT EXISTS contact_group_members (
      group_id INT NOT NULL,
      contact_id INT NOT NULL,
      added_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (group_id, contact_id),
      FOREIGN KEY (group_id) REFERENCES contact_groups(group_id) ON DELETE CASCADE,
      FOREIGN KEY (contact_id) REFERENCES contacts(contact_id) ON DELETE CASCADE,
      FOREIGN KEY (added_by) REFERENCES users(user_id) ON DELETE SET NULL
    )`,
  );

  groupTablesReady = true;
};

const getContactGroups = async (req, res) => {
  try {
    await ensureGroupTables();

    const groups = await queryDb(
      `SELECT cg.group_id, cg.group_name, cg.created_at,
              u.user_name AS created_by_name,
              COUNT(cgm.contact_id) AS contacts_count
       FROM contact_groups cg
       LEFT JOIN users u ON u.user_id = cg.created_by
       LEFT JOIN contact_group_members cgm ON cgm.group_id = cg.group_id
       GROUP BY cg.group_id, cg.group_name, cg.created_at, u.user_name
       ORDER BY cg.group_name ASC`,
    );

    return res.json(groups);
  } catch (error) {
    console.error("Error fetching contact groups:", error);
    return res.status(500).json({ error: "Failed to fetch contact groups" });
  }
};

const createContactGroup = async (req, res) => {
  const groupName = req.body.group_name?.trim();

  if (!groupName) {
    return res.status(400).json({ error: "Group name is required" });
  }

  try {
    await ensureGroupTables();

    const result = await queryDb(
      `INSERT INTO contact_groups (group_name, created_by)
       VALUES (?, ?)`,
      [groupName, req.user.userId],
    );

    return res.status(201).json({
      message: "Group created successfully",
      group_id: result.insertId,
    });
  } catch (error) {
    console.error("Error creating contact group:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Group name already exists" });
    }

    return res.status(500).json({ error: "Failed to create contact group" });
  }
};

const getGroupContacts = async (req, res) => {
  const groupId = Number.parseInt(req.params.groupId, 10);

  if (!groupId || Number.isNaN(groupId)) {
    return res.status(400).json({ error: "Invalid group id" });
  }

  try {
    await ensureGroupTables();

    const existingGroup = await queryDb(
      "SELECT group_id FROM contact_groups WHERE group_id = ? LIMIT 1",
      [groupId],
    );

    if (existingGroup.length === 0) {
      return res.status(404).json({ error: "Group not found" });
    }

    const contacts = await queryDb(
      `SELECT c.contact_id, c.contact_name, c.contact_email, c.contact_status,
              c.created_at, c.updated_at
       FROM contact_group_members cgm
       INNER JOIN contacts c ON c.contact_id = cgm.contact_id
       WHERE cgm.group_id = ?
       ORDER BY c.contact_name ASC`,
      [groupId],
    );

    return res.json(contacts);
  } catch (error) {
    console.error("Error fetching group contacts:", error);
    return res.status(500).json({ error: "Failed to fetch group contacts" });
  }
};

const addContactsToGroup = async (req, res) => {
  const groupId = Number.parseInt(req.params.groupId, 10);
  const contactIds = Array.isArray(req.body.contactIds)
    ? req.body.contactIds
    : [];

  if (!groupId || Number.isNaN(groupId)) {
    return res.status(400).json({ error: "Invalid group id" });
  }

  if (contactIds.length === 0) {
    return res.status(400).json({ error: "Select at least one contact" });
  }

  const normalizedContactIds = [
    ...new Set(
      contactIds
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  ];

  if (normalizedContactIds.length === 0) {
    return res.status(400).json({ error: "Invalid contact ids" });
  }

  try {
    await ensureGroupTables();

    const existingGroup = await queryDb(
      "SELECT group_id FROM contact_groups WHERE group_id = ? LIMIT 1",
      [groupId],
    );

    if (existingGroup.length === 0) {
      return res.status(404).json({ error: "Group not found" });
    }

    const contactRows = await queryDb(
      `SELECT contact_id
       FROM contacts
       WHERE contact_id IN (?)`,
      [normalizedContactIds],
    );

    if (contactRows.length === 0) {
      return res.status(400).json({ error: "No valid contacts selected" });
    }

    const values = contactRows.map((row) => [
      groupId,
      row.contact_id,
      req.user.userId,
    ]);

    await queryDb(
      `INSERT IGNORE INTO contact_group_members (group_id, contact_id, added_by)
       VALUES ?`,
      [values],
    );

    return res.json({ message: "Contacts added to group" });
  } catch (error) {
    console.error("Error adding contacts to group:", error);
    return res.status(500).json({ error: "Failed to add contacts to group" });
  }
};

const removeContactFromGroup = async (req, res) => {
  const groupId = Number.parseInt(req.params.groupId, 10);
  const contactId = Number.parseInt(req.params.contactId, 10);

  if (
    !groupId ||
    Number.isNaN(groupId) ||
    !contactId ||
    Number.isNaN(contactId)
  ) {
    return res.status(400).json({ error: "Invalid group or contact id" });
  }

  try {
    await ensureGroupTables();

    const result = await queryDb(
      `DELETE FROM contact_group_members
       WHERE group_id = ? AND contact_id = ?`,
      [groupId, contactId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Grouped contact not found" });
    }

    return res.json({ message: "Contact removed from group" });
  } catch (error) {
    console.error("Error removing contact from group:", error);
    return res
      .status(500)
      .json({ error: "Failed to remove contact from group" });
  }
};

const deleteContactGroup = async (req, res) => {
  const groupId = Number.parseInt(req.params.groupId, 10);

  if (!groupId || Number.isNaN(groupId)) {
    return res.status(400).json({ error: "Invalid group id" });
  }

  try {
    await ensureGroupTables();

    const result = await queryDb(
      "DELETE FROM contact_groups WHERE group_id = ?",
      [groupId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Group not found" });
    }

    return res.json({ message: "Group deleted successfully" });
  } catch (error) {
    console.error("Error deleting contact group:", error);
    return res.status(500).json({ error: "Failed to delete contact group" });
  }
};

export default {
  getContactGroups,
  createContactGroup,
  getGroupContacts,
  addContactsToGroup,
  removeContactFromGroup,
  deleteContactGroup,
};
