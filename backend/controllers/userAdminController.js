import { queryDb } from "../utils/db.js";

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const computeLatestDate = (...values) => {
  const timestamps = values
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
    .filter((value) => !Number.isNaN(value));

  if (timestamps.length === 0) {
    return null;
  }

  return new Date(Math.max(...timestamps));
};

const getMarketingUsers = async (req, res) => {
  try {
    const users = await queryDb(
      `SELECT
         u.user_id,
         u.user_name,
         u.user_email,
         u.user_role,
         u.user_status,
         u.created_at,
         u.updated_at,
         u.last_login_at,
         COALESCE(c.contacts_created, 0) AS contacts_created,
         c.last_contact_activity,
         COALESCE(cp.campaigns_created, 0) AS campaigns_created,
         cp.last_campaign_activity,
         COALESCE(t.templates_created, 0) AS templates_created,
         t.last_template_activity
       FROM users u
       LEFT JOIN (
         SELECT
           created_by,
           COUNT(*) AS contacts_created,
           MAX(updated_at) AS last_contact_activity
         FROM contacts
         GROUP BY created_by
       ) c ON c.created_by = u.user_id
       LEFT JOIN (
         SELECT
           created_by,
           COUNT(*) AS campaigns_created,
           MAX(updated_at) AS last_campaign_activity
         FROM campaigns
         GROUP BY created_by
       ) cp ON cp.created_by = u.user_id
       LEFT JOIN (
         SELECT
           created_by,
           COUNT(*) AS templates_created,
           MAX(updated_at) AS last_template_activity
         FROM templates
         GROUP BY created_by
       ) t ON t.created_by = u.user_id
       WHERE u.user_role = 'marketing'
       ORDER BY u.created_at DESC`,
    );

    return res.status(200).json(
      users.map((user) => ({
        userId: user.user_id,
        name: user.user_name,
        email: user.user_email,
        role: user.user_role,
        status: user.user_status,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        lastLoginAt: user.last_login_at,
        activity: {
          contactsCreated: Number(user.contacts_created || 0),
          campaignsCreated: Number(user.campaigns_created || 0),
          templatesCreated: Number(user.templates_created || 0),
          lastActivityAt: computeLatestDate(
            user.last_login_at,
            user.last_contact_activity,
            user.last_campaign_activity,
            user.last_template_activity,
            user.updated_at,
          ),
        },
      })),
    );
  } catch (error) {
    console.error("Get marketing users error:", error);
    return res.status(500).json({ message: "Failed to load users" });
  }
};

