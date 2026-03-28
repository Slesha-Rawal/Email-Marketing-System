import bcrypt from "bcryptjs";
import { queryDb } from "../utils/db.js";

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const formatUser = (user) => ({
  userId: user.user_id,
  email: user.user_email,
  name: user.user_name,
  role: user.user_role,
  status: user.user_status,
});

const login = async (req, res) => {
  const payload = req.body && typeof req.body === "object" ? req.body : {};
  const email = payload.email?.trim().toLowerCase();
  const password = payload.password?.trim();

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: "Enter a valid email address" });
  }

  try {
    const rows = await queryDb(
      `SELECT user_id, user_email, user_password, user_name, user_role, user_status
       FROM users
       WHERE user_email = ?
       LIMIT 1`,
      [email],
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.user_password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.user_status !== "active") {
      return res.status(403).json({ message: "User account is not active" });
    }

    try {
      await queryDb(
        `UPDATE users
         SET last_login_at = CURRENT_TIMESTAMP
         WHERE user_id = ?`,
        [user.user_id],
      );
    } catch (lastLoginError) {
      console.error("Failed to update last login timestamp:", lastLoginError);
    }

    return res.status(200).json({
      user: formatUser(user),
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Unable to log in right now" });
  }
};

const me = async (req, res) => {
  try {
    const rows = await queryDb(
      `SELECT user_id, user_email, user_name, user_role, user_status
       FROM users
       WHERE user_id = ?
       LIMIT 1`,
      [req.user.userId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ user: formatUser(rows[0]) });
  } catch (error) {
    console.error("Fetch current user error:", error);
    return res.status(500).json({ message: "Unable to load current user" });
  }
};

const updateProfile = async (req, res) => {
  const payload = req.body && typeof req.body === "object" ? req.body : {};
  const name = payload.name?.trim();
  const email = payload.email?.trim().toLowerCase();

  if (!name || !email) {
    return res.status(400).json({ message: "Name and email are required" });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: "Enter a valid email address" });
  }

  try {
    const emailConflict = await queryDb(
      `SELECT user_id
       FROM users
       WHERE user_email = ? AND user_id <> ?
       LIMIT 1`,
      [email, req.user.userId],
    );

    if (emailConflict.length > 0) {
      return res.status(409).json({ message: "Email is already in use" });
    }

    await queryDb(
      `UPDATE users
       SET user_name = ?, user_email = ?
       WHERE user_id = ?`,
      [name, email, req.user.userId],
    );

    const rows = await queryDb(
      `SELECT user_id, user_email, user_name, user_role, user_status
       FROM users
       WHERE user_id = ?
       LIMIT 1`,
      [req.user.userId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "Profile updated successfully",
      user: formatUser(rows[0]),
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return res.status(500).json({ message: "Unable to update profile" });
  }
};

const changePassword = async (req, res) => {
  const payload = req.body && typeof req.body === "object" ? req.body : {};
  const currentPassword = payload.currentPassword?.trim();
  const newPassword = payload.newPassword?.trim();

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      message: "Current password and new password are required",
    });
  }

  if (newPassword.length < 8) {
    return res
      .status(400)
      .json({ message: "New password must be at least 8 characters" });
  }

  if (currentPassword === newPassword) {
    return res.status(400).json({
      message: "New password must be different from current password",
    });
  }

  try {
    const rows = await queryDb(
      `SELECT user_id, user_password
       FROM users
       WHERE user_id = ?
       LIMIT 1`,
      [req.user.userId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = rows[0];
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.user_password,
    );

    if (!isCurrentPasswordValid) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await queryDb(
      `UPDATE users
       SET user_password = ?
       WHERE user_id = ?`,
      [hashedPassword, req.user.userId],
    );

    return res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ message: "Unable to change password" });
  }
};

export default {
  login,
  me,
  updateProfile,
  changePassword,
};
