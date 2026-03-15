import { queryDb } from "../utils/db.js";

const validateTemplate = ({
  template_name,
  template_subject,
  template_body,
}) => {
  if (
    !template_name?.trim() ||
    !template_subject?.trim() ||
    !template_body?.trim()
  ) {
    return "Template name, subject, and body are required";
  }

  return null;
};

const getAllTemplates = async (req, res) => {
  try {
    const templates = await queryDb(
      `SELECT t.template_id, t.template_name, t.template_subject, t.template_body,
              t.created_at, t.updated_at, u.user_name AS created_by_name
       FROM templates t
       LEFT JOIN users u ON u.user_id = t.created_by
       ORDER BY t.updated_at DESC`,
    );

    return res.json(templates);
  } catch (error) {
    console.error("Error fetching templates:", error);
    return res.status(500).json({ message: "Failed to fetch templates" });
  }
};

const createTemplate = async (req, res) => {
  const template = {
    template_name: req.body.template_name?.trim(),
    template_subject: req.body.template_subject?.trim(),
    template_body: req.body.template_body?.trim(),
  };
  const validationMessage = validateTemplate(template);

  if (validationMessage) {
    return res.status(400).json({ message: validationMessage });
  }

  try {
    const result = await queryDb(
      `INSERT INTO templates (template_name, template_subject, template_body, created_by)
       VALUES (?, ?, ?, ?)`,
      [
        template.template_name,
        template.template_subject,
        template.template_body,
        req.user.userId,
      ],
    );

    return res.status(201).json({
      message: "Template created successfully",
      id: result.insertId,
    });
  } catch (error) {
    console.error("Error creating template:", error);
    return res.status(500).json({ message: "Failed to create template" });
  }
};

const updateTemplate = async (req, res) => {
  const { id } = req.params;
  const template = {
    template_name: req.body.template_name?.trim(),
    template_subject: req.body.template_subject?.trim(),
    template_body: req.body.template_body?.trim(),
  };
  const validationMessage = validateTemplate(template);

  if (validationMessage) {
    return res.status(400).json({ message: validationMessage });
  }

  try {
    const result = await queryDb(
      `UPDATE templates
       SET template_name = ?, template_subject = ?, template_body = ?
       WHERE template_id = ?`,
      [
        template.template_name,
        template.template_subject,
        template.template_body,
        id,
      ],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Template not found" });
    }

    return res.json({ message: "Template updated successfully" });
  } catch (error) {
    console.error("Error updating template:", error);
    return res.status(500).json({ message: "Failed to update template" });
  }
};

const deleteTemplate = async (req, res) => {
  try {
    const result = await queryDb(
      "DELETE FROM templates WHERE template_id = ?",
      [req.params.id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Template not found" });
    }

    return res.json({ message: "Template deleted successfully" });
  } catch (error) {
    console.error("Error deleting template:", error);
    return res.status(500).json({ message: "Failed to delete template" });
  }
};

export default {
  getAllTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
};
