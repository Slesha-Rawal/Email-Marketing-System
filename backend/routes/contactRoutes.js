import express from "express";
import contactController from "../controllers/contactController.js";
import upload from "../config/multer.js";

const router = express.Router();

router.get("/contacts", contactController.getAllContacts);
router.post("/contacts", contactController.addContact);
router.put("/contacts/:id", contactController.updateContact);
router.delete("/contacts/:id", contactController.deleteContact);
router.post(
  "/contacts/upload",
  upload.single("file"),
  contactController.uploadCSV
);

export default router;
