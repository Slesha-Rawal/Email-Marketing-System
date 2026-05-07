import { queryDb } from "./utils/db.js";

async function getTrackingIds() {
  try {
    const rows = await queryDb("SELECT unique_tracking_id FROM campaign_emails LIMIT 5");
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

getTrackingIds();
