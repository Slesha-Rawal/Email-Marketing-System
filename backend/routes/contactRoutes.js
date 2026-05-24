import express from "express";
import contactController from "../controllers/contactController.js";
import upload from "../middleware/multer.js";
import { authenticate, authorizePermission } from "../middleware/auth.js";
import { PERMISSIONS } from "../config/permissions.js";

const router = express.Router();

router.get(
  "/contacts",
  authenticate,
  authorizePermission(PERMISSIONS.CONTACTS_READ),
  contactController.getAllContacts,
);
router.post(
  "/contacts",
  authenticate,
  authorizePermission(PERMISSIONS.CONTACTS_WRITE),
  contactController.addContact,
);
router.put(
  "/contacts/:id",
  authenticate,
  authorizePermission(PERMISSIONS.CONTACTS_WRITE),
  contactController.updateContact,
);
router.delete(
  "/contacts/:id",
  authenticate,
  authorizePermission(PERMISSIONS.CONTACTS_WRITE),
  contactController.deleteContact,
);
router.post(
  "/contacts/upload",
  authenticate,
  authorizePermission(PERMISSIONS.CONTACTS_WRITE),
  upload.single("file"),
  contactController.uploadCSV,
);

export default router;
