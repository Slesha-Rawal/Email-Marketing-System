import express from "express";
import analyticsController from "../controllers/analyticsController.js";
import { authenticate, authorizePermission } from "../middleware/auth.js";
import { PERMISSIONS } from "../config/permissions.js";

const router = express.Router();

router.get(
  "/analytics",
  authenticate,
  authorizePermission(PERMISSIONS.ANALYTICS_READ),
  analyticsController.getAnalytics,
);
router.get(
  "/analytics/overview",
  authenticate,
  authorizePermission(PERMISSIONS.ANALYTICS_READ),
  analyticsController.getOverview,
);
router.get(
  "/analytics/campaigns/performance",
  authenticate,
  authorizePermission(PERMISSIONS.ANALYTICS_READ),
  analyticsController.getCampaignPerformanceAnalytics,
);
router.get(
  "/analytics/campaigns/:campaignId/recipients",
  authenticate,
  authorizePermission(PERMISSIONS.ANALYTICS_READ),
  analyticsController.getCampaignRecipientHistoryAnalytics,
);
router.get(
  "/analytics/unsubscribe-feedback/insights",
  authenticate,
  authorizePermission(PERMISSIONS.ANALYTICS_READ),
  analyticsController.getUnsubscribeFeedbackInsights,
);

export default router;
