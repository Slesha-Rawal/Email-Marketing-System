import { queryDb } from "../utils/db.js";
import { hasPermission, normalizeRole } from "../config/permissions.js";
import { verifyAccessToken } from "../utils/jwt.js";

const parseBearerToken = (authorizationHeader) => {
  const headerValue = String(authorizationHeader || "").trim();
  const [scheme, token] = headerValue.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token.trim();
};

const getAuthToken = (req) => {
  const headerToken = parseBearerToken(req.headers.authorization);
  if (headerToken) {
    return headerToken;
  }

  const cookieToken = String(req.cookies?.authToken || "").trim();
  return cookieToken || null;
};

const resolveAuthenticatedUser = async (req) => {
  const token = getAuthToken(req);

  if (!token) {
    const error = new Error("Authentication required");
    error.statusCode = 401;
    throw error;
  }

  const payload = verifyAccessToken(token);
  const tokenUserId = Number.parseInt(payload?.sub, 10);

  if (!tokenUserId || Number.isNaN(tokenUserId)) {
    const error = new Error("Invalid authentication token");
    error.statusCode = 401;
    throw error;
  }

  const rows = await queryDb(
    `SELECT user_id, user_email, user_name, user_role, user_status
     FROM users
     WHERE user_id = ?
     LIMIT 1`,
    [tokenUserId],
  );

  if (rows.length === 0) {
    const error = new Error("Invalid session user");
    error.statusCode = 401;
    throw error;
  }

  const user = rows[0];
  const tokenRole = normalizeRole(payload?.role);
  const tokenStatus = String(payload?.status || "")
    .trim()
    .toLowerCase();
  const dbRole = normalizeRole(user.user_role);
  const dbStatus = String(user.user_status || "")
    .trim()
    .toLowerCase();

  if (tokenRole && tokenRole !== dbRole) {
    const error = new Error(
      "Token role claim is outdated. Please log in again",
    );
    error.statusCode = 401;
    throw error;
  }

  if (tokenStatus && tokenStatus !== dbStatus) {
    const error = new Error(
      "Token status claim is outdated. Please log in again",
    );
    error.statusCode = 401;
    throw error;
  }

  if (user.user_status !== "active") {
    const error = new Error("User account is not active");
    error.statusCode = 403;
    throw error;
  }

  return {
    tokenUserId,
    user,
  };
};

const authenticateTokenOnly = async (req, res, next) => {
  try {
    const { user } = await resolveAuthenticatedUser(req);

    req.user = {
      userId: user.user_id,
      email: user.user_email,
      role: user.user_role,
      name: user.user_name,
      status: user.user_status,
    };

    return next();
  } catch (error) {
    if (
      error?.name === "JsonWebTokenError" ||
      error?.name === "TokenExpiredError"
    ) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    if (error?.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    console.error("Authenticate token-only error:", error);
    return res.status(500).json({ message: "Unable to validate user session" });
  }
};

const authenticate = async (req, res, next) => {
  try {
    const { tokenUserId, user } = await resolveAuthenticatedUser(req);

    const sessionUserId = Number.parseInt(req.session?.otpUserId, 10);
    const isOtpVerified = req.session?.isOtpVerified === true;
    if (!isOtpVerified || sessionUserId !== tokenUserId) {
      // If JWT is valid but session was lost (e.g., server restart),
      // rebuild the OTP-verified session to prevent app-wide 401 spam.
      if (req.session) {
        req.session.isOtpVerified = true;
        req.session.otpUserId = tokenUserId;
        req.session.pendingOtpUserId = null;
      }
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
    if (
      error?.name === "JsonWebTokenError" ||
      error?.name === "TokenExpiredError"
    ) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    console.error("Authenticate error:", error);
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return res.status(500).json({ message: "Unable to validate user session" });
  }
};

const authorizeRoles =
  (...allowedRoles) =>
  (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const normalizedAllowedRoles = allowedRoles.map((role) =>
      String(role).trim().toLowerCase(),
    );
    const normalizedUserRole = String(req.user.role || "")
      .trim()
      .toLowerCase();

    if (!normalizedAllowedRoles.includes(normalizedUserRole)) {
      return res.status(403).json({
        message: "You do not have permission to perform this action",
      });
    }

    return next();
  };

const authorizePermission = (permission) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  if (!hasPermission(req.user.role, permission)) {
    return res.status(403).json({
      message: "You do not have permission to perform this action",
    });
  }

  return next();
};

export {
  authenticate,
  authenticateTokenOnly,
  authorizeRoles,
  authorizePermission,
};
