import express from "express";
import campaignController from "../controllers/campaignController.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();

router.get("/campaigns/track/open/:trackingId", campaignController.trackOpen);
router.get("/campaigns/track/click/:trackingId", campaignController.trackClick);
router.get("/campaigns/unsubscribe", campaignController.unsubscribeRecipient);

router.get("/campaigns", authenticate, campaignController.getAllCampaigns);
router.get("/campaigns/:id", authenticate, campaignController.getCampaignById);
router.get(
  "/email-logs",
  authenticate,
  authorizeRoles("marketing", "admin"),
  campaignController.getEmailLogs,
);
router.post(
  "/campaigns",
  authenticate,
  authorizeRoles("marketing", "admin"),
  campaignController.createCampaign,
);
router.put(
  "/campaigns/:id",
  authenticate,
  authorizeRoles("marketing"),
  campaignController.updateCampaign,
);
router.post(
  "/campaigns/:id/send",
  authenticate,
  authorizeRoles("marketing", "admin"),
  campaignController.sendCampaign,
);
router.post(
  "/campaigns/:id/send-draft",
  authenticate,
  authorizeRoles("marketing", "admin"),
  campaignController.sendCampaignDraft,
);
router.delete(
  "/campaigns/:id",
  authenticate,
  authorizeRoles("marketing"),
  campaignController.deleteCampaign,
);

export default router;
