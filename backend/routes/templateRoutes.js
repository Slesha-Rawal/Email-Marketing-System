import express from "express";
import templateController from "../controllers/templateController.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();

router.get("/templates", authenticate, templateController.getAllTemplates);
router.post(
  "/templates",
  authenticate,
  authorizeRoles("marketing"),
  templateController.createTemplate,
);
router.put(
  "/templates/:id",
  authenticate,
  authorizeRoles("marketing"),
  templateController.updateTemplate,
);
router.delete(
  "/templates/:id",
  authenticate,
  authorizeRoles("marketing"),
  templateController.deleteTemplate,
);

export default router;
