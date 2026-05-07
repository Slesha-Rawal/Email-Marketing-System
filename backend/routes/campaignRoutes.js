import express from "express";
import campaignController from "../controllers/campaignController.js";
import { authenticate, authorizePermission } from "../middleware/auth.js";
import { PERMISSIONS } from "../config/permissions.js";

const router = express.Router();

router.get("/campaigns/track/open/:trackingId", campaignController.trackOpen);
router.get("/campaigns/track/click/:trackingId", campaignController.trackClick);
router.get("/campaigns/unsubscribe", campaignController.unsubscribeRecipient);
router.post(
  "/campaigns/unsubscribe/feedback",
  campaignController.saveUnsubscribeFeedback,
);

router.get(
  "/campaigns",
  authenticate,
  authorizePermission(PERMISSIONS.CAMPAIGNS_READ),
  campaignController.getAllCampaigns,
);
router.get(
  "/campaigns/:id/recipients",
  authenticate,
  authorizePermission(PERMISSIONS.CAMPAIGNS_READ),
  campaignController.getCampaignRecipients,
);
router.get(
  "/campaigns/:id",
  authenticate,
  authorizePermission(PERMISSIONS.CAMPAIGNS_READ),
  campaignController.getCampaignById,
);
router.get(
  "/email-logs",
  authenticate,
  authorizePermission(PERMISSIONS.EMAIL_LOGS_READ),
  campaignController.getEmailLogs,
);
router.post(
  "/campaigns",
  authenticate,
  authorizePermission(PERMISSIONS.CAMPAIGNS_WRITE),
  campaignController.createCampaign,
);
router.put(
  "/campaigns/:id",
  authenticate,
  authorizePermission(PERMISSIONS.CAMPAIGNS_WRITE),
  campaignController.updateCampaign,
);
router.post(
  "/campaigns/:id/send",
  authenticate,
  authorizePermission(PERMISSIONS.CAMPAIGNS_SEND),
  campaignController.sendCampaign,
);
router.post(
  "/campaigns/:id/send-draft",
  authenticate,
  authorizePermission(PERMISSIONS.CAMPAIGNS_SEND),
  campaignController.sendCampaignDraft,
);
router.delete(
  "/campaigns/:id",
  authenticate,
  authorizePermission(PERMISSIONS.CAMPAIGNS_WRITE),
  campaignController.deleteCampaign,
);

export default router;
