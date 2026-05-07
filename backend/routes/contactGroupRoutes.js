import express from "express";
import contactGroupController from "../controllers/contactGroupController.js";
import { authenticate, authorizePermission } from "../middleware/auth.js";
import { PERMISSIONS } from "../config/permissions.js";

const router = express.Router();

router.get(
  "/contact-groups",
  authenticate,
  authorizePermission(PERMISSIONS.CONTACT_GROUPS_READ),
  contactGroupController.getContactGroups,
);
router.get(
  "/contact-groups/:groupId/contacts",
  authenticate,
  authorizePermission(PERMISSIONS.CONTACT_GROUPS_READ),
  contactGroupController.getGroupContacts,
);
router.post(
  "/contact-groups",
  authenticate,
  authorizePermission(PERMISSIONS.CONTACT_GROUPS_WRITE),
  contactGroupController.createContactGroup,
);
router.post(
  "/contact-groups/:groupId/contacts",
  authenticate,
  authorizePermission(PERMISSIONS.CONTACT_GROUPS_WRITE),
  contactGroupController.addContactsToGroup,
);
router.delete(
  "/contact-groups/:groupId/contacts/:contactId",
  authenticate,
  authorizePermission(PERMISSIONS.CONTACT_GROUPS_WRITE),
  contactGroupController.removeContactFromGroup,
);
router.put(
  "/contact-groups/:groupId",
  authenticate,
  authorizePermission(PERMISSIONS.CONTACT_GROUPS_WRITE),
  contactGroupController.updateContactGroup,
);
router.delete(
  "/contact-groups/:groupId",
  authenticate,
  authorizePermission(PERMISSIONS.CONTACT_GROUPS_WRITE),
  contactGroupController.deleteContactGroup,
);

export default router;
