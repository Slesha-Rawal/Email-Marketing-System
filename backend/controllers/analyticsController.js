import { queryDb } from "../utils/db.js";

const toDateKey = (value) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getLastNDaysKeys = (days) => {
  const keys = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    keys.push(toDateKey(date));
  }

  return keys;
};

const decodeTrackedUrl = (value = "") => {
  let urlValue = String(value || "").trim();
  if (!urlValue) {
    return "";
  }

  try {
    const parsed = new URL(urlValue);
    const wrappedUrl = parsed.searchParams.get("url");
    if (wrappedUrl) {
      urlValue = wrappedUrl;
    }
  } catch {
    // Keep the original value when URL parsing fails.
  }

  // Decode encoded values (including nested encodings) up to a safe limit.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const decoded = decodeURIComponent(urlValue);
      if (decoded === urlValue) {
        break;
      }
      urlValue = decoded;
    } catch {
      break;
    }
  }

  return urlValue;
};

const getAnalytics = async (req, res) => {
  try {
    const [contactsCount] = await queryDb(
      "SELECT COUNT(*) AS total_contacts FROM contacts",
    );
    const [templateCount] = await queryDb(
      "SELECT COUNT(*) AS total_templates FROM templates",
    );

    const [campaignSummary] = await queryDb(
      `SELECT
         COUNT(*) AS total_campaigns,
         COALESCE(SUM(CASE WHEN campaign_status IN ('sent', 'sending') THEN total_sent ELSE 0 END), 0) AS emails_sent,
         COALESCE(SUM(CASE WHEN campaign_status IN ('sent', 'sending') THEN total_opened ELSE 0 END), 0) AS opens,
         COALESCE(SUM(CASE WHEN campaign_status IN ('sent', 'sending') THEN total_clicked ELSE 0 END), 0) AS clicks
       FROM campaigns`,
    );

    const templates = await queryDb(
      `SELECT
         COALESCE(cm.template_id, 0) AS template_id,
         COALESCE(t.template_name, 'No Template') AS template_name,
         MAX(cm.sent_date) AS sent_date,
         COUNT(*) AS campaigns_count,
         COALESCE(SUM(cm.total_sent), 0) AS total_sent,
         COALESCE(SUM(cm.total_opened), 0) AS total_opened,
         COALESCE(SUM(cm.total_clicked), 0) AS total_clicked
       FROM (
         SELECT
           c.campaign_id,
           c.template_id,
           COALESCE(c.sent_date, MAX(ce.sent_at), c.created_at) AS sent_date,
           GREATEST(COALESCE(c.total_sent, 0), COALESCE(SUM(
             CASE
               WHEN ce.email_status IN ('sent', 'delivered', 'opened', 'clicked', 'bounced')
               THEN 1
               ELSE 0
             END
           ), 0)) AS total_sent,
           GREATEST(COALESCE(c.total_opened, 0), COALESCE(SUM(CASE WHEN ce.opened_at IS NOT NULL THEN 1 ELSE 0 END), 0)) AS total_opened,
           GREATEST(COALESCE(c.total_clicked, 0), COALESCE(SUM(CASE WHEN ce.clicked_at IS NOT NULL THEN 1 ELSE 0 END), 0)) AS total_clicked
         FROM campaigns c
         LEFT JOIN campaign_emails ce ON ce.campaign_id = c.campaign_id
         WHERE c.campaign_status IN ('sent', 'sending')
         GROUP BY c.campaign_id, c.template_id, c.sent_date, c.created_at, c.total_sent, c.total_opened, c.total_clicked
       ) cm
       LEFT JOIN templates t ON t.template_id = cm.template_id
       GROUP BY cm.template_id, t.template_name
       ORDER BY MAX(cm.sent_date) DESC`,
    );

    return res.json({
      summary: {
        totalContacts: contactsCount.total_contacts,
        totalTemplates: templateCount.total_templates,
        totalCampaigns: campaignSummary.total_campaigns,
        emailsSent: campaignSummary.emails_sent,
        opens: campaignSummary.opens,
        clicks: campaignSummary.clicks,
      },
      campaigns: templates.map((template) => ({
        ...template,
        openRate:
          template.total_sent > 0
            ? Number(
                ((template.total_opened / template.total_sent) * 100).toFixed(
                  1,
                ),
              )
            : 0,
        clickRate:
          template.total_sent > 0
            ? Number(
                ((template.total_clicked / template.total_sent) * 100).toFixed(
                  1,
                ),
              )
            : 0,
      })),
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return res.status(500).json({ message: "Failed to fetch analytics" });
  }
};

const getOverview = async (req, res) => {
  try {
    const [totalContactsRow] = await queryDb(
      `SELECT COUNT(*) AS total_contacts
       FROM contacts`,
    );

    const [summaryRow] = await queryDb(
      `SELECT
        COALESCE(SUM(CASE WHEN c.campaign_status IN ('sent', 'sending') THEN c.total_sent ELSE 0 END), 0) AS total_sent,
        COALESCE(SUM(CASE WHEN c.campaign_status IN ('sent', 'sending') THEN c.total_opened ELSE 0 END), 0) AS total_opened,
        COALESCE(SUM(CASE WHEN c.campaign_status IN ('sent', 'sending') THEN c.total_clicked ELSE 0 END), 0) AS total_clicked,
        COALESCE(SUM(CASE WHEN c.campaign_status IN ('sent', 'sending') THEN c.total_unsubscribed ELSE 0 END), 0) AS total_unsubscribed
       FROM campaigns c`,
    );

    const [campaignRunRow] = await queryDb(
      `SELECT COUNT(*) AS total_campaigns_run
       FROM campaigns
       WHERE campaign_status IN ('sent', 'sending')`,
    );

    const subscriberGrowthRows = await queryDb(
      `SELECT
         DATE(subscription_date) AS activity_date,
         COUNT(*) AS new_subscribers
       FROM contacts
       WHERE subscription_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       GROUP BY DATE(subscription_date)`,
    );

    const unsubscribeRows = await queryDb(
      `SELECT
         DATE(COALESCE(unsubscribe_date, updated_at)) AS activity_date,
         COUNT(*) AS unsubscribes
       FROM contacts
       WHERE contact_status = 'unsubscribed'
         AND COALESCE(unsubscribe_date, updated_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       GROUP BY DATE(COALESCE(unsubscribe_date, updated_at))`,
    );

    const importRows = await queryDb(
      `SELECT
         DATE(created_at) AS activity_date,
         COUNT(*) AS imported_contacts
       FROM contacts
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       GROUP BY DATE(created_at)`,
    );

    const topCampaigns = await queryDb(
      `SELECT
         c.campaign_id,
         c.campaign_name,
         c.sent_date,
         COALESCE(c.total_sent, 0) AS total_sent,
         COALESCE(c.total_opened, 0) AS total_opened,
         COALESCE(c.total_clicked, 0) AS total_clicked,
         CASE
           WHEN COALESCE(c.total_sent, 0) = 0 THEN 0
           ELSE ROUND(((COALESCE(c.total_opened, 0) + (2 * COALESCE(c.total_clicked, 0))) / c.total_sent) * 50, 1)
         END AS engagement_score
       FROM campaigns c
          WHERE c.campaign_status IN ('sent', 'sending')
          AND COALESCE(c.sent_date, c.updated_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       ORDER BY engagement_score DESC, c.sent_date DESC
       LIMIT 5`,
    );

    const unsubscribeFeedbackRows = await queryDb(
      `SELECT
        reason,
        COUNT(*) AS feedback_count
       FROM unsubscribe_feedback
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       GROUP BY reason
       ORDER BY feedback_count DESC, reason ASC`,
    );

    const scheduledCampaigns = await queryDb(
      `SELECT
         c.campaign_id,
         c.campaign_name,
         c.scheduled_date,
         c.total_recipients
       FROM campaigns c
       WHERE c.campaign_status = 'scheduled'
         AND c.scheduled_date >= NOW()
       ORDER BY c.scheduled_date ASC
       LIMIT 5`,
    );

    const dayKeys = getLastNDaysKeys(30);
    const dayMap = new Map(
      dayKeys.map((dateKey) => [
        dateKey,
        {
          date: dateKey,
          newSubscribers: 0,
          unsubscribes: 0,
          importedContacts: 0,
        },
      ]),
    );

    subscriberGrowthRows.forEach((row) => {
      const key = toDateKey(row.activity_date);
      const point = dayMap.get(key);
      if (point) {
        point.newSubscribers = Number(row.new_subscribers || 0);
      }
    });

    unsubscribeRows.forEach((row) => {
      const key = toDateKey(row.activity_date);
      const point = dayMap.get(key);
      if (point) {
        point.unsubscribes = Number(row.unsubscribes || 0);
      }
    });

    importRows.forEach((row) => {
      const key = toDateKey(row.activity_date);
      const point = dayMap.get(key);
      if (point) {
        point.importedContacts = Number(row.imported_contacts || 0);
      }
    });

    const timeline = Array.from(dayMap.values());

    const growthTotals = timeline.reduce(
      (accumulator, point) => ({
        newSubscribers: accumulator.newSubscribers + point.newSubscribers,
        unsubscribes: accumulator.unsubscribes + point.unsubscribes,
        importedContacts: accumulator.importedContacts + point.importedContacts,
      }),
      { newSubscribers: 0, unsubscribes: 0, importedContacts: 0 },
    );

    const totalSent = Number(summaryRow.total_sent || 0);
    const totalOpened = Number(summaryRow.total_opened || 0);
    const totalClicked = Number(summaryRow.total_clicked || 0);

    const openRate =
      totalSent > 0 ? Number(((totalOpened / totalSent) * 100).toFixed(1)) : 0;
    const clickRate =
      totalSent > 0 ? Number(((totalClicked / totalSent) * 100).toFixed(1)) : 0;

    const totalInteractions = totalOpened + totalClicked;
    const engagementRate =
      totalSent > 0
        ? Number(((totalInteractions / totalSent) * 100).toFixed(1))
        : 0;

    const totalUnsubscribes = Number(summaryRow.total_unsubscribed || 0);
    const unsubscribeRateBySent =
      totalSent > 0
        ? Number(((totalUnsubscribes / totalSent) * 100).toFixed(1))
        : 0;

    return res.status(200).json({
      range: { type: "last_30_days" },
      totalContacts: Number(totalContactsRow.total_contacts || 0),
      summary: {
        totalSent,
        totalOpened,
        totalClicked,
        totalUnsubscribes,
        totalCampaignsRun: Number(campaignRunRow.total_campaigns_run || 0),
        openRate,
        clickRate,
        engagementRate,
        unsubscribeRate: unsubscribeRateBySent,
      },
      audienceGrowth: growthTotals,
      timeline,
      topCampaigns,
      scheduledCampaigns,
      unsubscribeFeedbackResults: unsubscribeFeedbackRows.map((row) => ({
        reason: row.reason,
        count: Number(row.feedback_count || 0),
      })),
    });
  } catch (error) {
    console.error("Error fetching overview analytics:", error);
    return res
      .status(500)
      .json({ message: "Failed to fetch overview analytics" });
  }
};

const getCampaignPerformanceAnalytics = async (req, res) => {
  try {
    const campaignRows = await queryDb(
      `SELECT
         c.campaign_id,
         c.campaign_name,
         COALESCE(c.total_sent, 0) AS sent_count,
         COALESCE(c.total_opened, 0) AS open_count,
         COALESCE(c.total_clicked, 0) AS click_count,
         COALESCE(c.total_unsubscribed, 0) AS unsubscribe_count,
         c.sent_date,
         c.updated_at
       FROM campaigns c
       WHERE c.campaign_status IN ('sent', 'sending')
       ORDER BY COALESCE(c.sent_date, c.updated_at) DESC`,
    );

    const campaigns = campaignRows.map((campaign) => {
      const sentCount = Number(campaign.sent_count || 0);
      const openCount = Number(campaign.open_count || 0);
      const clickCount = Number(campaign.click_count || 0);
      const unsubscribeCount = Number(campaign.unsubscribe_count || 0);

      return {
        campaign_id: campaign.campaign_id,
        campaign_name: campaign.campaign_name,
        sent_count: sentCount,
        open_count: openCount,
        click_count: clickCount,
        unsubscribe_count: unsubscribeCount,
        open_rate:
          sentCount > 0
            ? Number(((openCount / sentCount) * 100).toFixed(1))
            : 0,
        click_rate:
          sentCount > 0
            ? Number(((clickCount / sentCount) * 100).toFixed(1))
            : 0,
        unsubscribe_rate:
          sentCount > 0
            ? Number(((unsubscribeCount / sentCount) * 100).toFixed(1))
            : 0,
        sent_date: campaign.sent_date,
      };
    });

    const monthlyTrendRows = await queryDb(
      `SELECT
         DATE(COALESCE(c.sent_date, c.updated_at)) AS date_key,
         COUNT(*) AS campaigns_sent
       FROM campaigns c
       WHERE c.campaign_status IN ('sent', 'sending')
         AND DATE(COALESCE(c.sent_date, c.updated_at)) >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
         AND DATE(COALESCE(c.sent_date, c.updated_at)) < DATE_ADD(LAST_DAY(CURDATE()), INTERVAL 1 DAY)
       GROUP BY DATE(COALESCE(c.sent_date, c.updated_at))
       ORDER BY DATE(COALESCE(c.sent_date, c.updated_at)) ASC`,
    );

    const trendMap = new Map(
      monthlyTrendRows.map((row) => [
        toDateKey(row.date_key),
        Number(row.campaigns_sent || 0),
      ]),
    );

    const trend = [];
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthEnd = new Date(
      monthStart.getFullYear(),
      monthStart.getMonth() + 1,
      0,
    );

    for (let day = 1; day <= monthEnd.getDate(); day += 1) {
      const current = new Date(monthStart);
      current.setDate(day);
      const key = toDateKey(current);

      trend.push({
        date: key,
        campaigns_sent: trendMap.get(key) || 0,
      });
    }

    return res.status(200).json({ campaigns, trend });
  } catch (error) {
    console.error("Error fetching campaign performance analytics:", error);
    return res
      .status(500)
      .json({ message: "Failed to fetch campaign performance analytics" });
  }
};

const getCampaignRecipientHistoryAnalytics = async (req, res) => {
  try {
    const campaignId = Number.parseInt(req.params.campaignId, 10);

    if (!campaignId || Number.isNaN(campaignId)) {
      return res.status(400).json({ message: "Invalid campaign ID" });
    }

    const [campaignRow] = await queryDb(
      `SELECT campaign_id, campaign_name
       FROM campaigns
       WHERE campaign_id = ?`,
      [campaignId],
    );

    if (!campaignRow) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    let rows = [];

    try {
      rows = await queryDb(
        `SELECT
           ce.campaign_email_id,
           COALESCE(
             NULLIF(MAX(snap.recipient_name), ''),
             NULLIF(MAX(ct.contact_name), ''),
             'Unknown'
           ) AS recipient_name,
           COALESCE(
             NULLIF(MAX(snap.recipient_email), ''),
             NULLIF(MAX(ct.contact_email), ''),
             ''
           ) AS recipient_email,
           ce.email_status,
           ce.delivered_at,
           ce.opened_at,
           ce.clicked_at,
           COALESCE(
             GROUP_CONCAT(
               DISTINCT CASE
                 WHEN ee.event_type = 'clicked' THEN
                   COALESCE(
                     NULLIF(
                       JSON_UNQUOTE(
                         JSON_EXTRACT(
                           CASE
                             WHEN JSON_VALID(ee.event_data) THEN ee.event_data
                             ELSE NULL
                           END,
                           '$.url'
                         )
                       ),
                       ''
                     ),
                     CASE
                       WHEN ee.event_data REGEXP '^http://' OR ee.event_data REGEXP '^https://' THEN ee.event_data
                       ELSE NULL
                     END
                   )
                 ELSE NULL
               END
               SEPARATOR '||'
             ),
             ''
           ) AS clicked_urls_blob
         FROM campaign_emails ce
         LEFT JOIN contacts ct ON ct.contact_id = ce.contact_id
         LEFT JOIN campaign_recipient_snapshots snap
           ON snap.campaign_id = ce.campaign_id
          AND snap.contact_id = ce.contact_id
         LEFT JOIN email_events ee ON ee.campaign_email_id = ce.campaign_email_id
         WHERE ce.campaign_id = ?
         GROUP BY
           ce.campaign_email_id,
           ce.email_status,
           ce.delivered_at,
           ce.opened_at,
           ce.clicked_at
         ORDER BY recipient_name ASC, recipient_email ASC`,
        [campaignId],
      );
    } catch (queryError) {
      const isRecoverableSchemaError = [
        "ER_NO_SUCH_TABLE",
        "ER_BAD_FIELD_ERROR",
        "ER_INVALID_JSON_TEXT",
        "ER_PARSE_ERROR",
        "ER_SP_DOES_NOT_EXIST",
        "ER_SYNTAX_ERROR",
      ].includes(queryError?.code);

      if (!isRecoverableSchemaError) {
        throw queryError;
      }

      rows = await queryDb(
        `SELECT
           ce.campaign_email_id,
           COALESCE(NULLIF(ct.contact_name, ''), 'Unknown') AS recipient_name,
           COALESCE(NULLIF(ct.contact_email, ''), '') AS recipient_email,
           ce.email_status,
           ce.delivered_at,
           ce.opened_at,
           ce.clicked_at,
           '' AS clicked_urls_blob
         FROM campaign_emails ce
         LEFT JOIN contacts ct ON ct.contact_id = ce.contact_id
         WHERE ce.campaign_id = ?
         ORDER BY recipient_name ASC, recipient_email ASC`,
        [campaignId],
      );
    }

    const recipients = rows.map((row) => {
      const clickedUrls = String(row.clicked_urls_blob || "")
        .split("||")
        .map((value) => decodeTrackedUrl(value))
        .filter(Boolean);

      const uniqueClickedUrls = Array.from(new Set(clickedUrls));

      return {
        campaign_email_id: row.campaign_email_id,
        recipient_name: row.recipient_name,
        recipient_email: row.recipient_email,
        delivered: ["sent", "delivered", "opened", "clicked"].includes(
          String(row.email_status || "").toLowerCase(),
        ),
        delivered_at: row.delivered_at,
        opened: Boolean(row.opened_at),
        opened_at: row.opened_at,
        clicked: Boolean(row.clicked_at),
        clicked_at: row.clicked_at,
        clicked_urls: uniqueClickedUrls,
      };
    });

    return res.status(200).json({
      campaign: {
        campaign_id: campaignRow.campaign_id,
        campaign_name: campaignRow.campaign_name,
      },
      recipients,
    });
  } catch (error) {
    console.error(
      "Error fetching campaign recipient history analytics:",
      error,
    );
    return res.status(500).json({
      message: "Failed to fetch campaign recipient history analytics",
    });
  }
};

const getUnsubscribeFeedbackInsights = async (req, res) => {
  try {
    const responses = await queryDb(
      `SELECT
         uf.feedback_id,
         uf.reason,
         uf.additional_comments,
         uf.created_at,
         uf.campaign_id,
         COALESCE(NULLIF(c.contact_name, ''), 'Unknown') AS contact_name,
         COALESCE(NULLIF(c.contact_email, ''), '') AS contact_email,
         c.subscription_date AS joined_date
       FROM unsubscribe_feedback uf
       LEFT JOIN contacts c ON c.contact_id = uf.contact_id
       ORDER BY uf.created_at DESC, uf.feedback_id DESC`,
    );

    const groupedRows = await queryDb(
      `SELECT
         reason,
         COUNT(*) AS feedback_count
       FROM unsubscribe_feedback
       GROUP BY reason
       ORDER BY feedback_count DESC, reason ASC`,
    );

    return res.status(200).json({
      summary: {
        totalResponses: responses.length,
      },
      chart: groupedRows.map((row) => ({
        reason: row.reason,
        count: Number(row.feedback_count || 0),
      })),
      responses: responses.map((row) => ({
        feedback_id: row.feedback_id,
        reason: row.reason,
        additional_comments: row.additional_comments,
        created_at: row.created_at,
        campaign_id: row.campaign_id,
        contact_name: row.contact_name,
        contact_email: row.contact_email,
        joined_date: row.joined_date,
      })),
    });
  } catch (error) {
    console.error("Error fetching unsubscribe feedback insights:", error);
    return res
      .status(500)
      .json({ message: "Failed to fetch unsubscribe feedback insights" });
  }
};

export default {
  getAnalytics,
  getOverview,
  getCampaignPerformanceAnalytics,
  getCampaignRecipientHistoryAnalytics,
  getUnsubscribeFeedbackInsights,
};