const getMarketingUserActivity = async (req, res) => {
  const userId = Number.parseInt(req.params.userId, 10);

  if (!userId || Number.isNaN(userId)) {
    return res.status(400).json({ message: "Invalid user id" });
  }

  try {
    const users = await queryDb(
      `SELECT
         user_id,
         user_name,
         user_email,
         user_role,
         user_status,
         created_at,
         updated_at,
         last_login_at
       FROM users
       WHERE user_id = ?
       LIMIT 1`,
      [userId],
    );

    if (users.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = users[0];

    const [contactStats] = await queryDb(
      `SELECT
         COUNT(*) AS contacts_created,
         MAX(updated_at) AS last_contact_activity
       FROM contacts
       WHERE created_by = ?`,
      [userId],
    );

    const [templateStats] = await queryDb(
      `SELECT
         COUNT(*) AS templates_created,
         MAX(updated_at) AS last_template_activity
       FROM templates
       WHERE created_by = ?`,
      [userId],
    );

    const [campaignStats] = await queryDb(
      `SELECT
         COUNT(*) AS campaigns_created,
         SUM(CASE WHEN campaign_status = 'sent' THEN 1 ELSE 0 END) AS campaigns_sent,
         MAX(updated_at) AS last_campaign_activity
       FROM campaigns
       WHERE created_by = ?`,
      [userId],
    );

    const sentCampaigns = await queryDb(
      `SELECT
         campaign_id,
         campaign_name,
         campaign_subject,
         campaign_status,
         sent_date,
         scheduled_date,
         total_recipients,
         total_sent,
         total_opened,
         total_clicked
       FROM campaigns
       WHERE created_by = ?
         AND campaign_status = 'sent'
       ORDER BY COALESCE(sent_date, updated_at, created_at) DESC`,
      [userId],
    );

    return res.status(200).json({
      user: {
        userId: user.user_id,
        name: user.user_name,
        email: user.user_email,
        role: user.user_role,
        status: user.user_status,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        lastLoginAt: user.last_login_at,
      },
      summary: {
        contactsCreated: Number(contactStats.contacts_created || 0),
        templatesCreated: Number(templateStats.templates_created || 0),
        campaignsCreated: Number(campaignStats.campaigns_created || 0),
        campaignsSent: Number(campaignStats.campaigns_sent || 0),
        lastActivityAt: computeLatestDate(
          user.last_login_at,
          contactStats.last_contact_activity,
          templateStats.last_template_activity,
          campaignStats.last_campaign_activity,
          user.updated_at,
        ),
      },
      sentCampaigns,
    });
  } catch (error) {
    console.error("Get marketing user activity error:", error);
    return res.status(500).json({ message: "Failed to load user activity" });
  }
};

const updateMarketingUser = async (req, res) => {
  const userId = Number.parseInt(req.params.userId, 10);

  if (!userId || Number.isNaN(userId)) {
    return res.status(400).json({ message: "Invalid user id" });
  }

  const payload = req.body && typeof req.body === "object" ? req.body : {};
  const name = payload.name?.trim();
  const email = payload.email?.trim().toLowerCase();
  const role = payload.role;

  if (!name || !email || !role) {
    return res
      .status(400)
      .json({ message: "Name, email, and role are required" });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: "Enter a valid email address" });
  }

  if (!["admin", "marketing"].includes(role)) {
    return res.status(400).json({ message: "Invalid role" });
  }

  try {
    const targetRows = await queryDb(
      `SELECT user_id, user_role
       FROM users
       WHERE user_id = ?
       LIMIT 1`,
      [userId],
    );

    if (targetRows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const emailConflict = await queryDb(
      `SELECT user_id
       FROM users
       WHERE user_email = ? AND user_id <> ?
       LIMIT 1`,
      [email, userId],
    );

    if (emailConflict.length > 0) {
      return res.status(409).json({ message: "Email is already in use" });
    }

    await queryDb(
      `UPDATE users
       SET user_name = ?, user_email = ?, user_role = ?
       WHERE user_id = ?`,
      [name, email, role, userId],
    );

    return res.status(200).json({ message: "User updated successfully" });
  } catch (error) {
    console.error("Update marketing user error:", error);
    return res.status(500).json({ message: "Failed to update user" });
  }
};

const deleteMarketingUser = async (req, res) => {
  const userId = Number.parseInt(req.params.userId, 10);

  if (!userId || Number.isNaN(userId)) {
    return res.status(400).json({ message: "Invalid user id" });
  }

  if (req.user.userId === userId) {
    return res
      .status(400)
      .json({ message: "You cannot delete your own account" });
  }

  try {
    const rows = await queryDb(
      `SELECT user_id, user_role
       FROM users
       WHERE user_id = ?
       LIMIT 1`,
      [userId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    if (rows[0].user_role !== "marketing") {
      return res.status(400).json({
        message: "Only marketing users can be deleted from this page",
      });
    }

    await queryDb(`DELETE FROM users WHERE user_id = ?`, [userId]);

    return res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete marketing user error:", error);
    return res.status(500).json({ message: "Failed to delete user" });
  }
};

export default {
  getMarketingUsers,
  getMarketingUserActivity,
  updateMarketingUser,
  deleteMarketingUser,
};
