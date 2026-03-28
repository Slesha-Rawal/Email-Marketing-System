import express from "express";
import authController from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.post("/login", authController.login);
router.get("/me", authenticate, authController.me);
router.get("/smtp-config", authenticate, authController.getSmtpConfig);
router.put("/profile", authenticate, authController.updateProfile);
router.put("/change-password", authenticate, authController.changePassword);

export default router;
