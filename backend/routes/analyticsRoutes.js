import express from "express";
import analyticsController from "../controllers/analyticsController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.get("/analytics", authenticate, analyticsController.getAnalytics);
router.get(
  "/analytics/overview",
  authenticate,
  analyticsController.getOverview,
);

export default router;
