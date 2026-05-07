import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import fs from "fs";
import nodemailer from "nodemailer";
import path from "path";
import { queryDb } from "../utils/db.js";
import {
  getResolvedSmtpConfig,
  saveSmtpConfig,
  parseBoolean,
} from "../utils/smtpConfigStore.js";
import {
  getAccessJwtExpiry,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt.js";
import {
  addMinutes,
  addSeconds,
  buildDeviceFingerprint,
  generateChallengeId,
  generateOtpCode,
  getClientIp,
  getOtpMaxAttempts,
  getOtpMaxResends,
  getOtpResendCooldownSeconds,
  getOtpTtlMinutes,
  getUserAgent,
  hashOtpCode,
} from "../utils/loginSecurity.js";

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const GENERIC_LOGIN_ERROR_MESSAGE = "Invalid email or password";
const ACCOUNT_OTP_PURPOSES = {
  EMAIL_CHANGE: "email_change",
  PASSWORD_CHANGE: "password_change",
};
const PASSWORD_RESET_LINK_SENT_MESSAGE = "Reset link sent to your email";

let accountOtpTableEnsured = false;

const inferEmailProvider = (smtpHost = "") => {
  const host = String(smtpHost).trim().toLowerCase();

  if (host.includes("gmail")) {
    return "gmail";
  }

  if (host.includes("office365") || host.includes("outlook")) {
    return "outlook";
  }

  if (host.includes("zoho")) {
    return "zoho";
  }

  return "custom";
};

const parseFromAddress = (rawFrom = "") => {
  const source = String(rawFrom || "").trim();
  if (!source) {
    return { senderName: "", senderEmail: "" };
  }

  const match = source.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (match) {
    return {
      senderName: (match[1] || "").trim(),
      senderEmail: (match[2] || "").trim(),
    };
  }

  return { senderName: "", senderEmail: source };
};

const formatUser = (user) => ({
  userId: user.user_id,
  email: user.user_email,
  name: user.user_name,
  role: user.user_role,
  status: user.user_status,
  avatarUrl: toPublicAvatarPath(user.user_avatar_url),
});

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

const removeAvatarFileIfExists = async (storedPath = "") => {
  const normalizedPath = String(storedPath || "")
    .replace(/\\/g, "/")
    .trim();

  if (!normalizedPath) {
    return;
  }

  const safePrefix = "uploads/profile-avatars/";
  if (!normalizedPath.startsWith(safePrefix)) {
    return;
  }

  const absolutePath = path.join(process.cwd(), normalizedPath);

  await fs.promises.unlink(absolutePath).catch((error) => {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  });
};

const getAuthCookieOptions = () => {
  const configuredMaxAge = Number.parseInt(
    process.env.AUTH_COOKIE_MAX_AGE_MS || "43200000",
    10,
  );

  return {
    httpOnly: true,
    secure: String(process.env.COOKIE_SECURE || "false").trim() === "true",
    sameSite: String(process.env.COOKIE_SAME_SITE || "lax").trim(),
    maxAge:
      Number.isNaN(configuredMaxAge) || configuredMaxAge <= 0
        ? 43200000
        : configuredMaxAge,
    path: "/",
  };
};

const getRefreshCookieOptions = () => {
  const configuredMaxAge = Number.parseInt(
    process.env.REFRESH_COOKIE_MAX_AGE_MS || "1209600000",
    10,
  );

  return {
    httpOnly: true,
    secure: String(process.env.COOKIE_SECURE || "false").trim() === "true",
    sameSite: String(process.env.COOKIE_SAME_SITE || "lax").trim(),
    maxAge:
      Number.isNaN(configuredMaxAge) || configuredMaxAge <= 0
        ? 1209600000
        : configuredMaxAge,
    path: "/",
  };
};

const setAuthCookie = (res, token) => {
  res.cookie("authToken", token, getAuthCookieOptions());
};

const setRefreshCookie = (res, token) => {
  res.cookie("refreshToken", token, getRefreshCookieOptions());
};

const clearAuthCookies = (res) => {
  res.clearCookie("authToken", { path: "/" });
  res.clearCookie("refreshToken", { path: "/" });
};

const hashRefreshToken = (token) =>
  createHash("sha256")
    .update(String(token || ""))
    .digest("hex");

const persistRefreshTokenSession = async ({ userId, refreshToken }) => {
  const payload = verifyRefreshToken(refreshToken);
  const tokenId = String(payload?.jti || "").trim();
  const expiresAt = Number(payload?.exp || 0);

  if (!tokenId || !expiresAt) {
    throw new Error("Invalid refresh token payload");
  }

  await queryDb(
    `INSERT INTO refresh_token_sessions
     (token_id, user_id, token_hash, expires_at)
     VALUES (?, ?, ?, ?)`,
    [
      tokenId,
      userId,
      hashRefreshToken(refreshToken),
      new Date(expiresAt * 1000),
    ],
  );

  return { tokenId };
};

const revokeRefreshTokenSession = async ({
  tokenId,
  replacedByTokenId = null,
}) => {
  if (!tokenId) {
    return;
  }

  await queryDb(
    `UPDATE refresh_token_sessions
     SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP),
         replaced_by_token_id = COALESCE(?, replaced_by_token_id)
     WHERE token_id = ?`,
    [replacedByTokenId, tokenId],
  );
};

const revokeRefreshTokenByCookie = async (req) => {
  const rawRefreshToken = String(req.cookies?.refreshToken || "").trim();
  if (!rawRefreshToken) {
    return;
  }

  await queryDb(
    `UPDATE refresh_token_sessions
     SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
     WHERE token_hash = ?`,
    [hashRefreshToken(rawRefreshToken)],
  );
};

const revokeAllRefreshSessionsForUser = async (userId) => {
  if (!userId) {
    return;
  }

  await queryDb(
    `UPDATE refresh_token_sessions
     SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
     WHERE user_id = ?`,
    [userId],
  );
};

const issueJwtResponse = async (
  res,
  user,
  responseStatus = 200,
  options = {},
) => {
  const formattedUser = formatUser(user);
  const token = signAccessToken(formattedUser);
  const refreshToken = signRefreshToken(formattedUser);

  const { tokenId: newTokenId } = await persistRefreshTokenSession({
    userId: formattedUser.userId,
    refreshToken,
  });

  const previousRefreshTokenId = String(options.previousRefreshTokenId || "");
  if (previousRefreshTokenId) {
    await revokeRefreshTokenSession({
      tokenId: previousRefreshTokenId,
      replacedByTokenId: newTokenId,
    });
  }

  setAuthCookie(res, token);
  setRefreshCookie(res, refreshToken);

  return res.status(responseStatus).json({
    user: formattedUser,
    token,
    tokenType: "Bearer",
    expiresIn: getAccessJwtExpiry(),
  });
};

const getAuthSmtpConfig = () => {
  const host = String(
    process.env.AUTH_SMTP_HOST || process.env.SMTP_HOST || "",
  ).trim();
  const port = String(
    process.env.AUTH_SMTP_PORT || process.env.SMTP_PORT || "",
  ).trim();
  const user = String(
    process.env.AUTH_SMTP_USER || process.env.SMTP_USER || "",
  ).trim();
  const pass = String(
    process.env.AUTH_SMTP_PASS || process.env.SMTP_PASS || "",
  ).trim();
  const secure =
    String(
      process.env.AUTH_SMTP_SECURE ?? process.env.SMTP_SECURE ?? "false",
    ).trim() === "true";
  const from =
    String(
      process.env.AUTH_SMTP_FROM || process.env.SMTP_FROM || user,
    ).trim() || user;

  return { host, port, user, pass, secure, from };
};

const createAuthTransporter = () => {
  const smtpConfig = getAuthSmtpConfig();
  const missingKeys = [
    ["AUTH_SMTP_HOST/SMTP_HOST", smtpConfig.host],
    ["AUTH_SMTP_PORT/SMTP_PORT", smtpConfig.port],
    ["AUTH_SMTP_USER/SMTP_USER", smtpConfig.user],
    ["AUTH_SMTP_PASS/SMTP_PASS", smtpConfig.pass],
  ]
    .filter(([, value]) => !String(value || "").trim())
    .map(([key]) => key);

  if (missingKeys.length > 0) {
    throw new Error(
      `Email delivery is not configured. Missing: ${missingKeys.join(", ")}`,
    );
  }
  const port = Number.parseInt(smtpConfig.port || "587", 10);

  return nodemailer.createTransport({
    host: smtpConfig.host,
    port: Number.isNaN(port) ? 587 : port,
    secure: smtpConfig.secure,
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass,
    },
  });
};

