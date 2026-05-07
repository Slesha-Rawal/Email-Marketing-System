import { queryDb } from "../utils/db.js";
import cron from "node-cron";
import nodemailer from "nodemailer";
import { randomUUID } from "crypto";
import { getResolvedSmtpConfig } from "../utils/smtpConfigStore.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAILS_PER_HOUR = 10;
const EMAILS_PER_DAY = 50;
const TRACKED_SENT_STATUSES = ["sent", "delivered", "opened", "clicked"];
const UNSUBSCRIBE_FEEDBACK_REASONS = new Set([
  "great",
  "good",
  "needs_improvement",
  "too_frequent",
  "not_relevant",
  "never_subscribed",
  "spam",
  "other",
]);

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

const normalizeCampaign = (payload) => ({
  campaign_name: payload.campaign_name?.trim(),
  campaign_subject: payload.campaign_subject?.trim(),
  campaign_body: payload.campaign_body?.trim() || null,
  template_id: payload.template_id || null,
  contact_segment: payload.contact_segment?.trim() || "all",
  bcc_segment:
    normalizeBccSegment(
      payload.bcc_segment || payload.bccEmail || payload.bcc_email,
    ) || null,
  campaign_status: payload.campaign_status || "draft",
  scheduled_date: payload.scheduled_date || null,
});

const validateCampaign = (campaign) => {
  if (!campaign.campaign_name || !campaign.campaign_subject) {
    return "Campaign name and subject are required";
  }

  if (campaign.campaign_status === "scheduled") {
    if (!campaign.scheduled_date) {
      return "Scheduled date is required for scheduled campaigns";
    }

    const scheduledAt = new Date(campaign.scheduled_date);
    if (Number.isNaN(scheduledAt.getTime())) {
      return "Scheduled date is invalid";
    }

    if (scheduledAt.getTime() < Date.now()) {
      return "Scheduled date must be in the future";
    }
  }

  return null;
};

const getOrCreateContactByEmail = async (email) => {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();

  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    return null;
  }

  try {
    const existingRows = await queryDb(
      "SELECT contact_id, contact_status FROM contacts WHERE contact_email = ? LIMIT 1",
      [normalizedEmail],
    );

    if (existingRows.length > 0) {
      const contact = existingRows[0];
      if (contact.contact_status !== "unsubscribed") {
        await queryDb(
          "UPDATE contacts SET contact_status = 'unsubscribed', unsubscribe_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE contact_id = ?",
          [contact.contact_id],
        );
      }
      return contact;
    }

    const contactName = normalizedEmail.split("@")[0] || "Recipient";

    try {
      await queryDb(
        "INSERT INTO contacts (contact_name, contact_email, contact_status, unsubscribe_date) VALUES (?, ?, 'unsubscribed', CURRENT_TIMESTAMP)",
        [contactName.substring(0, 255), normalizedEmail],
      );
    } catch (insertError) {
      if (insertError.code === "ER_DUP_ENTRY") {
        const retryRows = await queryDb(
          "SELECT contact_id, contact_status FROM contacts WHERE contact_email = ? LIMIT 1",
          [normalizedEmail],
        );
        return retryRows[0] || null;
      }
      throw insertError;
    }

    const createdRows = await queryDb(
      "SELECT contact_id, contact_status FROM contacts WHERE contact_email = ? LIMIT 1",
      [normalizedEmail],
    );
    return createdRows[0] || null;
  } catch (error) {
    console.error("[getOrCreateContactByEmail] Error:", error);
    return null;
  }
};

const getRecipientContacts = async (contactSegment) => {
  const normalizedSegment = String(contactSegment || "")
    .trim()
    .toLowerCase();

  if (
    !normalizedSegment ||
    normalizedSegment === "all" ||
    normalizedSegment === "active" ||
    normalizedSegment === "all contacts" ||
    normalizedSegment === "active contacts"
  ) {
    return queryDb(
      `SELECT contact_id, contact_name, contact_email
       FROM contacts
       WHERE contact_status = 'active'
       ORDER BY contact_id ASC`,
    );
  }

  if (normalizedSegment === "unsubscribed") {
    return queryDb(
      `SELECT contact_id, contact_name, contact_email
       FROM contacts
       WHERE contact_status = 'unsubscribed'
       ORDER BY contact_id ASC`,
    );
  }

  if (normalizedSegment.startsWith("group:")) {
    const groupId = Number.parseInt(
      normalizedSegment.replace("group:", ""),
      10,
    );

    if (!groupId || Number.isNaN(groupId)) {
      return [];
    }

    return queryDb(
      `SELECT c.contact_id, c.contact_name, c.contact_email
       FROM contact_group_members cgm
       INNER JOIN contacts c ON c.contact_id = cgm.contact_id
       WHERE cgm.group_id = ? AND c.contact_status = 'active'
       ORDER BY c.contact_id ASC`,
      [groupId],
    );
  }

  if (normalizedSegment.startsWith("ids:")) {
    const contactIds = normalizedSegment
      .replace("ids:", "")
      .split(",")
      .map((id) => Number.parseInt(id.trim(), 10))
      .filter((id) => !Number.isNaN(id));

    if (contactIds.length === 0) {
      return [];
    }

    return queryDb(
      `SELECT contact_id, contact_name, contact_email
       FROM contacts
       WHERE contact_id IN (?) AND contact_status = 'active'
       ORDER BY FIELD(contact_id, ?)`,
      [contactIds, contactIds],
    );
  }

  // Backward compatibility: older records may store raw group names as segment.
  const groupRows = await queryDb(
    `SELECT group_id
     FROM contact_groups
     WHERE LOWER(TRIM(group_name)) = ?
     LIMIT 1`,
    [normalizedSegment],
  );

  if (groupRows.length > 0) {
    const groupId = Number.parseInt(groupRows[0].group_id, 10);
    if (!Number.isNaN(groupId) && groupId > 0) {
      return queryDb(
        `SELECT c.contact_id, c.contact_name, c.contact_email
         FROM contact_group_members cgm
         INNER JOIN contacts c ON c.contact_id = cgm.contact_id
         WHERE cgm.group_id = ? AND c.contact_status = 'active'
         ORDER BY c.contact_id ASC`,
        [groupId],
      );
    }
  }

  return [];
};

const ensureSmtpConfigured = (smtpConfig) => {
  const requiredKeys = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"];
  const missingKeys = requiredKeys.filter(
    (key) =>
      !String(
        smtpConfig?.[key.replace("SMTP_", "").toLowerCase()] || "",
      ).trim(),
  );

  if (missingKeys.length > 0) {
    return `Email delivery is not configured. Missing: ${missingKeys.join(", ")}`;
  }

  return null;
};

const createTransporter = (smtpConfig) => {
  const port = Number.parseInt(smtpConfig.port || "587", 10);

  return nodemailer.createTransport({
    host: smtpConfig.host,
    port: Number.isNaN(port) ? 587 : port,
    secure: smtpConfig.secure === true,
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass,
    },
  });
};

const TRACKING_PIXEL_GIF = Buffer.from(
  "R0lGODlhAQABAPAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==",
  "base64",
);

const getTrackingBaseUrl = () => {
  const rawBaseUrl =
    process.env.TRACK_BASE_URL ||
    process.env.APP_BASE_URL ||
    "http://localhost:3001";

  return rawBaseUrl.replace(/\/+$/, "");
};

const getFrontendBaseUrl = () => {
  const rawBaseUrl =
    process.env.FRONTEND_BASE_URL ||
    process.env.WEB_BASE_URL ||
    "http://localhost:5173";

  return rawBaseUrl.replace(/\/+$/, "");
};

const isTrackableHttpUrl = (value = "") => {
  const trimmedValue = String(value || "").trim();
  return /^https?:\/\//i.test(trimmedValue);
};

