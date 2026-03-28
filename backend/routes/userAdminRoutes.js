import express from "express";
import userAdminController from "../controllers/userAdminController.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticate, authorizeRoles("admin"));

router.get("/admin/users", userAdminController.getMarketingUsers);
router.get(
  "/admin/users/:userId/activity",
  userAdminController.getMarketingUserActivity,
);
router.put("/admin/users/:userId", userAdminController.updateMarketingUser);
router.delete("/admin/users/:userId", userAdminController.deleteMarketingUser);

export default router;
