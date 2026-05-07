import crypto from "crypto";

const DEFAULT_OTP_TTL_MINUTES = 10;
const DEFAULT_OTP_MAX_ATTEMPTS = 5;
const DEFAULT_OTP_RESEND_COOLDOWN_SECONDS = 60;
const DEFAULT_OTP_MAX_RESENDS = 3;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const normalizeIpAddress = (rawIp) => {
  const ip = String(rawIp || "").trim();
  if (!ip) {
    return "";
  }

  if (ip.startsWith("::ffff:")) {
    return ip.slice(7);
  }

  return ip;
};

const getClientIp = (req) => {
  const forwardedFor = String(req.headers["x-forwarded-for"] || "").trim();
  if (forwardedFor) {
    const [firstIp] = forwardedFor.split(",");
    return normalizeIpAddress(firstIp);
  }

  return normalizeIpAddress(req.socket?.remoteAddress || req.ip);
};

const getUserAgent = (req) => {
  return String(req.headers["user-agent"] || "")
    .trim()
    .slice(0, 500);
};

const buildDeviceFingerprint = ({ ipAddress, userAgent }) => {
  const normalizedIp = String(ipAddress || "")
    .trim()
    .toLowerCase();
  const normalizedUserAgent = String(userAgent || "")
    .trim()
    .toLowerCase();

  return crypto
    .createHash("sha256")
    .update(`${normalizedIp}|${normalizedUserAgent}`)
    .digest("hex");
};

const generateOtpCode = () => {
  const randomNumber = crypto.randomInt(0, 1_000_000);
  return String(randomNumber).padStart(6, "0");
};

const getOtpHashSecret = () => {
  const secret = String(
    process.env.OTP_HASH_SECRET || process.env.JWT_SECRET || "",
  ).trim();

  if (!secret) {
    throw new Error("OTP_HASH_SECRET or JWT_SECRET must be configured");
  }

  return secret;
};

const hashOtpCode = ({ challengeId, otpCode }) => {
  const secret = getOtpHashSecret();
  return crypto
    .createHash("sha256")
    .update(`${challengeId}|${otpCode}|${secret}`)
    .digest("hex");
};

const generateChallengeId = () => crypto.randomBytes(32).toString("hex");

const getOtpTtlMinutes = () => {
  const parsed = Number.parseInt(process.env.LOGIN_OTP_TTL_MINUTES || "", 10);
  if (Number.isNaN(parsed)) {
    return DEFAULT_OTP_TTL_MINUTES;
  }
  return clamp(parsed, 5, 10);
};

const getOtpMaxAttempts = () => {
  const parsed = Number.parseInt(process.env.LOGIN_OTP_MAX_ATTEMPTS || "", 10);
  if (Number.isNaN(parsed)) {
    return DEFAULT_OTP_MAX_ATTEMPTS;
  }
  return clamp(parsed, 3, 10);
};

const getOtpResendCooldownSeconds = () => {
  const parsed = Number.parseInt(
    process.env.LOGIN_OTP_RESEND_COOLDOWN_SECONDS || "",
    10,
  );

  if (Number.isNaN(parsed)) {
    return DEFAULT_OTP_RESEND_COOLDOWN_SECONDS;
  }

  return clamp(parsed, 30, 300);
};

const getOtpMaxResends = () => {
  const parsed = Number.parseInt(process.env.LOGIN_OTP_MAX_RESENDS || "", 10);

  if (Number.isNaN(parsed)) {
    return DEFAULT_OTP_MAX_RESENDS;
  }

  return clamp(parsed, 1, 10);
};

const addSeconds = (date, seconds) => new Date(date.getTime() + seconds * 1000);
const addMinutes = (date, minutes) =>
  new Date(date.getTime() + minutes * 60 * 1000);

export {
  getClientIp,
  getUserAgent,
  buildDeviceFingerprint,
  generateOtpCode,
  hashOtpCode,
  generateChallengeId,
  getOtpTtlMinutes,
  getOtpMaxAttempts,
  getOtpResendCooldownSeconds,
  getOtpMaxResends,
  addSeconds,
  addMinutes,
};
