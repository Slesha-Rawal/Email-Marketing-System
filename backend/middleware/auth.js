import { queryDb } from "../utils/db.js";

const authenticate = async (req, res, next) => {
  const rawUserId = req.headers["x-user-id"];
  const userId = Number.parseInt(rawUserId, 10);

  if (!userId || Number.isNaN(userId)) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const rows = await queryDb(
      `SELECT user_id, user_email, user_name, user_role, user_status
       FROM users
       WHERE user_id = ?
       LIMIT 1`,
      [userId],
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "Invalid session user" });
    }

    const user = rows[0];

    if (user.user_status !== "active") {
      return res.status(403).json({ message: "User account is not active" });
    }

    req.user = {
      userId: user.user_id,
      email: user.user_email,
      role: user.user_role,
      name: user.user_name,
      status: user.user_status,
    };

    return next();
  } catch (error) {
    console.error("Authenticate error:", error);
    return res.status(500).json({ message: "Unable to validate user session" });
  }
};

const authorizeRoles =
  (...allowedRoles) =>
  (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: "You do not have permission to perform this action",
      });
    }

    return next();
  };

export { authenticate, authorizeRoles };
