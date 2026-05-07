import express from "express";
import templateController from "../controllers/templateController.js";
import { authenticate, authorizePermission } from "../middleware/auth.js";
import imageUpload from "../config/imageUpload.js";
import { PERMISSIONS } from "../config/permissions.js";

const router = express.Router();

router.get(
  "/templates",
  authenticate,
  authorizePermission(PERMISSIONS.TEMPLATES_READ),
  templateController.getAllTemplates,
);
router.get(
  "/templates/:id",
  authenticate,
  authorizePermission(PERMISSIONS.TEMPLATES_READ),
  templateController.getTemplateById,
);
router.post(
  "/templates/upload-image",
  authenticate,
  authorizePermission(PERMISSIONS.TEMPLATES_WRITE),
  imageUpload.single("image"),
  templateController.uploadTemplateImage,
);
router.post(
  "/templates",
  authenticate,
  authorizePermission(PERMISSIONS.TEMPLATES_WRITE),
  templateController.createTemplate,
);
router.put(
  "/templates/:id",
  authenticate,
  authorizePermission(PERMISSIONS.TEMPLATES_WRITE),
  templateController.updateTemplate,
);
router.delete(
  "/templates/:id",
  authenticate,
  authorizePermission(PERMISSIONS.TEMPLATES_WRITE),
  templateController.deleteTemplate,
);

export default router;
