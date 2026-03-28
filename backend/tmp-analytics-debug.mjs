import { queryDb } from './utils/db.js';

const run = async () => {
  const [contactsCount] = await queryDb("SELECT COUNT(*) AS total_contacts FROM contacts");
  const [templateCount] = await queryDb("SELECT COUNT(*) AS total_templates FROM templates");
  const [campaignSummary] = await queryDb(`SELECT
    (SELECT COUNT(*) FROM campaigns) AS total_campaigns,
    COALESCE(SUM(
      CASE
        WHEN ce.email_status IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed')
        THEN 1
        ELSE 0
      END
    ), 0) AS emails_sent,
    COALESCE(SUM(CASE WHEN ce.opened_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS opens,
    COALESCE(SUM(CASE WHEN ce.clicked_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS clicks
  FROM campaign_emails ce`);

  const campaigns = await queryDb(`SELECT
    c.campaign_id,
    c.campaign_name,
    c.campaign_subject,
    c.campaign_status,
    c.scheduled_date,
    COALESCE(c.sent_date, MAX(ce.sent_at)) AS sent_date,
    COALESCE(SUM(
      CASE
        WHEN ce.email_status IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed')
        THEN 1
        ELSE 0
      END
    ), 0) AS total_sent,
    COALESCE(SUM(CASE WHEN ce.opened_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS total_opened,
    COALESCE(SUM(CASE WHEN ce.clicked_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS total_clicked
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
  HAVING
    COALESCE(c.sent_date, MAX(ce.sent_at)) IS NOT NULL
    AND COALESCE(SUM(
      CASE
        WHEN ce.email_status IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed')
        THEN 1
        ELSE 0
      END
    ), 0) > 0
  ORDER BY COALESCE(c.sent_date, c.scheduled_date, c.created_at) DESC`);

  const campaignStatusBreakdown = await queryDb(`
    SELECT campaign_status, COUNT(*) AS count
    FROM campaigns
    GROUP BY campaign_status
  `);

  console.log(JSON.stringify({
    contactsCount,
    templateCount,
    campaignSummary,
    campaignsCount: campaigns.length,
    campaigns,
    campaignStatusBreakdown,
  }, null, 2));
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
