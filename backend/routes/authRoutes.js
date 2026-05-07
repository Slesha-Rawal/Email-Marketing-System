import express from "express";
import authController from "../controllers/authController.js";
import profileAvatarUpload from "../config/profileAvatarUpload.js";
import {
  authenticate,
  authenticateTokenOnly,
  authorizePermission,
} from "../middleware/auth.js";
import { PERMISSIONS } from "../config/permissions.js";
import { createRateLimit } from "../middleware/rateLimit.js";

const router = express.Router();

const verifyLoginOtpRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 20,
  message: "Too many OTP verification attempts. Try again later",
  keyGenerator: (req) => `${req.ip || "unknown"}:verify-login-otp`,
});

const resendOtpRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  message: "Too many OTP resend requests. Try again later",
  keyGenerator: (req) => `${req.ip || "unknown"}:resend-otp`,
});

router.post("/login", authController.login);
router.post(
  "/forgot-password/request-reset-link",
  authController.requestPasswordResetLink,
);
router.post(
  "/forgot-password/request-otp",
  authController.requestPasswordResetLink,
);
router.post(
  "/forgot-password/validate-token",
  authController.validatePasswordResetToken,
);
router.post(
  "/forgot-password/reset-with-token",
  authController.resetPasswordWithToken,
);
router.post("/forgot-password/reset", authController.resetPasswordWithToken);
router.post(
  "/verify-login-otp",
  verifyLoginOtpRateLimit,
  authController.verifyLoginOtp,
);
router.post("/refresh", authController.refreshToken);
router.post("/resend-otp", resendOtpRateLimit, authController.resendLoginOtp);
router.post("/logout", authController.logout);
router.get("/verify-token", authenticate, authController.verifyToken);
router.get("/me", authenticate, authController.me);
router.post(
  "/request-account-otp",
  authenticateTokenOnly,
  authController.requestAccountOtp,
);
router.get(
  "/smtp-config",
  authenticate,
  authorizePermission(PERMISSIONS.SMTP_CONFIG_READ),
  authController.getSmtpConfig,
);
router.put(
  "/smtp-config",
  authenticate,
  authorizePermission(PERMISSIONS.SMTP_CONFIG_READ),
  authController.updateSmtpConfig,
);
router.put("/profile", authenticateTokenOnly, authController.updateProfile);
router.put(
  "/profile/avatar",
  authenticateTokenOnly,
  profileAvatarUpload.single("avatar"),
  authController.uploadProfileAvatar,
);
router.delete(
  "/profile/avatar",
  authenticateTokenOnly,
  authController.removeProfileAvatar,
);
router.put(
  "/change-password",
  authenticateTokenOnly,
  authController.changePassword,
);

export default router;
