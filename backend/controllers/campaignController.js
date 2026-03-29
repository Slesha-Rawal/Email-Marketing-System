import { queryDb } from "../utils/db.js";
import nodemailer from "nodemailer";
import { randomUUID } from "crypto";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeCampaign = (payload) => ({
  campaign_name: payload.campaign_name?.trim(),
  campaign_subject: payload.campaign_subject?.trim(),
  campaign_body: payload.campaign_body?.trim() || null,
  template_id: payload.template_id || null,
  sender_name: payload.sender_name?.trim(),
  sender_email: payload.sender_email?.trim().toLowerCase(),
  reply_to_email: payload.reply_to_email?.trim().toLowerCase() || null,
  contact_segment: payload.contact_segment?.trim() || "all",
  campaign_status: payload.campaign_status || "draft",
  scheduled_date: payload.scheduled_date || null,
});

const validateCampaign = (campaign) => {
  if (!campaign.campaign_name || !campaign.campaign_subject) {
    return "Campaign name and subject are required";
  }

  if (!campaign.sender_name || !campaign.sender_email) {
    return "Sender name and sender email are required";
  }

  if (!EMAIL_PATTERN.test(campaign.sender_email)) {
    return "Enter a valid sender email address";
  }

  if (campaign.reply_to_email && !EMAIL_PATTERN.test(campaign.reply_to_email)) {
    return "Enter a valid reply-to email address";
  }

  return null;
};

