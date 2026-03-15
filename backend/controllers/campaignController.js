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

const toEmailHtmlDocument = (bodyHtml, subject, trackingPixelUrl = "") => {
  let styledBody = normalizeEmailBodyHtml(bodyHtml);

  styledBody = addInlineStyleToTag(
    styledBody,
    "p",
    "margin:0 0 12px 0;line-height:1.65;font-size:15px;color:#111827;",
  );
  styledBody = addInlineStyleToTag(
    styledBody,
    "h1",
    "margin:0 0 12px 0;line-height:1.25;font-size:26px;color:#111827;",
  );
  styledBody = addInlineStyleToTag(
    styledBody,
    "h2",
    "margin:0 0 12px 0;line-height:1.3;font-size:21px;color:#111827;",
  );
  styledBody = addInlineStyleToTag(
    styledBody,
    "ul",
    "margin:0 0 12px 0;padding-left:22px;color:#111827;",
  );
  styledBody = addInlineStyleToTag(
    styledBody,
    "ol",
    "margin:0 0 12px 0;padding-left:22px;color:#111827;",
  );
  styledBody = addInlineStyleToTag(
    styledBody,
    "li",
    "margin:0 0 8px 0;line-height:1.6;font-size:15px;color:#111827;",
  );
  styledBody = addInlineStyleToTag(
    styledBody,
    "blockquote",
    "margin:0 0 12px 0;padding-left:12px;border-left:3px solid #d1d5db;color:#4b5563;",
  );
  styledBody = addInlineStyleToTag(
    styledBody,
    "a",
    "color:#1d4ed8;text-decoration:underline;",
  );
  styledBody = addInlineStyleToTag(
    styledBody,
    "img",
    "display:block;max-width:100%;height:auto;border:0;",
  );

  const safeSubject = sanitizeAttribute(subject || "Campaign update");
  const openPixelMarkup = trackingPixelUrl
    ? `<img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;opacity:0;border:0;"/>`
    : "";

  return `
<!doctype html>
<html>
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeSubject}</title>
  </head>
  <body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
      <tr>
        <td align="center" style="padding:0;">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;border-collapse:collapse;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:20px 24px;border-bottom:1px solid #e5e7eb;background:#f9fafb;">
                <p style="margin:0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">Subject</p>
                <p style="margin:8px 0 0 0;font-size:18px;line-height:1.35;font-weight:600;color:#111827;">${safeSubject}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                ${styledBody}
                ${openPixelMarkup}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
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
      const personalizedBody = (campaign.campaign_body || "")
        .replaceAll("{{name}}", contact.contact_name || "Subscriber")
        .replaceAll("{{email}}", contact.contact_email);
      const trackedBody = rewriteLinksForTracking(
        personalizedBody,
        trackingId,
        trackingBaseUrl,
      );
      const trackingPixelUrl = `${trackingBaseUrl}/api/campaigns/track/open/${encodeURIComponent(trackingId)}`;
      const htmlBody = toEmailHtmlDocument(
        trackedBody,
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
          text: trackedBody
            ? stripHtml(trackedBody)
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
  createCampaign,
  updateCampaign,
  deleteCampaign,
  sendCampaign,
  trackOpen,
  trackClick,
  sendDueScheduledCampaigns,
};