const sendLoginOtpEmail = async ({
  user,
  otpCode,
  ttlMinutes,
  ipAddress,
  userAgent,
}) => {
  const smtpConfig = getAuthSmtpConfig();
  const transporter = createAuthTransporter();
  const smtpFrom = smtpConfig.from;

  const text = [
    `Hi ${user.user_name || "User"},`,
    "",
    "We detected a login from a new device or location.",
    `Your verification code is: ${otpCode}`,
    `This code expires in ${ttlMinutes} minutes.`,
    "",
    `IP: ${ipAddress || "Unknown"}`,
    `Device: ${userAgent || "Unknown"}`,
    "",
    "If this was not you, change your password and contact an administrator.",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
      <p>Hi ${user.user_name || "User"},</p>
      <p>We detected a login from a new device or location.</p>
      <p>Your verification code is:</p>
      <p style="font-size: 28px; letter-spacing: 6px; font-weight: 700; margin: 8px 0 16px;">${otpCode}</p>
      <p>This code expires in ${ttlMinutes} minutes.</p>
      <p style="margin-top: 16px; font-size: 12px; color: #6b7280;">
        IP: ${ipAddress || "Unknown"}<br />
        Device: ${userAgent || "Unknown"}
      </p>
      <p style="margin-top: 16px;">If this was not you, change your password and contact an administrator.</p>
    </div>
  `;

  await transporter.sendMail({
    from: smtpFrom,
    to: user.user_email,
    subject: "Your login verification code",
    text,
    html,
  });
};

const removeStaleOtpRequests = async () => {
  await queryDb(
    `DELETE FROM login_otp_requests
     WHERE consumed_at IS NOT NULL
        OR expires_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 DAY)`,
  );
};

const ensureOtpStoreTable = async () => {
  await queryDb(
    `CREATE TABLE IF NOT EXISTS otp_store (
       user_id INT PRIMARY KEY,
       otp_hash VARCHAR(255) NOT NULL,
       expires_at DATETIME NOT NULL,
       FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
     )`,
  );
};

const upsertOtpStoreRecord = async ({ userId, otpHash, expiresAt }) => {
  await ensureOtpStoreTable();
  await queryDb(
    `INSERT INTO otp_store (user_id, otp_hash, expires_at)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       otp_hash = VALUES(otp_hash),
       expires_at = VALUES(expires_at)`,
    [userId, otpHash, expiresAt],
  );
};

const removeOtpStoreRecord = async (userId) => {
  await ensureOtpStoreTable();
  await queryDb(`DELETE FROM otp_store WHERE user_id = ?`, [userId]);
};

const getPasswordResetTtlMinutes = () => {
  const configuredValue = Number.parseInt(
    process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES || "20",
    10,
  );

  if (Number.isNaN(configuredValue)) {
    return 20;
  }

  return Math.max(15, Math.min(30, configuredValue));
};

const hashPasswordResetToken = (token) =>
  createHash("sha256")
    .update(String(token || ""))
    .digest("hex");

const generatePasswordResetToken = () => randomBytes(32).toString("hex");

const ensurePasswordResetTokenTable = async () => {
  await queryDb(
    `CREATE TABLE IF NOT EXISTS password_reset_tokens (
       password_reset_token_id INT PRIMARY KEY AUTO_INCREMENT,
       user_id INT NOT NULL,
       token_hash CHAR(64) NOT NULL UNIQUE,
       expires_at DATETIME NOT NULL,
       used_at DATETIME NULL,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       INDEX idx_password_reset_user_active (user_id, used_at, expires_at),
       INDEX idx_password_reset_expires_at (expires_at),
       FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
     )`,
  );
};

const removeStalePasswordResetTokens = async () => {
  await ensurePasswordResetTokenTable();
  await queryDb(
    `DELETE FROM password_reset_tokens
     WHERE used_at IS NOT NULL
        OR expires_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 DAY)`,
  );
};

const persistPasswordResetToken = async ({ userId, tokenHash, expiresAt }) => {
  await ensurePasswordResetTokenTable();

  await queryDb(
    `DELETE FROM password_reset_tokens
     WHERE user_id = ?
       AND used_at IS NULL`,
    [userId],
  );

  await queryDb(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES (?, ?, ?)`,
    [userId, tokenHash, expiresAt],
  );
};

