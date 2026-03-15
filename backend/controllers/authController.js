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
  const email = req.body.email?.trim().toLowerCase();
  const password = req.body.password?.trim();

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

export default {
  login,
  me,
};
