import express from "express";
import contactController from "../controllers/contactController.js";
import upload from "../config/multer.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();

router.get("/contacts", authenticate, contactController.getAllContacts);
router.post(
  "/contacts",
  authenticate,
  authorizeRoles("marketing"),
  contactController.addContact,
);
router.put(
  "/contacts/:id",
  authenticate,
  authorizeRoles("marketing"),
  contactController.updateContact,
);
router.delete(
  "/contacts/:id",
  authenticate,
  authorizeRoles("marketing"),
  contactController.deleteContact,
);
router.post(
  "/contacts/upload",
  authenticate,
  authorizeRoles("marketing"),
  upload.single("file"),
  contactController.uploadCSV,
);

export default router;