const buildPasswordResetLink = (token) => {
  const isProduction =
    String(process.env.NODE_ENV || "")
      .trim()
      .toLowerCase() === "production";
  const forceHttps =
    String(
      process.env.PASSWORD_RESET_FORCE_HTTPS ||
        (isProduction ? "true" : "false"),
    )
      .trim()
      .toLowerCase() === "true";

  const configuredBase = String(
    process.env.PASSWORD_RESET_URL_BASE ||
      process.env.FRONTEND_URL ||
      "http://localhost:5173/reset-password",
  ).trim();

  let normalizedBase = configuredBase;
  if (!/^https?:\/\//i.test(normalizedBase)) {
    normalizedBase = `${forceHttps ? "https" : "http"}://${normalizedBase.replace(/^\/+/, "")}`;
  }

  let resetUrl;

  try {
    resetUrl = new URL(normalizedBase);
  } catch (_error) {
    resetUrl = new URL("http://localhost:5173/reset-password");
  }

  if (forceHttps) {
    resetUrl.protocol = "https:";
  }
  if (!resetUrl.pathname || resetUrl.pathname === "/") {
    resetUrl.pathname = "/reset-password";
  }

  resetUrl.searchParams.set("token", token);
  return resetUrl.toString();
};

const sendPasswordResetLinkEmail = async ({ user, resetLink, ttlMinutes }) => {
  const smtpConfig = getAuthSmtpConfig();
  const transporter = createAuthTransporter();

  const text = [
    `Hi ${user.user_name || "User"},`,
    "",
    "We received a request to reset your password.",
    "Use the secure link below to set a new password:",
    resetLink,
    "",
    `This link expires in ${ttlMinutes} minutes and can be used only once.`,
    "",
    "If you did not request this, please ignore this email.",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
      <p>Hi ${user.user_name || "User"},</p>
      <p>We received a request to reset your password.</p>
      <p>Use the secure link below to set a new password:</p>
      <p style="margin: 14px 0;">
        <a href="${resetLink}" style="display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; padding: 10px 16px; border-radius: 8px; font-weight: 700;">Reset password</a>
      </p>
      <p style="word-break: break-all; color: #4b5563;">${resetLink}</p>
      <p>This link expires in ${ttlMinutes} minutes and can be used only once.</p>
      <p style="margin-top: 16px;">If you did not request this, please ignore this email.</p>
    </div>
  `;

  await transporter.sendMail({
    from: smtpConfig.from,
    to: user.user_email,
    subject: "Reset your password",
    text,
    html,
  });
};

const ensureAccountOtpTable = async () => {
  if (accountOtpTableEnsured) {
    return;
  }

  await queryDb(`
    CREATE TABLE IF NOT EXISTS account_otp_requests (
      account_otp_id INT PRIMARY KEY AUTO_INCREMENT,
      challenge_id VARCHAR(64) NOT NULL UNIQUE,
      user_id INT NOT NULL,
      purpose ENUM('email_change', 'password_change') NOT NULL,
      target_email VARCHAR(255) NOT NULL,
      otp_hash VARCHAR(64) NOT NULL,
      attempts_left INT NOT NULL DEFAULT 5,
      expires_at DATETIME NOT NULL,
      consumed_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_account_otp_user_pending (user_id, purpose, consumed_at),
      INDEX idx_account_otp_expires_at (expires_at),
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    )
  `);

  accountOtpTableEnsured = true;
};

const removeStaleAccountOtpRequests = async () => {
  await ensureAccountOtpTable();
  await queryDb(
    `DELETE FROM account_otp_requests
     WHERE consumed_at IS NOT NULL
        OR expires_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 DAY)`,
  );
};

const sendAccountOtpEmail = async ({
  userName,
  destinationEmail,
  otpCode,
  ttlMinutes,
  purpose,
}) => {
  const smtpConfig = getAuthSmtpConfig();
  const transporter = createAuthTransporter();

  const purposeLabel =
    purpose === ACCOUNT_OTP_PURPOSES.EMAIL_CHANGE
      ? "email address change"
      : "password change";

  const text = [
    `Hi ${userName || "User"},`,
    "",
    `Your one-time verification code for ${purposeLabel} is: ${otpCode}`,
    `This code expires in ${ttlMinutes} minutes.`,
    "",
    "If you did not request this, you can safely ignore this email.",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
      <p>Hi ${userName || "User"},</p>
      <p>Your one-time verification code for <strong>${purposeLabel}</strong> is:</p>
      <p style="font-size: 28px; letter-spacing: 6px; font-weight: 700; margin: 8px 0 16px;">${otpCode}</p>
      <p>This code expires in ${ttlMinutes} minutes.</p>
      <p style="margin-top: 16px;">If you did not request this, you can safely ignore this email.</p>
    </div>
  `;

  await transporter.sendMail({
    from: smtpConfig.from,
    to: destinationEmail,
    subject: "Your account verification code",
    text,
    html,
  });
};

