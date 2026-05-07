import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";

const DEFAULT_ACCESS_EXPIRY = "30m";
const DEFAULT_REFRESH_EXPIRY = "14d";

const getJwtSecret = () => {
  const secret = String(process.env.JWT_SECRET || "").trim();
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return secret;
};

const getAccessJwtExpiry = () => {
  return String(
    process.env.JWT_ACCESS_EXPIRES_IN ||
      process.env.JWT_EXPIRES_IN ||
      DEFAULT_ACCESS_EXPIRY,
  ).trim();
};

const getRefreshJwtExpiry = () => {
  return String(
    process.env.JWT_REFRESH_EXPIRES_IN || DEFAULT_REFRESH_EXPIRY,
  ).trim();
};

const signAccessToken = (user) => {
  const payload = {
    sub: user.userId,
    email: user.email,
    role: user.role,
    status: user.status,
    name: user.name,
  };

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: getAccessJwtExpiry(),
  });
};

const signRefreshToken = (user) => {
  const payload = {
    sub: user.userId,
    email: user.email,
    type: "refresh",
    jti: randomUUID(),
  };

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: getRefreshJwtExpiry(),
  });
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, getJwtSecret());
};

const verifyRefreshToken = (token) => {
  const payload = jwt.verify(token, getJwtSecret());

  if (payload?.type !== "refresh") {
    const error = new Error("Invalid refresh token type");
    error.name = "JsonWebTokenError";
    throw error;
  }

  return payload;
};

const getJwtExpiry = getAccessJwtExpiry;

export {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  getAccessJwtExpiry,
  getRefreshJwtExpiry,
  getJwtExpiry,
};
