import express from "express";
import contactGroupController from "../controllers/contactGroupController.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();

router.get(
  "/contact-groups",
  authenticate,
  contactGroupController.getContactGroups,
);
router.get(
  "/contact-groups/:groupId/contacts",
  authenticate,
  contactGroupController.getGroupContacts,
);
router.post(
  "/contact-groups",
  authenticate,
  authorizeRoles("marketing"),
  contactGroupController.createContactGroup,
);
router.post(
  "/contact-groups/:groupId/contacts",
  authenticate,
  authorizeRoles("marketing"),
  contactGroupController.addContactsToGroup,
);
router.delete(
  "/contact-groups/:groupId/contacts/:contactId",
  authenticate,
  authorizeRoles("marketing"),
  contactGroupController.removeContactFromGroup,
);
router.delete(
  "/contact-groups/:groupId",
  authenticate,
  authorizeRoles("marketing"),
  contactGroupController.deleteContactGroup,
);

export default router;
