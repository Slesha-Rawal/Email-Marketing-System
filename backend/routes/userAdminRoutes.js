import express from "express";
import userAdminController from "../controllers/userAdminController.js";
import { authenticate, authorizePermission } from "../middleware/auth.js";
import { PERMISSIONS } from "../config/permissions.js";

const router = express.Router();

router.use(authenticate, authorizePermission(PERMISSIONS.ADMIN_USERS_MANAGE));

router.get("/admin/users", userAdminController.getMarketingUsers);
router.post("/admin/users", userAdminController.createManagedUser);
router.get(
  "/admin/users/:userId/activity",
  userAdminController.getMarketingUserActivity,
);
router.put("/admin/users/:userId", userAdminController.updateMarketingUser);
router.delete("/admin/users/:userId", userAdminController.deleteMarketingUser);

export default router;
