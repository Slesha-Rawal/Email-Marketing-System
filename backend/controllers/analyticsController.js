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
         COALESCE(SUM(CASE WHEN campaign_status = 'sent' THEN total_sent ELSE 0 END), 0) AS emails_sent,
         COALESCE(SUM(CASE WHEN campaign_status = 'sent' THEN total_opened ELSE 0 END), 0) AS opens,
         COALESCE(SUM(CASE WHEN campaign_status = 'sent' THEN total_clicked ELSE 0 END), 0) AS clicks
       FROM campaigns`,
    );

    const campaigns = await queryDb(
      `SELECT
         c.campaign_id,
         c.campaign_name,
         c.campaign_subject,
         c.campaign_status,
         c.scheduled_date,
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
       WHERE c.campaign_status = 'sent'
       GROUP BY
         c.campaign_id,
         c.campaign_name,
         c.campaign_subject,
         c.campaign_status,
         c.scheduled_date,
         c.sent_date,
         c.created_at
       ORDER BY COALESCE(c.sent_date, c.scheduled_date, c.created_at) DESC`,
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
      campaigns: campaigns.map((campaign) => ({
        ...campaign,
        openRate:
          campaign.total_sent > 0
            ? Number(
                ((campaign.total_opened / campaign.total_sent) * 100).toFixed(
                  1,
                ),
              )
            : 0,
        clickRate:
          campaign.total_sent > 0
            ? Number(
                ((campaign.total_clicked / campaign.total_sent) * 100).toFixed(
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
    const [summaryRow] = await queryDb(
      `SELECT
         COALESCE(SUM(CASE WHEN c.campaign_status = 'sent' THEN c.total_sent ELSE 0 END), 0) AS total_sent,
         COALESCE(SUM(CASE WHEN c.campaign_status = 'sent' THEN c.total_opened ELSE 0 END), 0) AS total_opened,
         COALESCE(SUM(CASE WHEN c.campaign_status = 'sent' THEN c.total_clicked ELSE 0 END), 0) AS total_clicked
       FROM campaigns c`,
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
         COALESCE(SUM(successful_imports), 0) AS imported_contacts
       FROM import_logs
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
         AND import_status = 'completed'
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
       WHERE c.campaign_status = 'sent'
         AND c.sent_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       ORDER BY engagement_score DESC, c.sent_date DESC
       LIMIT 5`,
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
    const engagementScore =
      totalSent > 0
        ? Number(
            (((totalOpened + 2 * totalClicked) / totalSent) * 50).toFixed(1),
          )
        : 0;

    return res.status(200).json({
      range: { type: "last_30_days" },
      summary: {
        totalSent,
        totalOpened,
        totalClicked,
        openRate,
        clickRate,
        engagementScore,
      },
      audienceGrowth: growthTotals,
      timeline,
      topCampaigns,
      scheduledCampaigns,
    });
  } catch (error) {
    console.error("Error fetching overview analytics:", error);
    return res
      .status(500)
      .json({ message: "Failed to fetch overview analytics" });
  }
};

export default {
  getAnalytics,
  getOverview,
};