const consumeAccountOtpOrThrow = async ({
  userId,
  purpose,
  otpChallengeId,
  otpCode,
  expectedTargetEmail,
}) => {
  const challengeId = String(otpChallengeId || "").trim();
  const otp = String(otpCode || "").trim();

  if (!challengeId || !otp) {
    return {
      ok: false,
      status: 400,
      message: "OTP challenge and code are required",
    };
  }

  if (!/^\d{6}$/.test(otp)) {
    return {
      ok: false,
      status: 400,
      message: "OTP must be a 6-digit code",
    };
  }

  await ensureAccountOtpTable();

  const rows = await queryDb(
    `SELECT account_otp_id,
            challenge_id,
            otp_hash,
            attempts_left,
            expires_at,
            consumed_at,
            target_email
     FROM account_otp_requests
     WHERE challenge_id = ?
       AND user_id = ?
       AND purpose = ?
     LIMIT 1`,
    [challengeId, userId, purpose],
  );

  if (rows.length === 0) {
    return {
      ok: false,
      status: 400,
      message: "Invalid or expired OTP challenge",
    };
  }

  const record = rows[0];
  const now = new Date();

  if (record.consumed_at) {
    return {
      ok: false,
      status: 400,
      message: "This OTP has already been used",
    };
  }

  if (new Date(record.expires_at) <= now) {
    return {
      ok: false,
      status: 400,
      message: "OTP has expired",
    };
  }

  if (String(record.target_email || "").toLowerCase() !== expectedTargetEmail) {
    return {
      ok: false,
      status: 400,
      message: "OTP target email does not match this request",
    };
  }

  if (Number(record.attempts_left) <= 0) {
    return {
      ok: false,
      status: 429,
      message: "Maximum OTP attempts exceeded",
    };
  }

  const hashedOtp = hashOtpCode({ challengeId, otpCode: otp });
  if (hashedOtp !== record.otp_hash) {
    const remainingAttempts = Math.max(Number(record.attempts_left) - 1, 0);
    await queryDb(
      `UPDATE account_otp_requests
       SET attempts_left = ?,
           consumed_at = CASE WHEN ? = 0 THEN CURRENT_TIMESTAMP ELSE consumed_at END
       WHERE account_otp_id = ?`,
      [remainingAttempts, remainingAttempts, record.account_otp_id],
    );

    return {
      ok: false,
      status: 400,
      message: "Invalid OTP",
      attemptsRemaining: remainingAttempts,
    };
  }

  await queryDb(
    `UPDATE account_otp_requests
     SET consumed_at = CURRENT_TIMESTAMP
     WHERE account_otp_id = ?`,
    [record.account_otp_id],
  );

  return { ok: true };
};

const upsertTrustedDevice = async ({
  userId,
  fingerprintHash,
  ipAddress,
  userAgent,
}) => {
  await queryDb(
    `INSERT INTO trusted_login_devices (user_id, fingerprint_hash, ip_address, user_agent)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       ip_address = VALUES(ip_address),
       user_agent = VALUES(user_agent),
       last_seen_at = CURRENT_TIMESTAMP`,
    [userId, fingerprintHash, ipAddress || null, userAgent || null],
  );
};

const updateLastLoginAt = async (userId) => {
  await queryDb(
    `UPDATE users
     SET last_login_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`,
    [userId],
  );
};

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
      return res.status(401).json({ message: GENERIC_LOGIN_ERROR_MESSAGE });
    }

    const user = rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.user_password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: GENERIC_LOGIN_ERROR_MESSAGE });
    }

    if (user.user_status !== "active") {
      return res.status(403).json({ message: "User account is not active" });
    }

    const otpCode = generateOtpCode();
    const otpHash = await bcrypt.hash(otpCode, 10);
    const expiresAt = addMinutes(new Date(), 5);

    await Promise.all([
      removeStaleOtpRequests(),
      upsertOtpStoreRecord({
        userId: user.user_id,
        otpHash,
        expiresAt,
      }),
    ]);

    await sendLoginOtpEmail({
      user,
      otpCode,
      ttlMinutes: 5,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });

    if (req.session) {
      req.session.isOtpVerified = false;
      req.session.pendingOtpUserId = user.user_id;
      req.session.otpUserId = null;
    }

    await revokeRefreshTokenByCookie(req);
    clearAuthCookies(res);

    return res.status(200).json({
      otpRequired: true,
      message: "OTP has been sent to your email",
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Unable to log in right now" });
  }
};