const getRecipientContacts = async (contactSegment) => {
  if (
    !contactSegment ||
    contactSegment === "all" ||
    contactSegment === "active"
  ) {
    return queryDb(
      `SELECT contact_id, contact_name, contact_email
       FROM contacts
       WHERE contact_status = 'active'
       ORDER BY contact_id ASC`,
    );
  }

  if (contactSegment === "unsubscribed") {
    return queryDb(
      `SELECT contact_id, contact_name, contact_email
       FROM contacts
       WHERE contact_status = 'unsubscribed'
       ORDER BY contact_id ASC`,
    );
  }

  if (contactSegment.startsWith("group:")) {
    const groupId = Number.parseInt(contactSegment.replace("group:", ""), 10);

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

  if (contactSegment.startsWith("ids:")) {
    const contactIds = contactSegment
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

  return [];
};

const ensureSmtpConfigured = () => {
  const requiredKeys = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"];
  const missingKeys = requiredKeys.filter((key) => !process.env[key]);

  if (missingKeys.length > 0) {
    return `Email delivery is not configured. Missing: ${missingKeys.join(", ")}`;
  }

  return null;
};

const createTransporter = () => {
  const port = Number.parseInt(process.env.SMTP_PORT || "587", 10);

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number.isNaN(port) ? 587 : port,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
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
    "http://localhost:5174";

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

const isFullHtmlDocument = (html = "") =>
  /<!doctype\s+html|<html[\s>]/i.test(String(html || ""));

const ensureUnsubscribeFooter = (html = "", unsubscribeUrl = "") => {
  const body = String(html || "");
  const trimmedBody = body.trim();
  const safeUnsubscribeUrl = sanitizeAttribute(unsubscribeUrl || "#");

  // Keep existing unsubscribe sections if template already includes one.
  if (
    /(\{\{\s*unsubscribe_url\s*\}\}|\/unsubscribe\b|>\s*unsubscribe\s*<)/i.test(
      body,
    )
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

const executeCampaignSend = async (campaignId) => {
  const smtpError = ensureSmtpConfigured();
  if (smtpError) {
    const error = new Error(smtpError);
    error.statusCode = 500;
    throw error;
  }

  const campaignRows = await queryDb(
    `SELECT campaign_id, campaign_name, campaign_subject, campaign_body,
            sender_name, sender_email, reply_to_email, contact_segment
     FROM campaigns
     WHERE campaign_id = ?
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

  const recipients = await getRecipientContacts(
    campaign.contact_segment || "all",
  );

  if (recipients.length === 0) {
    const error = new Error("No recipients found for this campaign segment");
    error.statusCode = 400;
    throw error;
  }

  let sendingStarted = false;

  try {
    await queryDb(
      `UPDATE campaigns
       SET campaign_status = 'sending',
           total_recipients = ?,
           total_sent = 0,
           total_delivered = 0,
           total_bounced = 0,
           sent_date = NULL
       WHERE campaign_id = ?`,
      [recipients.length, campaignId],
    );
    sendingStarted = true;

    const trackingBaseUrl = getTrackingBaseUrl();

    const trackingIdByContactId = new Map();

    const campaignEmailRows = recipients.map((contact) => {
      const trackingId = `${campaignId}-${contact.contact_id}-${randomUUID()}`;
      trackingIdByContactId.set(contact.contact_id, trackingId);

      return [campaignId, contact.contact_id, "pending", trackingId];
    });

    await queryDb(
      `INSERT INTO campaign_emails (campaign_id, contact_id, email_status, unique_tracking_id)
       VALUES ?
       ON DUPLICATE KEY UPDATE
         email_status = VALUES(email_status),
         unique_tracking_id = VALUES(unique_tracking_id),
         sent_at = NULL,
         delivered_at = NULL,
         bounced_at = NULL,
         updated_at = CURRENT_TIMESTAMP`,
      [campaignEmailRows],
    );

    const transporter = createTransporter();
    const smtpFrom =
      process.env.SMTP_FROM || campaign.sender_email || process.env.SMTP_USER;

    let sentCount = 0;
    let failedCount = 0;

    for (const contact of recipients) {
      const trackingId = trackingIdByContactId.get(contact.contact_id);
      const unsubscribeUrl = `${trackingBaseUrl}/unsubscribe?email=${encodeURIComponent(contact.contact_email)}&campaign=${encodeURIComponent(campaignId)}`;
      const personalizedBody = (campaign.campaign_body || "")
        .replaceAll("{{name}}", contact.contact_name || "Subscriber")
        .replaceAll("{{email}}", contact.contact_email)
        .replaceAll("{{unsubscribe_url}}", unsubscribeUrl);
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
        await transporter.sendMail({
          from: `${campaign.sender_name || "Marketing Team"} <${smtpFrom}>`,
          to: contact.contact_email,
          replyTo:
            campaign.reply_to_email || campaign.sender_email || undefined,
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
           WHERE campaign_id = ? AND contact_id = ?`,
          [campaignId, contact.contact_id],
        );
      } catch (sendError) {
        failedCount += 1;

        await queryDb(
          `UPDATE campaign_emails
           SET email_status = 'failed',
               bounced_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE campaign_id = ? AND contact_id = ?`,
          [campaignId, contact.contact_id],
        );

        console.error(
          `Failed sending campaign ${campaignId} to ${contact.contact_email}:`,
          sendError.message,
        );
      }
    }

    await queryDb(
      `UPDATE campaigns
       SET campaign_status = 'sent',
           sent_date = CURRENT_TIMESTAMP,
           total_recipients = ?,
           total_sent = ?,
           total_delivered = ?,
           total_bounced = ?
       WHERE campaign_id = ?`,
      [recipients.length, sentCount, sentCount, failedCount, campaignId],
    );

    return {
      recipients: recipients.length,
      sent: sentCount,
      failed: failedCount,
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
    const campaigns = await queryDb(
      `SELECT c.campaign_id, c.campaign_name, c.campaign_subject, c.campaign_body,
              c.template_id, c.sender_name, c.sender_email, c.reply_to_email,
              c.contact_segment, c.campaign_status, c.scheduled_date, c.sent_date,
              c.total_recipients, c.total_sent, c.total_delivered, c.total_opened,
              c.total_clicked, c.total_bounced, c.total_unsubscribed, c.created_at,
              c.updated_at, t.template_name
       FROM campaigns c
       LEFT JOIN templates t ON t.template_id = c.template_id
       ORDER BY c.updated_at DESC`,
    );

    return res.json(campaigns);
  } catch (error) {
    console.error("Error fetching campaigns:", error);
    return res.status(500).json({ message: "Failed to fetch campaigns" });
  }
};

const getEmailLogs = async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    const templateId = Number.parseInt(req.query.template, 10);
    const recipient = String(req.query.recipient || "").trim();
    const date = String(req.query.date || "").trim();

    const whereClauses = ["c.campaign_status = 'sent'"];
    const queryParams = [];

    if (search) {
      whereClauses.push("(c.campaign_subject LIKE ? OR c.sender_name LIKE ?)");
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
         COALESCE(c.sent_date, c.updated_at) AS sent_at,
         t.template_name,
         u.user_name AS sent_by,
         c.campaign_status AS status,
         COALESCE(
           NULLIF(
             GROUP_CONCAT(
               DISTINCT COALESCE(NULLIF(TRIM(ct.contact_name), ''), ct.contact_email)
               ORDER BY COALESCE(NULLIF(TRIM(ct.contact_name), ''), ct.contact_email)
               SEPARATOR '||'
             ),
             ''
           ),
           (
             CASE
               WHEN c.contact_segment LIKE 'ids:%' THEN (
                 SELECT GROUP_CONCAT(
                   DISTINCT COALESCE(NULLIF(TRIM(c_ids.contact_name), ''), c_ids.contact_email)
                   ORDER BY COALESCE(NULLIF(TRIM(c_ids.contact_name), ''), c_ids.contact_email)
                   SEPARATOR '||'
                 )
                 FROM contacts c_ids
                 WHERE FIND_IN_SET(
                   c_ids.contact_id,
                   REPLACE(c.contact_segment, 'ids:', '')
                 )
               )
               WHEN c.contact_segment LIKE 'group:%' THEN (
                 SELECT GROUP_CONCAT(
                   DISTINCT COALESCE(NULLIF(TRIM(c_group.contact_name), ''), c_group.contact_email)
                   ORDER BY COALESCE(NULLIF(TRIM(c_group.contact_name), ''), c_group.contact_email)
                   SEPARATOR '||'
                 )
                 FROM contact_group_members cgm_group
                 INNER JOIN contacts c_group
                   ON c_group.contact_id = cgm_group.contact_id
                 WHERE cgm_group.group_id = CAST(REPLACE(c.contact_segment, 'group:', '') AS UNSIGNED)
               )
               WHEN c.contact_segment = 'unsubscribed'
                    AND NOT EXISTS (
                      SELECT 1
                      FROM campaign_emails ce_exists_unsub
                      WHERE ce_exists_unsub.campaign_id = c.campaign_id
                    ) THEN (
                 SELECT GROUP_CONCAT(
                   DISTINCT COALESCE(NULLIF(TRIM(c_unsub.contact_name), ''), c_unsub.contact_email)
                   ORDER BY COALESCE(NULLIF(TRIM(c_unsub.contact_name), ''), c_unsub.contact_email)
                   SEPARATOR '||'
                 )
                 FROM contacts c_unsub
                 WHERE c_unsub.contact_status = 'unsubscribed'
               )
               WHEN (c.contact_segment = 'all' OR c.contact_segment = 'active' OR c.contact_segment IS NULL OR c.contact_segment = '')
                    AND NOT EXISTS (
                      SELECT 1
                      FROM campaign_emails ce_exists_active
                      WHERE ce_exists_active.campaign_id = c.campaign_id
                    ) THEN (
                 SELECT GROUP_CONCAT(
                   DISTINCT COALESCE(NULLIF(TRIM(c_active.contact_name), ''), c_active.contact_email)
                   ORDER BY COALESCE(NULLIF(TRIM(c_active.contact_name), ''), c_active.contact_email)
                   SEPARATOR '||'
                 )
                 FROM contacts c_active
                 WHERE c_active.contact_status = 'active'
               )
               ELSE NULL
             END
           ),
           ''
         ) AS recipient_names,
         COALESCE(
           NULLIF(
             GROUP_CONCAT(
               DISTINCT CONCAT_WS(
                 ' ',
                 COALESCE(NULLIF(TRIM(ct.contact_name), ''), ''),
                 COALESCE(ct.contact_email, '')
               )
               ORDER BY COALESCE(NULLIF(TRIM(ct.contact_name), ''), ct.contact_email)
               SEPARATOR '||'
             ),
             ''
           ),
           (
             CASE
               WHEN c.contact_segment LIKE 'ids:%' THEN (
                 SELECT GROUP_CONCAT(
                   DISTINCT CONCAT_WS(
                     ' ',
                     COALESCE(NULLIF(TRIM(c_ids.contact_name), ''), ''),
                     COALESCE(c_ids.contact_email, '')
                   )
                   ORDER BY COALESCE(NULLIF(TRIM(c_ids.contact_name), ''), c_ids.contact_email)
                   SEPARATOR '||'
                 )
                 FROM contacts c_ids
                 WHERE FIND_IN_SET(
                   c_ids.contact_id,
                   REPLACE(c.contact_segment, 'ids:', '')
                 )
               )
               WHEN c.contact_segment LIKE 'group:%' THEN (
                 SELECT GROUP_CONCAT(
                   DISTINCT CONCAT_WS(
                     ' ',
                     COALESCE(NULLIF(TRIM(c_group.contact_name), ''), ''),
                     COALESCE(c_group.contact_email, '')
                   )
                   ORDER BY COALESCE(NULLIF(TRIM(c_group.contact_name), ''), c_group.contact_email)
                   SEPARATOR '||'
                 )
                 FROM contact_group_members cgm_group
                 INNER JOIN contacts c_group
                   ON c_group.contact_id = cgm_group.contact_id
                 WHERE cgm_group.group_id = CAST(REPLACE(c.contact_segment, 'group:', '') AS UNSIGNED)
               )
               WHEN c.contact_segment = 'unsubscribed'
                    AND NOT EXISTS (
                      SELECT 1
                      FROM campaign_emails ce_exists_unsub_filter
                      WHERE ce_exists_unsub_filter.campaign_id = c.campaign_id
                    ) THEN (
                 SELECT GROUP_CONCAT(
                   DISTINCT CONCAT_WS(
                     ' ',
                     COALESCE(NULLIF(TRIM(c_unsub.contact_name), ''), ''),
                     COALESCE(c_unsub.contact_email, '')
                   )
                   ORDER BY COALESCE(NULLIF(TRIM(c_unsub.contact_name), ''), c_unsub.contact_email)
                   SEPARATOR '||'
                 )
                 FROM contacts c_unsub
                 WHERE c_unsub.contact_status = 'unsubscribed'
               )
               WHEN (c.contact_segment = 'all' OR c.contact_segment = 'active' OR c.contact_segment IS NULL OR c.contact_segment = '')
                    AND NOT EXISTS (
                      SELECT 1
                      FROM campaign_emails ce_exists_active_filter
                      WHERE ce_exists_active_filter.campaign_id = c.campaign_id
                    ) THEN (
                 SELECT GROUP_CONCAT(
                   DISTINCT CONCAT_WS(
                     ' ',
                     COALESCE(NULLIF(TRIM(c_active.contact_name), ''), ''),
                     COALESCE(c_active.contact_email, '')
                   )
                   ORDER BY COALESCE(NULLIF(TRIM(c_active.contact_name), ''), c_active.contact_email)
                   SEPARATOR '||'
                 )
                 FROM contacts c_active
                 WHERE c_active.contact_status = 'active'
               )
               ELSE NULL
             END
           ),
           ''
         ) AS recipient_search_text,
         COALESCE(c.total_recipients, COUNT(ce.campaign_email_id)) AS total_recipients,
         COALESCE(SUM(CASE WHEN ce.email_status IN ('sent', 'delivered', 'opened', 'clicked') THEN 1 ELSE 0 END), 0) AS success_count,
         COALESCE(SUM(CASE WHEN ce.email_status IN ('failed', 'bounced') THEN 1 ELSE 0 END), 0) AS fail_count
       FROM campaigns c
       LEFT JOIN templates t ON t.template_id = c.template_id
       LEFT JOIN users u ON u.user_id = c.created_by
       LEFT JOIN campaign_emails ce ON ce.campaign_id = c.campaign_id
       LEFT JOIN contacts ct ON ct.contact_id = ce.contact_id
       WHERE ${whereClauses.join(" AND ")}
       GROUP BY
         c.campaign_id,
         c.sent_date,
         c.updated_at,
         t.template_name,
         u.user_name,
         c.campaign_status,
         c.total_recipients
       ORDER BY COALESCE(c.sent_date, c.updated_at) DESC`,
      queryParams,
    );

    const normalizedRecipient = recipient.toLowerCase();
    const filteredRows = recipient
      ? rows.filter((row) =>
          String(row.recipient_search_text || "")
            .toLowerCase()
            .includes(normalizedRecipient),
        )
      : rows;

    const sanitizedRows = filteredRows.map(
      ({ recipient_search_text, ...row }) => row,
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
    const result = await queryDb(
      `INSERT INTO campaigns (
        campaign_name, campaign_subject, campaign_body, template_id,
        sender_name, sender_email, reply_to_email, contact_segment,
        campaign_status, scheduled_date, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        campaign.campaign_name,
        campaign.campaign_subject,
        campaign.campaign_body,
        campaign.template_id,
        campaign.sender_name,
        campaign.sender_email,
        campaign.reply_to_email,
        campaign.contact_segment,
        campaign.campaign_status,
        campaign.scheduled_date,
        req.user.userId,
      ],
    );

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
    const result = await queryDb(
      `UPDATE campaigns
       SET campaign_name = ?, campaign_subject = ?, campaign_body = ?, template_id = ?,
           sender_name = ?, sender_email = ?, reply_to_email = ?, contact_segment = ?,
           campaign_status = ?, scheduled_date = ?
       WHERE campaign_id = ?`,
      [
        campaign.campaign_name,
        campaign.campaign_subject,
        campaign.campaign_body,
        campaign.template_id,
        campaign.sender_name,
        campaign.sender_email,
        campaign.reply_to_email,
        campaign.contact_segment,
        campaign.campaign_status,
        campaign.scheduled_date,
        req.params.id,
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
    const result = await queryDb(
      "DELETE FROM campaigns WHERE campaign_id = ?",
      [req.params.id],
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
    const totals = await executeCampaignSend(campaignId);

    return res.json({
      message: `Campaign sent to ${totals.sent} contact${totals.sent === 1 ? "" : "s"}`,
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
        const isFirstOpen = !trackedEmail.opened_at;

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
  const frontendUnsubscribeUrl = `${getFrontendBaseUrl()}/unsubscribe`;

  if (!EMAIL_PATTERN.test(email)) {
    return res.redirect(302, `${frontendUnsubscribeUrl}?status=invalid-email`);
  }

  try {
    const contactRows = await queryDb(
      `SELECT contact_id, contact_status
       FROM contacts
       WHERE contact_email = ?
       LIMIT 1`,
      [email],
    );

    if (contactRows.length > 0) {
      const contact = contactRows[0];

      if (contact.contact_status !== "unsubscribed") {
        await queryDb(
          `UPDATE contacts
           SET contact_status = 'unsubscribed',
               unsubscribe_date = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE contact_id = ?`,
          [contact.contact_id],
        );
      }

      if (!Number.isNaN(campaignId) && campaignId > 0) {
        const campaignEmailRows = await queryDb(
          `SELECT campaign_email_id, email_status
           FROM campaign_emails
           WHERE campaign_id = ? AND contact_id = ?
           LIMIT 1`,
          [campaignId, contact.contact_id],
        );

        if (campaignEmailRows.length > 0) {
          const campaignEmail = campaignEmailRows[0];
          const wasAlreadyUnsubscribed =
            campaignEmail.email_status === "unsubscribed";

          await queryDb(
            `UPDATE campaign_emails
             SET email_status = 'unsubscribed',
                 updated_at = CURRENT_TIMESTAMP
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

    return res.redirect(302, `${frontendUnsubscribeUrl}?status=success`);
  } catch (error) {
    console.error("Error handling unsubscribe:", error);
    return res.redirect(302, `${frontendUnsubscribeUrl}?status=failed`);
  }
};

let schedulerInterval = null;
let schedulerRunning = false;

const sendDueScheduledCampaigns = async () => {
  if (schedulerRunning) {
    return;
  }

  schedulerRunning = true;

  try {
    const smtpError = ensureSmtpConfigured();
    if (smtpError) {
      console.warn(`[CampaignScheduler] ${smtpError}`);
      return;
    }

    const dueCampaigns = await queryDb(
      `SELECT campaign_id
       FROM campaigns
       WHERE campaign_status = 'scheduled'
         AND scheduled_date IS NOT NULL
         AND scheduled_date <= CURRENT_TIMESTAMP
       ORDER BY scheduled_date ASC
       LIMIT 20`,
    );

    for (const campaign of dueCampaigns) {
      try {
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
  if (schedulerInterval) {
    return;
  }

  const parsedInterval = Number.parseInt(
    process.env.CAMPAIGN_SCHEDULER_INTERVAL_MS || "60000",
    10,
  );
  const intervalMs =
    Number.isNaN(parsedInterval) || parsedInterval < 10000
      ? 60000
      : parsedInterval;

  schedulerInterval = setInterval(() => {
    sendDueScheduledCampaigns().catch((error) => {
      console.error("[CampaignScheduler] Unexpected scheduler error:", error);
    });
  }, intervalMs);

  if (typeof schedulerInterval.unref === "function") {
    schedulerInterval.unref();
  }

  sendDueScheduledCampaigns().catch((error) => {
    console.error("[CampaignScheduler] Initial run failed:", error);
  });

  console.log(
    `[CampaignScheduler] Started. Interval: ${Math.floor(intervalMs / 1000)}s`,
  );
};

export { startCampaignScheduler };

export default {
  getAllCampaigns,
  getEmailLogs,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  sendCampaign,
  trackOpen,
  trackClick,
  unsubscribeRecipient,
  sendDueScheduledCampaigns,
};
