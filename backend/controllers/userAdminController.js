import { queryDb } from "../utils/db.js";
import bcrypt from "bcryptjs";

const toPublicAvatarPath = (storedPath = "") => {
  const normalizedPath = String(storedPath || "")
    .replace(/\\/g, "/")
    .trim();

  if (!normalizedPath) {
    return "";
  }

  if (normalizedPath.startsWith("/")) {
    return normalizedPath;
  }

  return `/${normalizedPath}`;
};

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

const buildActivityTimeline = ({
  createdAt,
  lastLoginAt,
  contactsCreated,
  lastContactActivity,
  templatesCreated,
  lastTemplateActivity,
  campaignsCreated,
  campaignsSent,
  lastCampaignActivity,
  updatedAt,
}) => {
  return [
    {
      key: "created",
      title: "Account created",
      date: createdAt,
      detail: "User profile was created.",
    },
    {
      key: "login",
      title: "Last login",
      date: lastLoginAt,
      detail: "Most recent sign-in recorded.",
    },
    {
      key: "contacts",
      title: "Contacts activity",
      date: lastContactActivity,
      detail: `${contactsCreated} contacts created.`,
    },
    {
      key: "templates",
      title: "Templates activity",
      date: lastTemplateActivity,
      detail: `${templatesCreated} templates created.`,
    },
    {
      key: "campaigns",
      title: "Campaigns activity",
      date: lastCampaignActivity,
      detail: `${campaignsCreated} campaigns created, ${campaignsSent} sent.`,
    },
    {
      key: "updated",
      title: "Latest account update",
      date: updatedAt,
      detail: "Most recent user record update.",
    },
  ]
    .filter((item) => item.date)
    .map((item) => ({
      ...item,
      date: new Date(item.date).toISOString(),
    }))
    .sort((left, right) => new Date(right.date) - new Date(left.date));
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
        u.user_avatar_url,
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
      WHERE u.user_role IN ('users', 'admin')
       ORDER BY u.created_at DESC`,
    );

    return res.status(200).json(
      users.map((user) => ({
        userId: user.user_id,
        name: user.user_name,
        email: user.user_email,
        role: user.user_role,
        status: user.user_status,
        avatarUrl: toPublicAvatarPath(user.user_avatar_url),
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
    console.error("Get users error:", error);
    return res.status(500).json({ message: "Failed to load users" });
  }
};

const createManagedUser = async (req, res) => {
  const payload = req.body && typeof req.body === "object" ? req.body : {};
  const name = String(payload.name || "").trim();
  const email = String(payload.email || "")
    .trim()
    .toLowerCase();
  const role = String(payload.role || "")
    .trim()
    .toLowerCase();
  const password = String(payload.password || "").trim();

  if (!name || !email || !role || !password) {
    return res
      .status(400)
      .json({ message: "Name, email, role, and password are required" });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: "Enter a valid email address" });
  }

  if (!["admin", "users"].includes(role)) {
    return res.status(400).json({ message: "Invalid role" });
  }

  if (password.length < 8) {
    return res
      .status(400)
      .json({ message: "Password must be at least 8 characters" });
  }

  try {
    const existing = await queryDb(
      `SELECT user_id FROM users WHERE user_email = ? LIMIT 1`,
      [email],
    );

    if (existing.length > 0) {
      return res.status(409).json({ message: "Email is already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await queryDb(
      `INSERT INTO users (user_name, user_email, user_password, user_role, user_status)
       VALUES (?, ?, ?, ?, 'active')`,
      [name, email, hashedPassword, role],
    );

    return res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    console.error("Create managed user error:", error);
    return res.status(500).json({ message: "Failed to create user" });
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
         last_login_at,
         user_avatar_url
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
         total_clicked,
         total_unsubscribed
       FROM campaigns
       WHERE created_by = ?
         AND campaign_status = 'sent'
       ORDER BY COALESCE(sent_date, updated_at, created_at) DESC`,
      [userId],
    );

    const contactsCreated = Number(contactStats.contacts_created || 0);
    const templatesCreated = Number(templateStats.templates_created || 0);
    const campaignsCreated = Number(campaignStats.campaigns_created || 0);
    const campaignsSent = Number(campaignStats.campaigns_sent || 0);
    const activityTimeline = buildActivityTimeline({
      createdAt: user.created_at,
      lastLoginAt: user.last_login_at,
      contactsCreated,
      lastContactActivity: contactStats.last_contact_activity,
      templatesCreated,
      lastTemplateActivity: templateStats.last_template_activity,
      campaignsCreated,
      campaignsSent,
      lastCampaignActivity: campaignStats.last_campaign_activity,
      updatedAt: user.updated_at,
    });

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
        avatarUrl: toPublicAvatarPath(user.user_avatar_url),
      },
      summary: {
        contactsCreated,
        templatesCreated,
        campaignsCreated,
        campaignsSent,
        lastActivityAt: computeLatestDate(
          user.last_login_at,
          contactStats.last_contact_activity,
          templateStats.last_template_activity,
          campaignStats.last_campaign_activity,
          user.updated_at,
        ),
      },
      activityTimeline,
      sentCampaigns,
    });
  } catch (error) {
    console.error("Get user activity error:", error);
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

  if (!["admin", "users"].includes(role)) {
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
    console.error("Update user error:", error);
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

    if (!["users", "admin"].includes(rows[0].user_role)) {
      return res.status(400).json({
        message: "This user cannot be deleted from this page",
      });
    }

    await queryDb(`DELETE FROM users WHERE user_id = ?`, [userId]);

    return res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    return res.status(500).json({ message: "Failed to delete user" });
  }
};

export default {
  getMarketingUsers,
  createManagedUser,
  getMarketingUserActivity,
  updateMarketingUser,
  deleteMarketingUser,
};