const verifyLoginOtp = async (req, res) => {
  const payload = req.body && typeof req.body === "object" ? req.body : {};
  const otpCode = String(payload.otp || "").trim();

  if (!/^\d{6}$/.test(otpCode)) {
    return res.status(400).json({ message: "OTP must be a 6-digit code" });
  }

  const pendingOtpUserId = Number.parseInt(req.session?.pendingOtpUserId, 10);
  if (!pendingOtpUserId || Number.isNaN(pendingOtpUserId)) {
    return res.status(400).json({ message: "No pending OTP verification" });
  }

  try {
    const [otpRows, userRows] = await Promise.all([
      queryDb(
        `SELECT user_id, otp_hash, expires_at
         FROM otp_store
         WHERE user_id = ?
         LIMIT 1`,
        [pendingOtpUserId],
      ),
      queryDb(
        `SELECT user_id, user_email, user_name, user_role, user_status, user_avatar_url
         FROM users
         WHERE user_id = ?
         LIMIT 1`,
        [pendingOtpUserId],
      ),
    ]);

    if (otpRows.length === 0 || userRows.length === 0) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const otpRecord = otpRows[0];
    const user = userRows[0];

    if (new Date(otpRecord.expires_at) <= new Date()) {
      await removeOtpStoreRecord(pendingOtpUserId);
      return res.status(400).json({ message: "OTP has expired" });
    }

    const isValidOtp = await bcrypt.compare(otpCode, otpRecord.otp_hash);
    if (!isValidOtp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (user.user_status !== "active") {
      return res.status(403).json({ message: "User account is not active" });
    }

    await Promise.all([
      removeOtpStoreRecord(pendingOtpUserId),
      updateLastLoginAt(user.user_id),
      upsertTrustedDevice({
        userId: user.user_id,
        fingerprintHash: buildDeviceFingerprint({
          ipAddress: getClientIp(req),
          userAgent: getUserAgent(req),
        }),
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req),
      }),
    ]);

    if (req.session) {
      req.session.isOtpVerified = true;
      req.session.otpUserId = user.user_id;
      req.session.pendingOtpUserId = null;
    }

    return await issueJwtResponse(res, user, 200);
  } catch (error) {
    console.error("Verify login OTP error:", error);
    return res.status(500).json({ message: "Unable to verify OTP right now" });
  }
};

const refreshToken = async (req, res) => {
  const rawRefreshToken = String(req.cookies?.refreshToken || "").trim();

  if (!rawRefreshToken) {
    return res.status(401).json({ message: "Refresh token is required" });
  }

  try {
    const payload = verifyRefreshToken(rawRefreshToken);
    const refreshUserId = Number.parseInt(payload?.sub, 10);
    const refreshTokenId = String(payload?.jti || "").trim();
    const refreshTokenHash = hashRefreshToken(rawRefreshToken);

    if (!refreshUserId || Number.isNaN(refreshUserId) || !refreshTokenId) {
      clearAuthCookies(res);
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const refreshRows = await queryDb(
      `SELECT token_hash, expires_at, revoked_at
       FROM refresh_token_sessions
       WHERE token_id = ?
       LIMIT 1`,
      [refreshTokenId],
    );

    if (refreshRows.length === 0) {
      clearAuthCookies(res);
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const refreshSession = refreshRows[0];

    if (
      refreshSession.revoked_at ||
      new Date(refreshSession.expires_at) <= new Date() ||
      String(refreshSession.token_hash || "") !== refreshTokenHash
    ) {
      await revokeRefreshTokenSession({ tokenId: refreshTokenId });
      clearAuthCookies(res);
      return res
        .status(401)
        .json({ message: "Invalid or expired refresh token" });
    }

    const rows = await queryDb(
      `SELECT user_id, user_email, user_name, user_role, user_status, user_avatar_url
       FROM users
       WHERE user_id = ?
       LIMIT 1`,
      [refreshUserId],
    );

    if (rows.length === 0) {
      clearAuthCookies(res);
      return res.status(401).json({ message: "Invalid refresh token user" });
    }

    const user = rows[0];

    if (user.user_status !== "active") {
      await revokeRefreshTokenSession({ tokenId: refreshTokenId });
      clearAuthCookies(res);
      return res.status(403).json({ message: "User account is not active" });
    }

    if (req.session) {
      req.session.isOtpVerified = true;
      req.session.otpUserId = user.user_id;
      req.session.pendingOtpUserId = null;
    }

    return await issueJwtResponse(res, user, 200, {
      previousRefreshTokenId: refreshTokenId,
    });
  } catch (error) {
    clearAuthCookies(res);

    if (
      error?.name === "JsonWebTokenError" ||
      error?.name === "TokenExpiredError"
    ) {
      return res
        .status(401)
        .json({ message: "Invalid or expired refresh token" });
    }

    console.error("Refresh token error:", error);
    return res.status(500).json({ message: "Unable to refresh session" });
  }
};

const resendLoginOtp = async (req, res) => {
  const pendingOtpUserId = Number.parseInt(req.session?.pendingOtpUserId, 10);
  if (!pendingOtpUserId || Number.isNaN(pendingOtpUserId)) {
    return res.status(400).json({ message: "No pending OTP verification" });
  }

  try {
    const rows = await queryDb(
      `SELECT user_id, user_email, user_name, user_status
       FROM users
       WHERE user_id = ?
       LIMIT 1`,
      [pendingOtpUserId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = rows[0];
    if (user.user_status !== "active") {
      return res.status(403).json({ message: "User account is not active" });
    }

    const otpCode = generateOtpCode();
    const otpHash = await bcrypt.hash(otpCode, 10);
    const expiresAt = addMinutes(new Date(), 5);

    await upsertOtpStoreRecord({
      userId: user.user_id,
      otpHash,
      expiresAt,
    });

    await sendLoginOtpEmail({
      user,
      otpCode,
      ttlMinutes: 5,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });

    return res
      .status(200)
      .json({ message: "A new OTP has been sent to your email" });
  } catch (error) {
    console.error("Resend login OTP error:", error);
    return res.status(500).json({ message: "Unable to resend OTP right now" });
  }
};

const requestPasswordResetLink = async (req, res) => {
  const payload = req.body && typeof req.body === "object" ? req.body : {};
  const email = String(payload.email || "")
    .trim()
    .toLowerCase();

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ message: "Enter a valid email address" });
  }

  try {
    await removeStalePasswordResetTokens();

    const rows = await queryDb(
      `SELECT user_id, user_email, user_name, user_status
       FROM users
       WHERE user_email = ?
       LIMIT 1`,
      [email],
    );

    // Always return generic success to avoid account enumeration.
    if (rows.length === 0) {
      return res.status(200).json({
        message: PASSWORD_RESET_LINK_SENT_MESSAGE,
      });
    }

    const user = rows[0];
    if (user.user_status !== "active") {
      return res.status(200).json({
        message: PASSWORD_RESET_LINK_SENT_MESSAGE,
      });
    }

    const resetToken = generatePasswordResetToken();
    const resetTokenHash = hashPasswordResetToken(resetToken);
    const ttlMinutes = getPasswordResetTtlMinutes();
    const expiresAt = addMinutes(new Date(), ttlMinutes);
    const resetLink = buildPasswordResetLink(resetToken);

    await persistPasswordResetToken({
      userId: user.user_id,
      tokenHash: resetTokenHash,
      expiresAt,
    });

    await sendPasswordResetLinkEmail({ user, resetLink, ttlMinutes });

    return res.status(200).json({
      message: PASSWORD_RESET_LINK_SENT_MESSAGE,
    });
  } catch (error) {
    console.error("Request password reset link error:", error);
    return res
      .status(500)
      .json({ message: "Unable to send reset link right now" });
  }
};

const validatePasswordResetToken = async (req, res) => {
  const payload = req.body && typeof req.body === "object" ? req.body : {};
  const token = String(payload.token || "").trim();

  if (!token) {
    return res.status(400).json({ message: "Reset token is required" });
  }

  try {
    await ensurePasswordResetTokenTable();

    const rows = await queryDb(
      `SELECT password_reset_token_id, expires_at, used_at
       FROM password_reset_tokens
       WHERE token_hash = ?
       LIMIT 1`,
      [hashPasswordResetToken(token)],
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: "Invalid or expired reset link" });
    }

    const tokenRecord = rows[0];
    if (tokenRecord.used_at || new Date(tokenRecord.expires_at) <= new Date()) {
      return res.status(400).json({ message: "Invalid or expired reset link" });
    }

    return res.status(200).json({ message: "Reset token is valid" });
  } catch (error) {
    console.error("Validate password reset token error:", error);
    return res
      .status(500)
      .json({ message: "Unable to validate reset link right now" });
  }
};

