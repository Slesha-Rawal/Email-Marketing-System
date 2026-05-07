import { queryDb } from "./db.js";

const DEFAULT_SMTP_PORT = "587";

const normalize = (value = "") => String(value || "").trim();

const parseBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
};

const parseFromAddress = (rawFrom = "") => {
  const source = normalize(rawFrom);
  if (!source) {
    return { senderName: "", senderEmail: "" };
  }

  const match = source.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (match) {
    return {
      senderName: normalize(match[1]),
      senderEmail: normalize(match[2]).toLowerCase(),
    };
  }

  return { senderName: "", senderEmail: source.toLowerCase() };
};

const buildFromAddress = ({
  senderName = "",
  senderEmail = "",
  fallbackEmail = "",
}) => {
  const normalizedSenderName = normalize(senderName);
  const normalizedSenderEmail = normalize(senderEmail).toLowerCase();
  const normalizedFallbackEmail = normalize(fallbackEmail).toLowerCase();
  const finalEmail = normalizedSenderEmail || normalizedFallbackEmail;

  if (!finalEmail) {
    return "";
  }

  if (!normalizedSenderName) {
    return finalEmail;
  }

  return `"${normalizedSenderName}" <${finalEmail}>`;
};

const ensureSmtpSettingsTable = async () => {
  await queryDb(
    `CREATE TABLE IF NOT EXISTS smtp_settings (
       settings_id TINYINT PRIMARY KEY,
       smtp_host VARCHAR(255) NOT NULL,
       smtp_port VARCHAR(10) NOT NULL DEFAULT '587',
       smtp_secure TINYINT(1) NOT NULL DEFAULT 0,
       smtp_user VARCHAR(255) NOT NULL,
       smtp_pass VARCHAR(255) NOT NULL,
       smtp_from VARCHAR(500) NOT NULL,
       sender_name VARCHAR(255) NOT NULL DEFAULT '',
       sender_email VARCHAR(255) NOT NULL DEFAULT '',
      reply_to_email VARCHAR(255) NULL,
       updated_by INT NULL,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
       CONSTRAINT chk_smtp_settings_singleton CHECK (settings_id = 1),
       FOREIGN KEY (updated_by) REFERENCES users(user_id) ON DELETE SET NULL
     )`,
  );

  await queryDb(
    `ALTER TABLE smtp_settings
     ADD COLUMN reply_to_email VARCHAR(255) NULL`,
  ).catch(() => {
    // Ignore when the column already exists.
  });
};

const readSmtpSettingsFromDb = async () => {
  await ensureSmtpSettingsTable();

  const rows = await queryDb(
    `SELECT settings_id, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass,
            smtp_from, sender_name, sender_email, reply_to_email
     FROM smtp_settings
     WHERE settings_id = 1
     LIMIT 1`,
  );

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  const parsedFrom = parseFromAddress(row.smtp_from);
  const smtpUser = normalize(row.smtp_user);
  const senderEmail =
    normalize(row.sender_email).toLowerCase() ||
    parsedFrom.senderEmail ||
    smtpUser.toLowerCase();
  const senderName = normalize(row.sender_name) || parsedFrom.senderName;
  const replyTo = normalize(row.reply_to_email).toLowerCase();

  return {
    host: normalize(row.smtp_host),
    port: normalize(row.smtp_port) || DEFAULT_SMTP_PORT,
    secure: parseBoolean(row.smtp_secure, false),
    user: smtpUser,
    pass: normalize(row.smtp_pass),
    senderName,
    senderEmail,
    from:
      normalize(row.smtp_from) ||
      buildFromAddress({
        senderName,
        senderEmail,
        fallbackEmail: smtpUser,
      }),
    replyTo: replyTo || senderEmail || smtpUser.toLowerCase(),
    source: "database",
  };
};

const readSmtpSettingsFromEnv = () => {
  const host = normalize(process.env.SMTP_HOST);
  const port = normalize(process.env.SMTP_PORT) || DEFAULT_SMTP_PORT;
  const secure = parseBoolean(process.env.SMTP_SECURE, false);
  const user = normalize(process.env.SMTP_USER);
  const pass = normalize(process.env.SMTP_PASS);
  const rawFrom = normalize(process.env.SMTP_FROM);
  const parsedFrom = parseFromAddress(rawFrom);
  const rawReplyTo = normalize(process.env.SMTP_REPLY_TO).toLowerCase();
  const senderName = parsedFrom.senderName;
  const senderEmail = parsedFrom.senderEmail || user.toLowerCase();
  const from =
    rawFrom ||
    buildFromAddress({
      senderName,
      senderEmail,
      fallbackEmail: user,
    });

  return {
    host,
    port,
    secure,
    user,
    pass,
    senderName,
    senderEmail,
    from,
    replyTo: rawReplyTo || senderEmail || user.toLowerCase(),
    source: "environment",
  };
};

const getResolvedSmtpConfig = async () => {
  const dbConfig = await readSmtpSettingsFromDb();
  if (!dbConfig) {
    throw new Error(
      "SMTP configuration not found. Please configure SMTP settings in the Settings page.",
    );
  }
  return dbConfig;
};

const getSmtpConfigFromEnv = () => readSmtpSettingsFromEnv();

const saveSmtpConfig = async ({
  smtpHost,
  smtpPort,
  smtpSecure,
  smtpUser,
  smtpPass,
  senderName,
  senderEmail,
  replyToEmail,
  updatedBy,
}) => {
  await ensureSmtpSettingsTable();

  const normalizedUser = normalize(smtpUser).toLowerCase();
  const normalizedSenderEmail =
    normalize(senderEmail).toLowerCase() || normalizedUser;
  const normalizedReplyToEmail =
    normalize(replyToEmail).toLowerCase() || normalizedSenderEmail;
  const normalizedSenderName = normalize(senderName);
  const fromAddress = buildFromAddress({
    senderName: normalizedSenderName,
    senderEmail: normalizedSenderEmail,
    fallbackEmail: normalizedUser,
  });

  await queryDb(
    `INSERT INTO smtp_settings (
       settings_id,
       smtp_host,
       smtp_port,
       smtp_secure,
       smtp_user,
       smtp_pass,
       smtp_from,
       sender_name,
       sender_email,
       reply_to_email,
       updated_by
     ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       smtp_host = VALUES(smtp_host),
       smtp_port = VALUES(smtp_port),
       smtp_secure = VALUES(smtp_secure),
       smtp_user = VALUES(smtp_user),
       smtp_pass = VALUES(smtp_pass),
       smtp_from = VALUES(smtp_from),
       sender_name = VALUES(sender_name),
       sender_email = VALUES(sender_email),
       reply_to_email = VALUES(reply_to_email),
       updated_by = VALUES(updated_by)`,
    [
      normalize(smtpHost),
      normalize(smtpPort) || DEFAULT_SMTP_PORT,
      parseBoolean(smtpSecure, false) ? 1 : 0,
      normalizedUser,
      normalize(smtpPass),
      fromAddress,
      normalizedSenderName,
      normalizedSenderEmail,
      normalizedReplyToEmail,
      updatedBy || null,
    ],
  );
};

export {
  getResolvedSmtpConfig,
  getSmtpConfigFromEnv,
  saveSmtpConfig,
  parseBoolean,
  parseFromAddress,
};