const rewriteLinksForTracking = (html = "", trackingId, baseUrl) => {
  if (!trackingId || !baseUrl) {
    return html;
  }

  const linkRegex = /<a\b([^>]*?)href\s*=\s*(["'])(.*?)\2([^>]*)>/gi;

  return String(html).replace(
    linkRegex,
    (
      fullMatch,
      beforeHref = "",
      quote = '"',
      hrefValue = "",
      afterHref = "",
    ) => {
      const cleanedHref = String(hrefValue || "").trim();

      if (!isTrackableHttpUrl(cleanedHref)) {
        return fullMatch;
      }

      const trackedUrl = `${baseUrl}/api/campaigns/track/click/${encodeURIComponent(trackingId)}?url=${encodeURIComponent(cleanedHref)}`;

      return `<a${beforeHref}href=${quote}${trackedUrl}${quote}${afterHref}>`;
    },
  );
};

const trackEvent = async (
  campaignEmailId,
  eventType,
  req,
  eventData = null,
) => {
  await queryDb(
    `INSERT INTO email_events (
       campaign_email_id,
       event_type,
       event_data,
       ip_address,
       user_agent
     ) VALUES (?, ?, ?, ?, ?)`,
    [
      campaignEmailId,
      eventType,
      eventData,
      req.ip || null,
      req.get("user-agent") || null,
    ],
  );
};

const sanitizeAttribute = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const stripHtml = (html = "") =>
  String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const addInlineStyleToTag = (html, tagName, inlineStyle) => {
  const tagRegex = new RegExp(`<${tagName}(\\s[^>]*)?>`, "gi");

  return html.replace(tagRegex, (match, attrs = "") => {
    const styleMatch = attrs.match(/style\s*=\s*(["'])([\s\S]*?)\1/i);

    if (styleMatch) {
      const mergedStyle = `${styleMatch[2].trim()} ${inlineStyle}`.trim();
      return match.replace(styleMatch[0], `style="${mergedStyle}"`);
    }

    return `<${tagName}${attrs} style="${inlineStyle}">`;
  });
};

const normalizeEmailBodyHtml = (body = "") => {
  const raw = String(body || "").trim();

  if (!raw) {
    return "<p>Hello,</p><p>This is your campaign update.</p>";
  }

  // Support older plain-text templates by converting lines to paragraphs.
  const hasHtmlTag = /<\/?[a-z][\s\S]*>/i.test(raw);
  if (!hasHtmlTag) {
    return raw
      .split(/\r?\n\r?\n/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map(
        (block) =>
          `<p>${sanitizeAttribute(block).replace(/\r?\n/g, "<br/>")}</p>`,
      )
      .join("");
  }

  return raw;
};

const applyTemplateVariables = (content = "", variables = {}) => {
  let output = String(content || "");

  Object.entries(variables).forEach(([key, value]) => {
    const safeValue = String(value ?? "");
    const escapedKey = String(key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Support only {{name}}-style merge tags with optional spaces.
    const tokenPattern = new RegExp(`\\{\\{\\s*${escapedKey}\\s*\\}\\}`, "gi");
    output = output.replace(tokenPattern, safeValue);
  });

  return output;
};

const isFullHtmlDocument = (html = "") =>
  /<!doctype\s+html|<html[\s>]/i.test(String(html || ""));

const ensureUnsubscribeFooter = (html = "", unsubscribeUrl = "") => {
  const body = String(html || "");
  const trimmedBody = body.trim();
  const safeUnsubscribeUrl = sanitizeAttribute(unsubscribeUrl || "#");

  // If template still has unreplaced {{unsubscribe_url}} merge tag, it means
  // applyTemplateVariables didn't process it (shouldn't happen but be defensive).
  // Also skip if already has `/unsubscribe` path or word "unsubscribe" in HTML tags.
  if (
    /\{\{\s*unsubscribe_url\s*\}\}/i.test(body) ||
    /<a\s+[^>]*href\s*=\s*["'][^"']*\/unsubscribe/i.test(body) ||
    />.*?\bunsubscribe\b.*?</i.test(body)
  ) {
    return body;
  }

  const footerMarkup = `
    <p style="margin:24px 0 0 0;text-align:center;font-size:12px;line-height:1.6;color:#6b7280;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      You are receiving these emails because you are subscribed to our email updates.<br/>
      <a href="${safeUnsubscribeUrl}" style="color:#4f46e5;text-decoration:underline;">Unsubscribe</a>
    </p>
  `;

  if (isFullHtmlDocument(trimmedBody)) {
    if (/<\/body>/i.test(trimmedBody)) {
      return trimmedBody.replace(/<\/body>/i, `${footerMarkup}</body>`);
    }

    if (/<\/html>/i.test(trimmedBody)) {
      return trimmedBody.replace(
        /<\/html>/i,
        `<body>${footerMarkup}</body></html>`,
      );
    }

    return `${trimmedBody}${footerMarkup}`;
  }

  return `${trimmedBody}${footerMarkup}`;
};

const toEmailHtmlDocument = (bodyHtml, subject, trackingPixelUrl = "") => {
  let styledBody = normalizeEmailBodyHtml(bodyHtml);

  const openPixelMarkup = trackingPixelUrl
    ? `<img src="${sanitizeAttribute(trackingPixelUrl)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;opacity:0;border:0;"/>`
    : "";

  // If template is already a complete HTML document, preserve it as-is so
  // email-client-specific CSS/layout stays intact. Only inject tracking pixel.
  if (isFullHtmlDocument(styledBody)) {
    if (openPixelMarkup) {
      if (/<\/body>/i.test(styledBody)) {
        return styledBody.replace(/<\/body>/i, `${openPixelMarkup}</body>`);
      }
      return `${styledBody}${openPixelMarkup}`;
    }

    return styledBody;
  }

  const safeSubject = sanitizeAttribute(subject || "Campaign update");

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeSubject}</title>
  </head>
  <body style="margin:0;padding:0;">
    ${styledBody}
    ${openPixelMarkup}
  </body>
</html>`.trim();
};

const setCampaignStatusDraft = async (campaignId) => {
  await queryDb(
    `UPDATE campaigns
     SET campaign_status = 'draft'
     WHERE campaign_id = ?`,
    [campaignId],
  );
};

const normalizeSelectedContactIds = (selectedContactIds = []) => {
  if (!Array.isArray(selectedContactIds)) {
    return [];
  }

  return [
    ...new Set(
      selectedContactIds
        .map((id) => Number.parseInt(id, 10))
        .filter((id) => !Number.isNaN(id)),
    ),
  ];
};

const normalizeBccSegment = (segmentValue = "") => {
  const normalized = String(segmentValue || "").trim();
  if (!normalized) {
    return null;
  }

  const lower = normalized.toLowerCase();

  if (lower.startsWith("ids:")) {
    const normalizedIds = normalizeSelectedContactIds(
      lower.replace("ids:", "").split(","),
    );

    return normalizedIds.length > 0 ? `ids:${normalizedIds.join(",")}` : null;
  }

  if (
    lower === "all" ||
    lower === "active" ||
    lower === "unsubscribed" ||
    lower.startsWith("group:")
  ) {
    return lower;
  }

  return null;
};

const mergeRecipientsByEmail = (recipients = []) => {
  const byEmail = new Map();

  recipients.forEach((recipient) => {
    const normalizedEmail = String(recipient?.contact_email || "")
      .trim()
      .toLowerCase();

    if (!normalizedEmail) {
      return;
    }

    const normalizedRecipient = {
      ...recipient,
      contact_email: normalizedEmail,
      recipient_type:
        String(recipient?.recipient_type || "to").toLowerCase() === "bcc"
          ? "bcc"
          : "to",
    };

    const existing = byEmail.get(normalizedEmail);

    if (!existing) {
      byEmail.set(normalizedEmail, normalizedRecipient);
      return;
    }

    // Prefer explicit To recipients when the same email exists in both lists.
    if (
      existing.recipient_type === "bcc" &&
      normalizedRecipient.recipient_type === "to"
    ) {
      byEmail.set(normalizedEmail, normalizedRecipient);
    }
  });

  return Array.from(byEmail.values());
};

const buildRecipientInitials = (name = "", email = "") => {
  const nameTokens = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (nameTokens.length >= 2) {
    return `${(nameTokens[0][0] || "").toUpperCase()}${(nameTokens[nameTokens.length - 1][0] || "").toUpperCase()}`;
  }

  if (nameTokens.length === 1 && nameTokens[0].length >= 2) {
    return nameTokens[0].slice(0, 2).toUpperCase();
  }

  const localPart = String(email || "").split("@")[0] || "";
  return localPart.slice(0, 2).toUpperCase() || "NA";
};

const toDisplayNameFromEmail = (email = "") => {
  const localPart = String(email || "").split("@")[0] || "subscriber";
  const normalized = localPart
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || "Subscriber";
};

const getEmailSendQuota = async () => {
  const [hourRow] = await queryDb(
    `SELECT COUNT(*) AS sent_count
     FROM campaign_emails
     WHERE sent_at IS NOT NULL
       AND sent_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 HOUR)
       AND email_status IN ('sent', 'delivered', 'opened', 'clicked')`,
  );

  const [dayRow] = await queryDb(
    `SELECT COUNT(*) AS sent_count
     FROM campaign_emails
     WHERE sent_at IS NOT NULL
       AND sent_at >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)
       AND email_status IN ('sent', 'delivered', 'opened', 'clicked')`,
  );

  const hourlyRemaining = Math.max(
    0,
    EMAILS_PER_HOUR - Number(hourRow?.sent_count || 0),
  );
  const dailyRemaining = Math.max(
    0,
    EMAILS_PER_DAY - Number(dayRow?.sent_count || 0),
  );

  return {
    hourlyRemaining,
    dailyRemaining,
    available: Math.min(hourlyRemaining, dailyRemaining),
  };
};

const ensureCampaignEmailQueueRows = async (campaignId, recipients = []) => {
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return;
  }

  const queueRows = recipients
    .filter(
      (recipient) =>
        recipient.contact_id && String(recipient.contact_email || "").trim(),
    )
    .map((recipient) => {
      const trackingId = `${campaignId}-${recipient.contact_id}-${randomUUID()}`;

      return [campaignId, recipient.contact_id, "pending", trackingId];
    });

  if (queueRows.length === 0) {
    return;
  }

  await queryDb(
    `INSERT IGNORE INTO campaign_emails (
       campaign_id,
       contact_id,
       email_status,
       unique_tracking_id
     ) VALUES ?`,
    [queueRows],
  );
};

const getPendingQueuedRecipients = async (campaignId) =>
  queryDb(
    `SELECT
       ce.campaign_email_id,
       ce.campaign_id,
       ce.contact_id,
       ce.unique_tracking_id,
       snap.recipient_name,
       snap.recipient_email,
       snap.recipient_initials,
       snap.recipient_type
     FROM campaign_emails ce
     LEFT JOIN campaign_recipient_snapshots snap
       ON snap.campaign_id = ce.campaign_id
      AND snap.contact_id = ce.contact_id
     WHERE ce.campaign_id = ?
       AND ce.email_status = 'pending'
     ORDER BY ce.campaign_email_id ASC`,
    [campaignId],
  );

const ensureCampaignRecipientSnapshotStorage = async () => {
  await queryDb(
    `CREATE TABLE IF NOT EXISTS campaign_recipient_snapshots (
       snapshot_id INT PRIMARY KEY AUTO_INCREMENT,
       campaign_id INT NOT NULL,
       contact_id INT NULL,
       recipient_name VARCHAR(255) NULL,
       recipient_email VARCHAR(255) NOT NULL,
       recipient_initials VARCHAR(10) NULL,
      recipient_type VARCHAR(10) NOT NULL DEFAULT 'to',
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
       UNIQUE KEY unique_campaign_recipient_email (campaign_id, recipient_email),
       INDEX idx_campaign_snapshot_campaign (campaign_id),
       INDEX idx_campaign_snapshot_email (recipient_email)
     )`,
  );

  await queryDb(
    `ALTER TABLE campaign_recipient_snapshots
     ADD COLUMN recipient_type VARCHAR(10) NOT NULL DEFAULT 'to'`,
  ).catch(() => {
    // Ignore when the column already exists.
  });
};

const ensureCampaignBccStorage = async () => {
  await queryDb(
    `ALTER TABLE campaigns
     ADD COLUMN bcc_segment VARCHAR(255) NULL AFTER contact_segment`,
  ).catch(() => {
    // Ignore when the column already exists.
  });
};

const saveCampaignRecipientSnapshot = async (campaignId, recipients = []) => {
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return;
  }

  await ensureCampaignRecipientSnapshotStorage();

  const snapshotRows = recipients
    .filter((recipient) => String(recipient.contact_email || "").trim())
    .map((recipient) => {
      const normalizedEmail = String(recipient.contact_email)
        .trim()
        .toLowerCase();
      return [
        campaignId,
        recipient.contact_id || null,
        recipient.contact_name || null,
        normalizedEmail,
        buildRecipientInitials(recipient.contact_name, normalizedEmail),
        String(recipient.recipient_type || "to").toLowerCase() === "bcc"
          ? "bcc"
          : "to",
      ];
    });

  if (snapshotRows.length === 0) {
    return;
  }

  await queryDb(
    `INSERT INTO campaign_recipient_snapshots (
       campaign_id,
       contact_id,
       recipient_name,
       recipient_email,
       recipient_initials,
       recipient_type
     ) VALUES ?
     ON DUPLICATE KEY UPDATE
       contact_id = COALESCE(campaign_recipient_snapshots.contact_id, VALUES(contact_id)),
       recipient_name = COALESCE(
         NULLIF(campaign_recipient_snapshots.recipient_name, ''),
         VALUES(recipient_name)
       ),
       recipient_initials = COALESCE(
         NULLIF(campaign_recipient_snapshots.recipient_initials, ''),
         VALUES(recipient_initials)
       ),
       recipient_type = CASE
         WHEN campaign_recipient_snapshots.recipient_type = 'to' THEN 'to'
         ELSE VALUES(recipient_type)
       END`,
    [snapshotRows],
  );
};

const backfillRecipientSnapshotsFromCampaignEmails = async () => {
  await ensureCampaignRecipientSnapshotStorage();

  await queryDb(
    `INSERT INTO campaign_recipient_snapshots (
       campaign_id,
       contact_id,
       recipient_name,
       recipient_email,
       recipient_initials
     )
     SELECT
       ce.campaign_id,
       ce.contact_id,
       c.contact_name,
       LOWER(c.contact_email),
       UPPER(
         LEFT(
           COALESCE(
             NULLIF(
               CONCAT(
                 SUBSTRING_INDEX(TRIM(COALESCE(c.contact_name, '')), ' ', 1),
                 SUBSTRING(SUBSTRING_INDEX(TRIM(COALESCE(c.contact_name, '')), ' ', -1), 1, 1)
               ),
               ''
             ),
             SUBSTRING_INDEX(c.contact_email, '@', 1),
             'NA'
           ),
           2
         )
       )
     FROM campaign_emails ce
     INNER JOIN campaigns cp ON cp.campaign_id = ce.campaign_id
     INNER JOIN contacts c ON c.contact_id = ce.contact_id
     LEFT JOIN campaign_recipient_snapshots snap
       ON snap.campaign_id = ce.campaign_id
      AND snap.recipient_email COLLATE utf8mb4_unicode_ci = LOWER(c.contact_email) COLLATE utf8mb4_unicode_ci
     WHERE cp.campaign_status = 'sent'
       AND c.contact_email IS NOT NULL
       AND c.contact_email <> ''
       AND snap.snapshot_id IS NULL`,
  );
};

const toRecipientPayload = (recipient = {}) => ({
  contact_id: recipient.contact_id || null,
  recipient_name:
    recipient.contact_name ||
    recipient.recipient_name ||
    toDisplayNameFromEmail(
      recipient.contact_email || recipient.recipient_email || "",
    ),
  recipient_email: String(
    recipient.contact_email || recipient.recipient_email || "",
  )
    .trim()
    .toLowerCase(),
  recipient_initials:
    recipient.recipient_initials ||
    buildRecipientInitials(
      recipient.contact_name || recipient.recipient_name,
      recipient.contact_email || recipient.recipient_email,
    ),
  recipient_type:
    String(recipient.recipient_type || "to").toLowerCase() === "bcc"
      ? "bcc"
      : "to",
});

const buildSenderFieldsFromSmtpConfig = (smtpConfig = {}) => {
  const senderName = String(smtpConfig.senderName || "").trim() || "System";
  const senderEmail = String(
    smtpConfig.senderEmail || smtpConfig.user || "noreply@example.com",
  )
    .trim()
    .toLowerCase();
  const replyToEmail =
    String(smtpConfig.replyTo || "")
      .trim()
      .toLowerCase() || senderEmail;

  return {
    sender_name: senderName,
    sender_email: senderEmail,
    reply_to_email: replyToEmail,
  };
};

const isLegacyCampaignInsertError = (error) => {
  const code = String(error?.code || "").trim();
  const message = String(error?.message || "").toLowerCase();

  if (code === "ER_NO_DEFAULT_FOR_FIELD") {
    return true;
  }

  return (
    message.includes("sender_name") &&
    message.includes("doesn't have a default value")
  );
};

const getCampaignSendPayload = async (campaignId) => {
  await ensureCampaignBccStorage();

  const campaignRows = await queryDb(
    `SELECT c.campaign_id, c.campaign_name, c.campaign_subject, c.campaign_body,
            c.template_id,
            c.contact_segment,
            c.bcc_segment,
            t.template_body
     FROM campaigns c
     LEFT JOIN templates t ON t.template_id = c.template_id
     WHERE c.campaign_id = ?
     LIMIT 1`,
    [campaignId],
  );

  if (campaignRows.length === 0) {
    const error = new Error("Campaign not found");
    error.statusCode = 404;
    throw error;
  }

  const campaign = campaignRows[0];

  if (!campaign.campaign_subject?.trim()) {
    const error = new Error("Campaign subject is required");
    error.statusCode = 400;
    throw error;
  }

  const resolvedBody =
    campaign.template_id && campaign.template_body != null
      ? campaign.template_body
      : campaign.campaign_body;

  if (!String(resolvedBody || "").trim()) {
    const error = new Error("Campaign body is required");
    error.statusCode = 400;
    throw error;
  }

  return {
    ...campaign,
    resolved_body: resolvedBody,
  };
};

const getRecipientsForSend = async (
  contactSegment,
  selectedContactIds = [],
  bccSegment = null,
) => {
  const normalizedIds = normalizeSelectedContactIds(selectedContactIds);

  const toRecipients =
    normalizedIds.length > 0
      ? await queryDb(
          `SELECT contact_id, contact_name, contact_email
           FROM contacts
           WHERE contact_id IN (?) AND contact_status = 'active'
           ORDER BY FIELD(contact_id, ?)`,
          [normalizedIds, normalizedIds],
        )
      : await getRecipientContacts(contactSegment || "all");

  const normalizedToRecipients = toRecipients.map((recipient) => ({
    ...recipient,
    recipient_type: "to",
  }));

  const normalizedBccSegment = normalizeBccSegment(bccSegment);
  const bccRecipients = normalizedBccSegment
    ? await getRecipientContacts(normalizedBccSegment)
    : [];
  const normalizedBccRecipients = bccRecipients.map((recipient) => ({
    ...recipient,
    recipient_type: "bcc",
  }));

  return mergeRecipientsByEmail([
    ...normalizedToRecipients,
    ...normalizedBccRecipients,
  ]);
};

const executeCampaignSend = async (
  campaignId,
  selectedContactIds = [],
  actorUserId = null,
  bccContactIds = null,
) => {
  let smtpConfig;
  try {
    smtpConfig = await getResolvedSmtpConfig();
  } catch (error) {
    const err = new Error(
      error.message ||
        "SMTP configuration not found. Please configure SMTP settings in the Settings page.",
    );
    err.statusCode = 400;
    throw err;
  }

  const campaign = await getCampaignSendPayload(campaignId);
  const queueCountRows = await queryDb(
    `SELECT COUNT(*) AS queued_count
     FROM campaign_emails
     WHERE campaign_id = ?`,
    [campaignId],
  );

  let queuedCount = Number(queueCountRows[0]?.queued_count || 0);
  let sendingStarted = false;
  const normalizedSelectedIds = normalizeSelectedContactIds(selectedContactIds);
  const hasBccOverride = Array.isArray(bccContactIds);
  const normalizedBccIds = hasBccOverride
    ? normalizeSelectedContactIds(bccContactIds)
    : [];
  const effectiveBccSegment = hasBccOverride
    ? normalizedBccIds.length > 0
      ? `ids:${normalizedBccIds.join(",")}`
      : null
    : campaign.bcc_segment;

  const shouldRebuildDraftQueue =
    campaign.campaign_status === "draft" &&
    (normalizedSelectedIds.length > 0 || hasBccOverride);

  try {
    if (queuedCount > 0 && shouldRebuildDraftQueue) {
      await queryDb(
        `DELETE FROM campaign_emails
         WHERE campaign_id = ?`,
        [campaignId],
      );

      await queryDb(
        `DELETE FROM campaign_recipient_snapshots
         WHERE campaign_id = ?`,
        [campaignId],
      );

      queuedCount = 0;
    }

    if (queuedCount === 0) {
      const recipients = await getRecipientsForSend(
        campaign.contact_segment,
        normalizedSelectedIds,
        effectiveBccSegment,
      );

      if (recipients.length === 0) {
        const error = new Error(
          normalizedSelectedIds.length > 0
            ? "No active recipients found in your selection"
            : "No recipients found for this campaign segment",
        );
        error.statusCode = 400;
        throw error;
      }

      await saveCampaignRecipientSnapshot(campaignId, recipients);
      await ensureCampaignEmailQueueRows(campaignId, recipients);

      await queryDb(
        `UPDATE campaigns
         SET campaign_status = 'sending',
             total_recipients = ?,
             total_sent = 0,
             total_delivered = 0,
             total_opened = 0,
             total_clicked = 0,
             total_bounced = 0,
             total_unsubscribed = 0,
             bcc_segment = ?,
             updated_by = COALESCE(?, updated_by),
             sent_date = NULL
         WHERE campaign_id = ?`,
        [recipients.length, effectiveBccSegment, actorUserId, campaignId],
      );
      sendingStarted = true;
    } else {
      await queryDb(
        `UPDATE campaigns
         SET campaign_status = 'sending'
         WHERE campaign_id = ? AND campaign_status <> 'sent'`,
        [campaignId],
      );

      await queryDb(
        `UPDATE campaigns
         SET updated_by = COALESCE(?, updated_by)
         WHERE campaign_id = ?`,
        [actorUserId, campaignId],
      );
    }

    const pendingRecipients = await getPendingQueuedRecipients(campaignId);

    if (pendingRecipients.length === 0) {
      await queryDb(
        `UPDATE campaigns
         SET campaign_status = 'sent',
             sent_date = COALESCE(sent_date, CURRENT_TIMESTAMP)
         WHERE campaign_id = ?`,
        [campaignId],
      );

      return {
        recipients: queuedCount,
        sent: 0,
        failed: 0,
        pending: 0,
        processed: 0,
        available: 0,
      };
    }

    const quota = await getEmailSendQuota();
    const batchRecipients = pendingRecipients.slice(0, quota.available);

    if (batchRecipients.length === 0) {
      return {
        recipients: pendingRecipients.length,
        sent: 0,
        failed: 0,
        pending: pendingRecipients.length,
        processed: 0,
        available: quota.available,
      };
    }

    const trackingBaseUrl = getTrackingBaseUrl();
    const transporter = createTransporter(smtpConfig);
    const smtpFrom =
      smtpConfig.from || smtpConfig.senderEmail || smtpConfig.user;

    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of batchRecipients) {
      const trackingId = recipient.unique_tracking_id;
      const unsubscribeUrl = `${trackingBaseUrl}/api/campaigns/unsubscribe?email=${encodeURIComponent(recipient.recipient_email)}&campaign=${encodeURIComponent(campaignId)}`;
      const personalizedBody = applyTemplateVariables(campaign.resolved_body, {
        name:
          recipient.recipient_name ||
          toDisplayNameFromEmail(recipient.recipient_email),
        email: recipient.recipient_email,
        unsubscribe_url: unsubscribeUrl,
      });

      // Verify unsubscribe URL was included in personalized body
      const hasUnsubscribeUrl =
        personalizedBody.includes(unsubscribeUrl) ||
        personalizedBody.includes("unsubscribe");
      if (!hasUnsubscribeUrl) {
        console.warn(
          `[executeCampaignSend] Warning: Campaign ${campaignId} to ${recipient.recipient_email} may not have unsubscribe link. Template may be missing {{unsubscribe_url}} merge tag.`,
        );
      }

      const trackedBody = rewriteLinksForTracking(
        personalizedBody,
        trackingId,
        trackingBaseUrl,
      );
      const finalBody = ensureUnsubscribeFooter(trackedBody, unsubscribeUrl);
      const trackingPixelUrl = `${trackingBaseUrl}/api/campaigns/track/open/${encodeURIComponent(trackingId)}`;
      const htmlBody = toEmailHtmlDocument(
        finalBody,
        campaign.campaign_subject,
        trackingPixelUrl,
      );

      try {
        const isBccRecipient =
          String(recipient.recipient_type || "to").toLowerCase() === "bcc";
        const visibleRecipientHeader = recipient.recipient_name
          ? `${recipient.recipient_name} <${recipient.recipient_email}>`
          : recipient.recipient_email;

        await transporter.sendMail({
          from: smtpFrom,
          // Never expose other recipients in the message headers.
          // BCC recipients get a masked To header; normal recipients see only themselves.
          to: isBccRecipient
            ? "undisclosed-recipients:;"
            : visibleRecipientHeader,
          envelope: {
            from: smtpFrom,
            to: [recipient.recipient_email],
          },
          replyTo:
            smtpConfig.replyTo ||
            smtpConfig.senderEmail ||
            smtpConfig.user ||
            undefined,
          subject: campaign.campaign_subject,
          html: htmlBody,
          text: finalBody
            ? stripHtml(finalBody)
            : "This is your campaign update.",
        });

        sentCount += 1;

        await queryDb(
          `UPDATE campaign_emails
           SET email_status = 'sent',
               sent_at = CURRENT_TIMESTAMP,
               delivered_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE campaign_email_id = ?`,
          [recipient.campaign_email_id],
        );

        await queryDb(
          `INSERT INTO email_events (
             campaign_email_id,
             event_type,
             event_data,
             ip_address,
             user_agent
           ) VALUES (?, 'sent', NULL, NULL, NULL)`,
          [recipient.campaign_email_id],
        );
      } catch (sendError) {
        failedCount += 1;

        await queryDb(
          `UPDATE campaign_emails
           SET email_status = 'failed',
               bounced_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE campaign_email_id = ?`,
          [recipient.campaign_email_id],
        );

        await queryDb(
          `INSERT INTO email_events (
             campaign_email_id,
             event_type,
             event_data,
             ip_address,
             user_agent
           ) VALUES (?, 'bounced', ?, NULL, NULL)`,
          [
            recipient.campaign_email_id,
            JSON.stringify({ message: sendError.message || "Send failed" }),
          ],
        );

        console.error(
          `Failed sending campaign ${campaignId} to ${recipient.recipient_email}:`,
          sendError.message,
        );
      }
    }

    const [remainingRow] = await queryDb(
      `SELECT COUNT(*) AS pending_count
       FROM campaign_emails
       WHERE campaign_id = ?
         AND email_status = 'pending'`,
      [campaignId],
    );

    const pendingCount = Number(remainingRow?.pending_count || 0);

    await queryDb(
      `UPDATE campaigns
       SET total_sent = total_sent + ?,
           total_delivered = total_delivered + ?,
           total_bounced = total_bounced + ?,
           campaign_status = CASE WHEN ? = 0 THEN 'sent' ELSE 'sending' END,
           sent_date = CASE WHEN ? = 0 THEN CURRENT_TIMESTAMP ELSE sent_date END,
           updated_by = COALESCE(?, updated_by)
       WHERE campaign_id = ?`,
      [
        sentCount,
        sentCount,
        failedCount,
        pendingCount,
        pendingCount,
        actorUserId,
        campaignId,
      ],
    );

    return {
      recipients: pendingCount + batchRecipients.length,
      sent: sentCount,
      failed: failedCount,
      pending: pendingCount,
      processed: batchRecipients.length,
      available: quota.available,
    };
  } catch (error) {
    if (sendingStarted) {
      await setCampaignStatusDraft(campaignId).catch(() => {
        // Keep original error when rollback fails.
      });
    }

    throw error;
  }
};

const getAllCampaigns = async (req, res) => {
  try {
    await ensureCampaignBccStorage();
    await backfillRecipientSnapshotsFromCampaignEmails();
    const smtpConfig = await getResolvedSmtpConfig().catch(() => ({}));
    const senderFields = buildSenderFieldsFromSmtpConfig(smtpConfig);

    const campaigns = await queryDb(
      `SELECT c.campaign_id, c.campaign_name, c.campaign_subject, c.campaign_body,
              c.template_id,
              c.contact_segment, c.bcc_segment, c.campaign_status, c.scheduled_date, c.sent_date,
              c.total_recipients, c.total_sent, c.total_delivered, c.total_opened,
              c.total_clicked, c.total_bounced, c.total_unsubscribed, c.created_at,
              c.updated_at, t.template_name, t.template_body,
              u.user_name AS updated_by,
              cg.group_name AS recipient_group_name,
              CASE
                WHEN c.contact_segment LIKE 'group:%' THEN (
                  SELECT COUNT(*)
                  FROM contact_group_members cgm
                  INNER JOIN contacts ct ON ct.contact_id = cgm.contact_id
                  WHERE cgm.group_id = CAST(REPLACE(c.contact_segment, 'group:', '') AS UNSIGNED)
                    AND ct.contact_status = 'active'
                )
                WHEN c.contact_segment LIKE 'ids:%' THEN
                  CASE
                    WHEN REPLACE(c.contact_segment, 'ids:', '') = '' THEN 0
                    ELSE 1 + LENGTH(REPLACE(c.contact_segment, 'ids:', '')) - LENGTH(REPLACE(REPLACE(c.contact_segment, 'ids:', ''), ',', ''))
                  END
                WHEN c.contact_segment = 'unsubscribed' THEN (
                  SELECT COUNT(*)
                  FROM contacts ct
                  WHERE ct.contact_status = 'unsubscribed'
                )
                WHEN c.contact_segment = 'all' OR c.contact_segment = 'active' OR c.contact_segment IS NULL OR c.contact_segment = '' THEN (
                  SELECT COUNT(*)
                  FROM contacts ct
                  WHERE ct.contact_status = 'active'
                )
                ELSE 0
              END AS recipient_count_estimate
       FROM campaigns c
       LEFT JOIN templates t ON t.template_id = c.template_id
       LEFT JOIN users u ON u.user_id = COALESCE(c.updated_by, c.created_by)
       LEFT JOIN contact_groups cg
         ON c.contact_segment LIKE 'group:%'
        AND cg.group_id = CAST(REPLACE(c.contact_segment, 'group:', '') AS UNSIGNED)
       ORDER BY c.updated_at DESC`,
    );

    if (campaigns.length > 0) {
      const campaignIds = campaigns.map((campaign) => campaign.campaign_id);
      const snapshotStats = await queryDb(
        `SELECT
           campaign_id,
           COUNT(*) AS snapshot_recipient_count,
           SUBSTRING_INDEX(
             GROUP_CONCAT(
               CONCAT(
                 COALESCE(recipient_name, ''),
                 '::',
                 recipient_email,
                 '::',
                 COALESCE(recipient_initials, ''),
                 '::',
                 COALESCE(recipient_type, 'to')
               )
               ORDER BY snapshot_id ASC
               SEPARATOR '||'
             ),
             '||',
             5
           ) AS recipient_preview_blob
         FROM campaign_recipient_snapshots
         WHERE campaign_id IN (?)
         GROUP BY campaign_id`,
        [campaignIds],
      );

      const snapshotMap = new Map(
        snapshotStats.map((snapshot) => [snapshot.campaign_id, snapshot]),
      );

      const withRecipientSnapshots = await Promise.all(
        campaigns.map(async (campaign) => {
          const normalizedCampaign = { ...campaign, ...senderFields };

          if (campaign.campaign_status !== "sent") {
            const liveRecipients = await getRecipientsForSend(
              campaign.contact_segment || "all",
              [],
              campaign.bcc_segment,
            );
            const normalizedRecipients = liveRecipients
              .map((recipient) => toRecipientPayload(recipient))
              .filter((recipient) => recipient.recipient_email);

            return {
              ...normalizedCampaign,
              snapshot_recipient_count: 0,
              recipient_count_estimate: normalizedRecipients.length,
              recipient_preview: normalizedRecipients.slice(0, 5),
            };
          }

          const snapshot = snapshotMap.get(campaign.campaign_id);
          const previewEntries = String(snapshot?.recipient_preview_blob || "")
            .split("||")
            .filter(Boolean)
            .map((entry) => {
              const [
                recipientName = "",
                recipientEmail = "",
                initials = "",
                recipientType = "to",
              ] = entry.split("::");

              return toRecipientPayload({
                recipient_name: recipientName,
                recipient_email: recipientEmail,
                recipient_initials: initials,
                recipient_type: recipientType,
              });
            });

          const snapshotRecipientCount = Number.parseInt(
            snapshot?.snapshot_recipient_count,
            10,
          );

          return {
            ...normalizedCampaign,
            snapshot_recipient_count: Number.isNaN(snapshotRecipientCount)
              ? 0
              : snapshotRecipientCount,
            recipient_count_estimate:
              Number.isNaN(snapshotRecipientCount) ||
              snapshotRecipientCount <= 0
                ? Number(campaign.total_recipients) || 0
                : snapshotRecipientCount,
            recipient_preview: previewEntries,
          };
        }),
      );

      return res.json(withRecipientSnapshots);
    }

    return res.json(campaigns);
  } catch (error) {
    console.error("Error fetching campaigns:", error);
    return res.status(500).json({ message: "Failed to fetch campaigns" });
  }
};

const getCampaignById = async (req, res) => {
  try {
    const { id } = req.params;
    const campaignId = Number.parseInt(id, 10);

    if (!campaignId || Number.isNaN(campaignId)) {
      return res.status(400).json({ message: "Invalid campaign ID" });
    }

    await ensureCampaignBccStorage();

    const smtpConfig = await getResolvedSmtpConfig().catch(() => ({}));
    const senderFields = buildSenderFieldsFromSmtpConfig(smtpConfig);

    const campaign = await queryDb(
      `SELECT c.campaign_id, c.campaign_name, c.campaign_subject, c.campaign_body,
              c.template_id,
              c.contact_segment, c.bcc_segment, c.campaign_status, c.scheduled_date, c.sent_date,
              c.total_recipients, c.total_sent, c.total_delivered, c.total_opened,
              c.total_clicked, c.total_bounced, c.total_unsubscribed, c.created_at,
              c.updated_at, t.template_name, t.template_body
       FROM campaigns c
       LEFT JOIN templates t ON t.template_id = c.template_id
       WHERE c.campaign_id = ?`,
      [campaignId],
    );

    if (!campaign || campaign.length === 0) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    return res.json({
      ...campaign[0],
      ...senderFields,
    });
  } catch (error) {
    console.error("Error fetching campaign:", error);
    return res.status(500).json({ message: "Failed to fetch campaign" });
  }
};

const getEmailLogs = async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    const templateId = Number.parseInt(req.query.template, 10);
    const recipient = String(req.query.recipient || "").trim();
    const date = String(req.query.date || "").trim();

    await backfillRecipientSnapshotsFromCampaignEmails();

    const whereClauses = ["c.campaign_status IN ('sent', 'sending')"];
    const queryParams = [];

    if (search) {
      whereClauses.push(
        "(c.campaign_subject LIKE ? OR c.campaign_name LIKE ?)",
      );
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    if (!Number.isNaN(templateId) && templateId > 0) {
      whereClauses.push("c.template_id = ?");
      queryParams.push(templateId);
    }

    if (date) {
      whereClauses.push("DATE(COALESCE(c.sent_date, c.updated_at)) = ?");
      queryParams.push(date);
    }

    const rows = await queryDb(
      `SELECT
         c.campaign_id AS id,
         c.campaign_name,
         COALESCE(NULLIF(c.campaign_name, ''), t.template_name, CONCAT('Campaign #', c.campaign_id)) AS campaign_display_name,
         COALESCE(c.sent_date, c.updated_at) AS sent_at,
         t.template_name,
         u.user_name AS sent_by,
         u.user_avatar_url AS sent_by_avatar_url,
         c.campaign_status AS status,
         c.total_recipients,
         COALESCE(SUM(CASE WHEN ce.email_status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_count,
         COALESCE(
           COUNT(DISTINCT CASE
             WHEN ce.email_status IN ('sent', 'delivered', 'opened', 'clicked')
             THEN ce.campaign_email_id
           END),
           0
         ) AS success_count,
         COALESCE(
           COUNT(DISTINCT CASE
             WHEN ce.email_status IN ('failed', 'bounced') OR ee.event_type = 'bounced'
             THEN ce.campaign_email_id
           END),
           0
         ) AS fail_count
       FROM campaigns c
       LEFT JOIN templates t ON t.template_id = c.template_id
      LEFT JOIN users u ON u.user_id = COALESCE(c.updated_by, c.created_by)
       LEFT JOIN campaign_emails ce ON ce.campaign_id = c.campaign_id
       LEFT JOIN email_events ee ON ee.campaign_email_id = ce.campaign_email_id
       WHERE ${whereClauses.join(" AND ")}
       GROUP BY
         c.campaign_id,
         c.campaign_name,
         c.sent_date,
         c.updated_at,
         t.template_name,
         u.user_name,
         u.user_avatar_url,
         c.campaign_status,
         c.total_recipients
       ORDER BY COALESCE(c.sent_date, c.updated_at) DESC`,
      queryParams,
    );

    if (rows.length === 0) {
      return res.status(200).json([]);
    }

    const campaignIds = rows.map((row) => row.id);
    const snapshotRows = await queryDb(
      `SELECT
         campaign_id,
         recipient_name,
         recipient_email
       FROM campaign_recipient_snapshots
       WHERE campaign_id IN (?)
       ORDER BY snapshot_id ASC`,
      [campaignIds],
    );

    const snapshotMap = new Map();
    snapshotRows.forEach((snapshot) => {
      const list = snapshotMap.get(snapshot.campaign_id) || [];
      list.push(snapshot);
      snapshotMap.set(snapshot.campaign_id, list);
    });

    const withRecipients = rows.map((row) => {
      const recipients = snapshotMap.get(row.id) || [];
      const recipientNames = recipients
        .map(
          (recipient) =>
            recipient.recipient_name ||
            toDisplayNameFromEmail(recipient.recipient_email),
        )
        .filter(Boolean);
      const recipientEmails = recipients
        .map((recipient) => String(recipient.recipient_email || "").trim())
        .filter(Boolean);

      const recipientSearchText = recipients
        .map((recipient) =>
          `${recipient.recipient_name || ""} ${recipient.recipient_email || ""}`
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean)
        .join("||");

      const preservedCount = recipients.length;
      const persistedTotal = Number.parseInt(row.total_recipients, 10) || 0;

      return {
        ...row,
        recipient_names: recipientNames.join("||"),
        recipient_emails: recipientEmails.join("||"),
        recipient_search_text: recipientSearchText,
        send_status:
          Number.parseInt(row.pending_count, 10) > 0 ? "pending" : "sent",
        total_recipients: Math.max(preservedCount, persistedTotal),
      };
    });

    const normalizedRecipient = recipient.toLowerCase();
    const filteredRows = recipient
      ? withRecipients.filter((row) =>
          String(row.recipient_search_text || "")
            .toLowerCase()
            .includes(normalizedRecipient),
        )
      : withRecipients;

    const sanitizedRows = filteredRows.map(
      ({ recipient_search_text, ...row }) => ({
        ...row,
        sent_by_avatar_url: toPublicAvatarPath(row.sent_by_avatar_url),
      }),
    );

    return res.status(200).json(sanitizedRows);
  } catch (error) {
    console.error("Error fetching email logs:", error);
    return res.status(500).json({ message: "Failed to fetch email logs" });
  }
};

const createCampaign = async (req, res) => {
  const campaign = normalizeCampaign(req.body);
  const validationMessage = validateCampaign(campaign);

  if (validationMessage) {
    return res.status(400).json({ message: validationMessage });
  }

  try {
    await ensureCampaignBccStorage();

    let result;

    try {
      result = await queryDb(
        `INSERT INTO campaigns (
          campaign_name, campaign_subject, campaign_body, template_id,
          contact_segment, bcc_segment,
          campaign_status, scheduled_date, created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          campaign.campaign_name,
          campaign.campaign_subject,
          campaign.campaign_body,
          campaign.template_id,
          campaign.contact_segment,
          campaign.bcc_segment,
          campaign.campaign_status,
          campaign.scheduled_date,
          req.user.userId,
          req.user.userId,
        ],
      );
    } catch (insertError) {
      if (!isLegacyCampaignInsertError(insertError)) {
        throw insertError;
      }

      const smtpConfig = await getResolvedSmtpConfig().catch(() => ({}));
      const senderFields = buildSenderFieldsFromSmtpConfig(smtpConfig);

      result = await queryDb(
        `INSERT INTO campaigns (
          campaign_name, campaign_subject, campaign_body, template_id,
          sender_name, sender_email, reply_to_email,
          contact_segment, bcc_segment,
          campaign_status, scheduled_date, created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          campaign.campaign_name,
          campaign.campaign_subject,
          campaign.campaign_body,
          campaign.template_id,
          senderFields.sender_name,
          senderFields.sender_email,
          senderFields.reply_to_email,
          campaign.contact_segment,
          campaign.bcc_segment,
          campaign.campaign_status,
          campaign.scheduled_date,
          req.user.userId,
          req.user.userId,
        ],
      );
    }

    return res.status(201).json({
      message: "Campaign saved successfully",
      id: result.insertId,
    });
  } catch (error) {
    console.error("Error creating campaign:", error);
    return res.status(500).json({ message: "Failed to save campaign" });
  }
};

const updateCampaign = async (req, res) => {
  const campaign = normalizeCampaign(req.body);
  const validationMessage = validateCampaign(campaign);

  if (validationMessage) {
    return res.status(400).json({ message: validationMessage });
  }

  try {
    await ensureCampaignBccStorage();

    const campaignId = Number.parseInt(req.params.id, 10);

    if (!campaignId || Number.isNaN(campaignId)) {
      return res.status(400).json({ message: "Invalid campaign id" });
    }

    const existingCampaignRows = await queryDb(
      `SELECT campaign_status
       FROM campaigns
       WHERE campaign_id = ?
       LIMIT 1`,
      [campaignId],
    );

    if (existingCampaignRows.length === 0) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    if (existingCampaignRows[0].campaign_status === "sent") {
      return res.status(403).json({
        message: "Sent campaigns are locked and cannot be edited",
      });
    }

    const result = await queryDb(
      `UPDATE campaigns
       SET campaign_name = ?, campaign_subject = ?, campaign_body = ?, template_id = ?,
           contact_segment = ?, bcc_segment = ?,
           campaign_status = ?, scheduled_date = ?, updated_by = ?
       WHERE campaign_id = ?`,
      [
        campaign.campaign_name,
        campaign.campaign_subject,
        campaign.campaign_body,
        campaign.template_id,
        campaign.contact_segment,
        campaign.bcc_segment,
        campaign.campaign_status,
        campaign.scheduled_date,
        req.user.userId,
        campaignId,
      ],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    return res.json({ message: "Campaign updated successfully" });
  } catch (error) {
    console.error("Error updating campaign:", error);
    return res.status(500).json({ message: "Failed to update campaign" });
  }
};

const deleteCampaign = async (req, res) => {
  try {
    const campaignId = Number.parseInt(req.params.id, 10);

    if (!campaignId || Number.isNaN(campaignId)) {
      return res.status(400).json({ message: "Invalid campaign id" });
    }

    const existingCampaignRows = await queryDb(
      `SELECT campaign_status
       FROM campaigns
       WHERE campaign_id = ?
       LIMIT 1`,
      [campaignId],
    );

    if (existingCampaignRows.length === 0) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    if (existingCampaignRows[0].campaign_status === "sent") {
      return res.status(403).json({
        message: "Sent campaigns are locked and cannot be deleted",
      });
    }

    const result = await queryDb(
      "DELETE FROM campaigns WHERE campaign_id = ?",
      [campaignId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    return res.json({ message: "Campaign deleted successfully" });
  } catch (error) {
    console.error("Error deleting campaign:", error);
    return res.status(500).json({ message: "Failed to delete campaign" });
  }
};

const sendCampaign = async (req, res) => {
  const campaignId = Number.parseInt(req.params.id, 10);

  if (!campaignId || Number.isNaN(campaignId)) {
    return res.status(400).json({ message: "Invalid campaign id" });
  }

  try {
    const totals = await executeCampaignSend(campaignId, [], req.user.userId);

    return res.json({
      message:
        totals.pending > 0
          ? `Campaign queued: sent ${totals.sent} contact${totals.sent === 1 ? "" : "s"}, ${totals.pending} pending`
          : `Campaign sent to ${totals.sent} contact${totals.sent === 1 ? "" : "s"}`,
      totals,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    console.error("Error sending campaign:", error);

    return res.status(500).json({ message: "Failed to send campaign" });
  }
};

const sendCampaignDraft = async (req, res) => {
  const campaignId = Number.parseInt(req.params.id, 10);
  const { selectedContactIds, bccContactIds } = req.body;

  if (!campaignId || Number.isNaN(campaignId)) {
    return res.status(400).json({ message: "Invalid campaign id" });
  }

  if (!Array.isArray(selectedContactIds) || selectedContactIds.length === 0) {
    return res
      .status(400)
      .json({ message: "Please select at least one recipient" });
  }

  try {
    const totals = await executeCampaignSend(
      campaignId,
      selectedContactIds,
      req.user.userId,
      bccContactIds,
    );

    return res.json({
      message:
        totals.pending > 0
          ? `Campaign queued: sent ${totals.sent} contact${totals.sent === 1 ? "" : "s"}, ${totals.pending} pending`
          : `Campaign sent to ${totals.sent} contact${totals.sent === 1 ? "" : "s"}`,
      totals,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    console.error("Error sending campaign:", error);

    return res.status(500).json({ message: "Failed to send campaign" });
  }
};

const getCampaignRecipients = async (req, res) => {
  const campaignId = Number.parseInt(req.params.id, 10);
  const search = String(req.query.search || "")
    .trim()
    .toLowerCase();

  if (!campaignId || Number.isNaN(campaignId)) {
    return res.status(400).json({ message: "Invalid campaign id" });
  }

  try {
    await ensureCampaignBccStorage();
    await backfillRecipientSnapshotsFromCampaignEmails();

    const campaignRows = await queryDb(
      `SELECT campaign_id, campaign_status, total_recipients, contact_segment, bcc_segment
       FROM campaigns
       WHERE campaign_id = ?
       LIMIT 1`,
      [campaignId],
    );

    if (campaignRows.length === 0) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    let recipients = [];
    let totalRecipients = 0;

    if (campaignRows[0].campaign_status === "sent") {
      const recipientRows = await queryDb(
        `SELECT
           snapshot_id,
           contact_id,
           recipient_name,
           recipient_email,
           recipient_initials,
           recipient_type
         FROM campaign_recipient_snapshots
         WHERE campaign_id = ?
         ORDER BY snapshot_id ASC`,
        [campaignId],
      );

      recipients = recipientRows.map((row) =>
        toRecipientPayload({
          contact_id: row.contact_id,
          recipient_name: row.recipient_name,
          recipient_email: row.recipient_email,
          recipient_initials: row.recipient_initials,
          recipient_type: row.recipient_type,
        }),
      );

      totalRecipients =
        Number.parseInt(campaignRows[0].total_recipients, 10) ||
        recipientRows.length;
    } else {
      const liveRecipients = await getRecipientsForSend(
        campaignRows[0].contact_segment || "all",
        [],
        campaignRows[0].bcc_segment,
      );

      recipients = liveRecipients
        .map((recipient) => toRecipientPayload(recipient))
        .filter((recipient) => recipient.recipient_email);

      totalRecipients = recipients.length;
    }

    recipients = recipients.filter((row) =>
      search ? row.recipient_email.toLowerCase().includes(search) : true,
    );

    return res.json({
      campaign_id: campaignId,
      campaign_status: campaignRows[0].campaign_status,
      total_recipients:
        campaignRows[0].campaign_status === "sent"
          ? Math.max(
              totalRecipients,
              Number.parseInt(campaignRows[0].total_recipients, 10) || 0,
            )
          : totalRecipients,
      recipients,
    });
  } catch (error) {
    console.error("Error fetching campaign recipients:", error);
    return res.status(500).json({ message: "Failed to fetch recipients" });
  }
};

const trackOpen = async (req, res) => {
  const trackingId = req.params.trackingId?.trim();

  try {
    if (trackingId) {
      const rows = await queryDb(
        `SELECT campaign_email_id, campaign_id, opened_at
         FROM campaign_emails
         WHERE unique_tracking_id = ?
         LIMIT 1`,
        [trackingId],
      );

      if (rows.length > 0) {
        const trackedEmail = rows[0];

        // Check if already opened using email_events (source of truth for deduplication)
        const openEventRows = await queryDb(
          `SELECT event_id
           FROM email_events
           WHERE campaign_email_id = ? AND event_type = 'opened'
           LIMIT 1`,
          [trackedEmail.campaign_email_id],
        );

        const isFirstOpen = openEventRows.length === 0;

        await queryDb(
          `UPDATE campaign_emails
           SET open_count = open_count + 1,
               opened_at = COALESCE(opened_at, CURRENT_TIMESTAMP),
               email_status = CASE
                 WHEN email_status IN ('sent', 'delivered') THEN 'opened'
                 ELSE email_status
               END,
               updated_at = CURRENT_TIMESTAMP
           WHERE campaign_email_id = ?`,
          [trackedEmail.campaign_email_id],
        );

        if (isFirstOpen) {
          await queryDb(
            `UPDATE campaigns
             SET total_opened = total_opened + 1
             WHERE campaign_id = ?`,
            [trackedEmail.campaign_id],
          );
        }

        await trackEvent(trackedEmail.campaign_email_id, "opened", req);
      }
    }
  } catch (error) {
    console.error("Error tracking open event:", error);
  }

  res.set("Content-Type", "image/gif");
  res.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  return res.status(200).send(TRACKING_PIXEL_GIF);
};

const trackClick = async (req, res) => {
  const trackingId = req.params.trackingId?.trim();
  const redirectUrl = String(req.query.url || "").trim();

  if (!isTrackableHttpUrl(redirectUrl)) {
    return res.status(400).send("Invalid redirect URL");
  }

  try {
    if (trackingId) {
      const rows = await queryDb(
        `SELECT campaign_email_id, campaign_id, clicked_at, opened_at
         FROM campaign_emails
         WHERE unique_tracking_id = ?
         LIMIT 1`,
        [trackingId],
      );

      if (rows.length > 0) {
        const trackedEmail = rows[0];
        const isFirstClick = !trackedEmail.clicked_at;
        const isFirstOpenViaClick = !trackedEmail.opened_at;

        await queryDb(
          `UPDATE campaign_emails
           SET click_count = click_count + 1,
               clicked_at = COALESCE(clicked_at, CURRENT_TIMESTAMP),
               open_count = open_count + CASE WHEN opened_at IS NULL THEN 1 ELSE 0 END,
               opened_at = COALESCE(opened_at, CURRENT_TIMESTAMP),
               email_status = CASE
                 WHEN email_status IN ('sent', 'delivered', 'opened') THEN 'clicked'
                 ELSE email_status
               END,
               updated_at = CURRENT_TIMESTAMP
           WHERE campaign_email_id = ?`,
          [trackedEmail.campaign_email_id],
        );

        if (isFirstClick) {
          await queryDb(
            `UPDATE campaigns
             SET total_clicked = total_clicked + 1
             WHERE campaign_id = ?`,
            [trackedEmail.campaign_id],
          );
        }

        if (isFirstOpenViaClick) {
          await queryDb(
            `UPDATE campaigns
             SET total_opened = total_opened + 1
             WHERE campaign_id = ?`,
            [trackedEmail.campaign_id],
          );

          await trackEvent(
            trackedEmail.campaign_email_id,
            "opened",
            req,
            JSON.stringify({ inferredFrom: "click" }),
          );
        }

        await trackEvent(
          trackedEmail.campaign_email_id,
          "clicked",
          req,
          JSON.stringify({ url: redirectUrl }),
        );
      }
    }
  } catch (error) {
    console.error("Error tracking click event:", error);
  }

  return res.redirect(302, redirectUrl);
};

const unsubscribeRecipient = async (req, res) => {
  const email = String(req.query.email || "")
    .trim()
    .toLowerCase();
  const campaignId = Number.parseInt(req.query.campaign, 10);
  const frontendBaseUrl = getFrontendBaseUrl();
  const unsubscribePageUrl = `${frontendBaseUrl}/unsubscribe-feedback`;

  if (!EMAIL_PATTERN.test(email)) {
    return res.redirect(
      302,
      `${unsubscribePageUrl}?status=invalid-email&email=${encodeURIComponent(email)}${
        Number.isNaN(campaignId)
          ? ""
          : `&campaign=${encodeURIComponent(campaignId)}`
      }`,
    );
  }

  try {
    const contact = await getOrCreateContactByEmail(email);

    if (contact) {
      if (!Number.isNaN(campaignId) && campaignId > 0) {
        const campaignEmailRows = await queryDb(
          `SELECT campaign_email_id
           FROM campaign_emails
           WHERE campaign_id = ? AND contact_id = ?
           LIMIT 1`,
          [campaignId, contact.contact_id],
        );

        if (campaignEmailRows.length > 0) {
          const campaignEmail = campaignEmailRows[0];
          const unsubscribeEventRows = await queryDb(
            `SELECT event_id
             FROM email_events
             WHERE campaign_email_id = ? AND event_type = 'unsubscribed'
             LIMIT 1`,
            [campaignEmail.campaign_email_id],
          );

          const wasAlreadyUnsubscribed = unsubscribeEventRows.length > 0;

          await queryDb(
            `UPDATE campaign_emails
             SET updated_at = CURRENT_TIMESTAMP
             WHERE campaign_email_id = ?`,
            [campaignEmail.campaign_email_id],
          );

          if (!wasAlreadyUnsubscribed) {
            await queryDb(
              `UPDATE campaigns
               SET total_unsubscribed = total_unsubscribed + 1
               WHERE campaign_id = ?`,
              [campaignId],
            );
          }

          await trackEvent(
            campaignEmail.campaign_email_id,
            "unsubscribed",
            req,
          );
        }
      }
    }

    return res.redirect(
      302,
      `${unsubscribePageUrl}?status=success&email=${encodeURIComponent(email)}${
        Number.isNaN(campaignId)
          ? ""
          : `&campaign=${encodeURIComponent(campaignId)}`
      }`,
    );
  } catch (error) {
    console.error("Error handling unsubscribe:", error);
    return res.redirect(
      302,
      `${unsubscribePageUrl}?status=failed&email=${encodeURIComponent(email)}${
        Number.isNaN(campaignId)
          ? ""
          : `&campaign=${encodeURIComponent(campaignId)}`
      }`,
    );
  }
};

const saveUnsubscribeFeedback = async (req, res) => {
  try {
    console.log(
      "[saveUnsubscribeFeedback] incoming request headers:",
      req.headers?.["content-type"],
    );
    console.log("[saveUnsubscribeFeedback] raw body type:", typeof req.body);
    console.log(
      "[saveUnsubscribeFeedback] raw body preview:",
      JSON.stringify(req.body).slice(0, 1000),
    );

    const email = String(req.body.email || req.query.email || "")
      .trim()
      .toLowerCase();
    const campaignId = Number.parseInt(
      req.body.campaign || req.query.campaign,
      10,
    );
    const reason = String(req.body.reason || "").trim();
    const additionalComments = String(
      req.body.additional_comments || req.body.comments || "",
    ).trim();

    console.log("[saveUnsubscribeFeedback] Parsed values:", {
      email,
      campaignId,
      reason,
      hasComments: !!additionalComments,
    });

    if (!EMAIL_PATTERN.test(email)) {
      console.log("[saveUnsubscribeFeedback] Invalid email:", email);
      return res.status(400).json({ message: "Valid email is required" });
    }

    if (!UNSUBSCRIBE_FEEDBACK_REASONS.has(reason)) {
      console.log(
        "[saveUnsubscribeFeedback] Invalid reason:",
        reason,
        "Available:",
        Array.from(UNSUBSCRIBE_FEEDBACK_REASONS),
      );
      return res.status(400).json({ message: "Please select a valid reason" });
    }

    try {
      const contact = await getOrCreateContactByEmail(email);

      if (!contact?.contact_id) {
        console.warn(
          `[saveUnsubscribeFeedback] Feedback received for unknown email: ${email}. Saving anonymously.`,
        );
        // If we really can't find/create the contact, we still want to return success to the user
        // so they don't see an error, and we've logged it for admin review.
        return res
          .status(201)
          .json({ message: "Feedback received (anonymous)" });
      }

      // Verify campaign exists to prevent foreign key violation
      let validCampaignId = null;
      if (campaignId > 0) {
        const campaignExists = await queryDb(
          "SELECT campaign_id FROM campaigns WHERE campaign_id = ? LIMIT 1",
          [campaignId],
        );
        if (campaignExists.length > 0) {
          validCampaignId = campaignId;
        }
      }

      await queryDb(
        `INSERT INTO unsubscribe_feedback (
           contact_id,
           campaign_id,
           reason,
           additional_comments
         ) VALUES (?, ?, ?, ?)`,
        [
          contact.contact_id,
          validCampaignId,
          reason,
          additionalComments || null,
        ],
      );

      console.log(
        `[saveUnsubscribeFeedback] Successfully saved feedback for ${email} with reason: ${reason}`,
      );
      return res.status(201).json({ message: "Feedback saved" });
    } catch (innerError) {
      console.error(
        "[saveUnsubscribeFeedback] Database error:",
        innerError.message,
      );
      throw innerError;
    }
  } catch (error) {
    console.error("Error saving unsubscribe feedback:", error.message, error);
    return res.status(500).json({
      message: "Failed to save feedback",
      error: error.message,
      code: error.code,
    });
  }
};

let schedulerTask = null;
let schedulerRunning = false;

const claimDueScheduledCampaign = async (campaignId) => {
  const result = await queryDb(
    `UPDATE campaigns
     SET campaign_status = 'sending'
     WHERE campaign_id = ?
       AND campaign_status = 'scheduled'
       AND scheduled_date IS NOT NULL
       AND scheduled_date <= CURRENT_TIMESTAMP`,
    [campaignId],
  );

  return Number(result?.affectedRows || 0) > 0;
};

const sendDueScheduledCampaigns = async () => {
  if (schedulerRunning) {
    return;
  }

  schedulerRunning = true;

  try {
    const smtpConfig = await getResolvedSmtpConfig();
    const smtpError = ensureSmtpConfigured(smtpConfig);
    if (smtpError) {
      console.warn(`[CampaignScheduler] ${smtpError}`);
      return;
    }

    const dueCampaigns = await queryDb(
      `SELECT campaign_id, campaign_status
       FROM campaigns
       WHERE campaign_status IN ('sending', 'scheduled')
         AND (
           campaign_status = 'sending'
           OR (
             scheduled_date IS NOT NULL
             AND scheduled_date <= CURRENT_TIMESTAMP
           )
         )
       ORDER BY CASE
         WHEN campaign_status = 'scheduled' THEN scheduled_date
         ELSE updated_at
       END ASC
       LIMIT 20`,
    );

    for (const campaign of dueCampaigns) {
      try {
        if (String(campaign.campaign_status || "") === "scheduled") {
          const wasClaimed = await claimDueScheduledCampaign(
            campaign.campaign_id,
          );

          if (!wasClaimed) {
            continue;
          }
        }

        const totals = await executeCampaignSend(campaign.campaign_id);
        console.log(
          `[CampaignScheduler] Sent campaign ${campaign.campaign_id} to ${totals.sent}/${totals.recipients} recipients`,
        );
      } catch (error) {
        console.error(
          `[CampaignScheduler] Failed campaign ${campaign.campaign_id}:`,
          error.message,
        );

        await setCampaignStatusDraft(campaign.campaign_id).catch(() => {
          // Ignore draft rollback failure for scheduler.
        });
      }
    }
  } finally {
    schedulerRunning = false;
  }
};

const startCampaignScheduler = () => {
  if (schedulerTask) {
    return;
  }

  const cronExpression = String(
    process.env.CAMPAIGN_SCHEDULER_CRON || "*/1 * * * *",
  ).trim();

  schedulerTask = cron.schedule(cronExpression, () => {
    sendDueScheduledCampaigns().catch((error) => {
      console.error("[CampaignScheduler] Unexpected scheduler error:", error);
    });
  });

  sendDueScheduledCampaigns().catch((error) => {
    console.error("[CampaignScheduler] Initial run failed:", error);
  });

  console.log(`[CampaignScheduler] Started. Cron: ${cronExpression}`);
};

export { startCampaignScheduler };

export default {
  getAllCampaigns,
  getCampaignById,
  getEmailLogs,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  sendCampaign,
  sendCampaignDraft,
  getCampaignRecipients,
  trackOpen,
  trackClick,
  unsubscribeRecipient,
  saveUnsubscribeFeedback,
  sendDueScheduledCampaigns,
};