const resetPasswordWithToken = async (req, res) => {
  const payload = req.body && typeof req.body === "object" ? req.body : {};
  const token = String(payload.token || "").trim();
  const newPassword = String(payload.newPassword || "").trim();

  if (!token) {
    return res.status(400).json({ message: "Reset token is required" });
  }

  if (!newPassword || newPassword.length < 8) {
    return res
      .status(400)
      .json({ message: "New password must be at least 8 characters" });
  }

  try {
    await ensurePasswordResetTokenTable();

    const rows = await queryDb(
      `SELECT prt.password_reset_token_id,
              prt.expires_at,
              prt.used_at,
              u.user_id,
              u.user_password,
              u.user_status
       FROM password_reset_tokens prt
       INNER JOIN users u ON u.user_id = prt.user_id
       WHERE prt.token_hash = ?
       LIMIT 1`,
      [hashPasswordResetToken(token)],
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: "Invalid or expired reset link" });
    }

    const user = rows[0];

    if (user.used_at || new Date(user.expires_at) <= new Date()) {
      return res.status(400).json({ message: "Invalid or expired reset link" });
    }

    if (user.user_status !== "active") {
      return res.status(403).json({ message: "User account is not active" });
    }

    const isSamePassword = await bcrypt.compare(
      newPassword,
      user.user_password,
    );
    if (isSamePassword) {
      return res.status(400).json({
        message: "New password must be different from current password",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await queryDb(
      `UPDATE users
       SET user_password = ?
       WHERE user_id = ?`,
      [hashedPassword, user.user_id],
    );

    await queryDb(
      `UPDATE password_reset_tokens
       SET used_at = CURRENT_TIMESTAMP
       WHERE password_reset_token_id = ?`,
      [user.password_reset_token_id],
    );

    await Promise.all([
      removeOtpStoreRecord(user.user_id),
      revokeAllRefreshSessionsForUser(user.user_id),
    ]);

    return res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Reset password with token error:", error);
    return res
      .status(500)
      .json({ message: "Unable to reset password right now" });
  }
};

const me = async (req, res) => {
  try {
    const rows = await queryDb(
      `SELECT user_id, user_email, user_name, user_role, user_status, user_avatar_url
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

const verifyToken = async (req, res) => {
  return res.status(200).json({
    message: "Token is valid",
    user: req.user,
  });
};

const logout = async (req, res) => {
  try {
    await revokeRefreshTokenByCookie(req);
  } catch (error) {
    console.error("Logout refresh token revoke error:", error);
  }

  clearAuthCookies(res);
  res.clearCookie("ems.sid", { path: "/" });

  if (!req.session) {
    return res.status(200).json({ message: "Logged out successfully" });
  }

  req.session.destroy((error) => {
    if (error) {
      console.error("Logout error:", error);
      return res.status(500).json({ message: "Unable to log out right now" });
    }

    return res.status(200).json({ message: "Logged out successfully" });
  });
};

const requestAccountOtp = async (req, res) => {
  const payload = req.body && typeof req.body === "object" ? req.body : {};
  const purpose = String(payload.purpose || "").trim();
  const requestedEmail = String(payload.email || "")
    .trim()
    .toLowerCase();

  if (purpose !== ACCOUNT_OTP_PURPOSES.EMAIL_CHANGE) {
    return res.status(400).json({ message: "Invalid OTP purpose" });
  }

  try {
    const rows = await queryDb(
      `SELECT user_id, user_email, user_name
       FROM users
       WHERE user_id = ?
       LIMIT 1`,
      [req.user.userId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const currentUser = rows[0];
    const currentEmail = String(currentUser.user_email || "").toLowerCase();
    const targetEmail = requestedEmail;

    if (!targetEmail) {
      return res.status(400).json({ message: "New email is required" });
    }

    if (!isValidEmail(targetEmail)) {
      return res.status(400).json({ message: "Enter a valid email address" });
    }

    if (targetEmail === currentEmail) {
      return res
        .status(400)
        .json({ message: "Please enter a different email" });
    }

    const emailConflict = await queryDb(
      `SELECT user_id
       FROM users
       WHERE user_email = ? AND user_id <> ?
       LIMIT 1`,
      [targetEmail, req.user.userId],
    );

    if (emailConflict.length > 0) {
      return res.status(409).json({ message: "Email is already in use" });
    }

    await removeStaleAccountOtpRequests();

    const challengeId = generateChallengeId();
    const otpCode = generateOtpCode();
    const otpHash = hashOtpCode({ challengeId, otpCode });
    const ttlMinutes = getOtpTtlMinutes();
    const maxAttempts = getOtpMaxAttempts();
    const expiresAt = addMinutes(new Date(), ttlMinutes);

    await queryDb(
      `INSERT INTO account_otp_requests
       (challenge_id, user_id, purpose, target_email, otp_hash, attempts_left, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        challengeId,
        req.user.userId,
        purpose,
        targetEmail,
        otpHash,
        maxAttempts,
        expiresAt,
      ],
    );

    await sendAccountOtpEmail({
      userName: currentUser.user_name,
      destinationEmail: targetEmail,
      otpCode,
      ttlMinutes,
      purpose,
    });

    return res.status(200).json({
      message: `OTP sent to ${targetEmail}`,
      challengeId,
      expiresInSeconds: ttlMinutes * 60,
    });
  } catch (error) {
    console.error("Request account OTP error:", error);
    return res.status(500).json({ message: "Unable to send OTP right now" });
  }
};

const updateProfile = async (req, res) => {
  const payload = req.body && typeof req.body === "object" ? req.body : {};
  const name = payload.name?.trim();
  const email = payload.email?.trim().toLowerCase();
  const otpChallengeId = payload.otpChallengeId;
  const otp = payload.otp;

  if (!name || !email) {
    return res.status(400).json({ message: "Name and email are required" });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: "Enter a valid email address" });
  }

  try {
    const currentUserRows = await queryDb(
      `SELECT user_id, user_email
       FROM users
       WHERE user_id = ?
       LIMIT 1`,
      [req.user.userId],
    );

    if (currentUserRows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const currentEmail = String(
      currentUserRows[0].user_email || "",
    ).toLowerCase();
    const isEmailChanged = email !== currentEmail;

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

    if (isEmailChanged) {
      const otpCheck = await consumeAccountOtpOrThrow({
        userId: req.user.userId,
        purpose: ACCOUNT_OTP_PURPOSES.EMAIL_CHANGE,
        otpChallengeId,
        otpCode: otp,
        expectedTargetEmail: email,
      });

      if (!otpCheck.ok) {
        return res.status(otpCheck.status).json({
          message: otpCheck.message,
          attemptsRemaining: otpCheck.attemptsRemaining,
        });
      }
    }

    await queryDb(
      `UPDATE users
       SET user_name = ?, user_email = ?
       WHERE user_id = ?`,
      [name, email, req.user.userId],
    );

    const rows = await queryDb(
      `SELECT user_id, user_email, user_name, user_role, user_status, user_avatar_url
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
  const currentPassword = String(payload.currentPassword ?? "");
  const newPassword = String(payload.newPassword ?? "");

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      message: "Old password and new password are required",
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
      return res.status(400).json({ message: "Old password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await queryDb(
      `UPDATE users
       SET user_password = ?
       WHERE user_id = ?`,
      [hashedPassword, req.user.userId],
    );

    await Promise.all([
      revokeAllRefreshSessionsForUser(req.user.userId),
      removeOtpStoreRecord(req.user.userId),
    ]);

    clearAuthCookies(res);
    res.clearCookie("ems.sid", { path: "/" });

    if (req.session) {
      req.session.isOtpVerified = false;
      req.session.otpUserId = null;
      req.session.pendingOtpUserId = null;
    }

    return res.status(200).json({
      message: "Password changed successfully. Please log in again",
      forceRelogin: true,
    });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ message: "Unable to change password" });
  }
};

const uploadProfileAvatar = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Please upload an image file" });
  }

  try {
    const userRows = await queryDb(
      `SELECT user_id, user_email, user_name, user_role, user_status, user_avatar_url
       FROM users
       WHERE user_id = ?
       LIMIT 1`,
      [req.user.userId],
    );

    if (userRows.length === 0) {
      await removeAvatarFileIfExists(req.file.path);
      return res.status(404).json({ message: "User not found" });
    }

    const currentUser = userRows[0];
    const nextAvatarPath = String(req.file.path || "").replace(/\\/g, "/");

    await queryDb(
      `UPDATE users
       SET user_avatar_url = ?
       WHERE user_id = ?`,
      [nextAvatarPath, req.user.userId],
    );

    if (currentUser.user_avatar_url) {
      await removeAvatarFileIfExists(currentUser.user_avatar_url);
    }

    const updatedRows = await queryDb(
      `SELECT user_id, user_email, user_name, user_role, user_status, user_avatar_url
       FROM users
       WHERE user_id = ?
       LIMIT 1`,
      [req.user.userId],
    );

    if (updatedRows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "Profile picture updated successfully",
      avatarPath: toPublicAvatarPath(updatedRows[0].user_avatar_url),
      user: formatUser(updatedRows[0]),
    });
  } catch (error) {
    await removeAvatarFileIfExists(req.file.path);
    console.error("Upload profile avatar error:", error);
    return res
      .status(500)
      .json({ message: "Unable to upload profile picture" });
  }
};

const removeProfileAvatar = async (req, res) => {
  try {
    const rows = await queryDb(
      `SELECT user_id, user_email, user_name, user_role, user_status, user_avatar_url
       FROM users
       WHERE user_id = ?
       LIMIT 1`,
      [req.user.userId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const currentUser = rows[0];

    await queryDb(
      `UPDATE users
       SET user_avatar_url = NULL
       WHERE user_id = ?`,
      [req.user.userId],
    );

    if (currentUser.user_avatar_url) {
      await removeAvatarFileIfExists(currentUser.user_avatar_url);
    }

    const updatedRows = await queryDb(
      `SELECT user_id, user_email, user_name, user_role, user_status, user_avatar_url
       FROM users
       WHERE user_id = ?
       LIMIT 1`,
      [req.user.userId],
    );

    if (updatedRows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "Profile picture removed successfully",
      user: formatUser(updatedRows[0]),
    });
  } catch (error) {
    console.error("Remove profile avatar error:", error);
    return res
      .status(500)
      .json({ message: "Unable to remove profile picture" });
  }
};

const getSmtpConfig = async (req, res) => {
  try {
    const smtpConfig = await getResolvedSmtpConfig();

    return res.status(200).json({
      emailProvider: inferEmailProvider(smtpConfig.host),
      smtpServer: smtpConfig.host,
      smtpPort: smtpConfig.port,
      smtpSecure: smtpConfig.secure,
      usernameEmail: smtpConfig.user,
      password: smtpConfig.pass,
      senderName: smtpConfig.senderName,
      senderEmail: smtpConfig.senderEmail,
      replyToEmail: smtpConfig.replyTo || "",
      source: smtpConfig.source,
    });
  } catch (error) {
    console.error("Fetch SMTP config error:", error);
    return res
      .status(500)
      .json({ message: "Unable to load SMTP configuration" });
  }
};

const updateSmtpConfig = async (req, res) => {
  const payload = req.body && typeof req.body === "object" ? req.body : {};
  const smtpServer = String(payload.smtpServer || "").trim();
  const smtpPort = String(payload.smtpPort || "").trim();
  const usernameEmail = String(payload.usernameEmail || "")
    .trim()
    .toLowerCase();
  const password = String(payload.password || "").trim();
  const senderName = String(payload.senderName || "").trim();
  const senderEmail = String(payload.senderEmail || "")
    .trim()
    .toLowerCase();
  const replyToEmail = String(payload.replyToEmail || "")
    .trim()
    .toLowerCase();
  const smtpSecure = parseBoolean(payload.smtpSecure, smtpPort === "465");

  if (!smtpServer || !smtpPort || !usernameEmail || !password || !senderName) {
    return res.status(400).json({
      message:
        "SMTP server, port, username, password, and sender name are required",
    });
  }

  const portNumber = Number.parseInt(smtpPort, 10);
  if (Number.isNaN(portNumber) || portNumber <= 0 || portNumber > 65535) {
    return res.status(400).json({ message: "Enter a valid SMTP port" });
  }

  if (!isValidEmail(usernameEmail)) {
    return res
      .status(400)
      .json({ message: "Enter a valid username email address" });
  }

  if (senderEmail && !isValidEmail(senderEmail)) {
    return res
      .status(400)
      .json({ message: "Enter a valid sender email address" });
  }

  if (replyToEmail && !isValidEmail(replyToEmail)) {
    return res
      .status(400)
      .json({ message: "Enter a valid reply-to email address" });
  }

  try {
    await saveSmtpConfig({
      smtpHost: smtpServer,
      smtpPort,
      smtpSecure,
      smtpUser: usernameEmail,
      smtpPass: password,
      senderName,
      senderEmail: senderEmail || usernameEmail,
      replyToEmail: replyToEmail || senderEmail || usernameEmail,
      updatedBy: req.user?.userId || null,
    });

    const smtpConfig = await getResolvedSmtpConfig();

    return res.status(200).json({
      message: "SMTP configuration updated successfully",
      config: {
        emailProvider: inferEmailProvider(smtpConfig.host),
        smtpServer: smtpConfig.host,
        smtpPort: smtpConfig.port,
        smtpSecure: smtpConfig.secure,
        usernameEmail: smtpConfig.user,
        password: smtpConfig.pass,
        senderName: smtpConfig.senderName,
        senderEmail: smtpConfig.senderEmail,
        replyToEmail: smtpConfig.replyTo || "",
        source: smtpConfig.source,
      },
    });
  } catch (error) {
    console.error("Update SMTP config error:", error);
    return res
      .status(500)
      .json({ message: "Unable to update SMTP configuration" });
  }
};

export default {
  login,
  verifyLoginOtp,
  refreshToken,
  resendLoginOtp,
  requestPasswordResetLink,
  validatePasswordResetToken,
  resetPasswordWithToken,
  logout,
  requestAccountOtp,
  verifyToken,
  me,
  updateProfile,
  uploadProfileAvatar,
  removeProfileAvatar,
  changePassword,
  getSmtpConfig,
  updateSmtpConfig,
};
