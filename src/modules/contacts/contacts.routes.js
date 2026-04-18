import express from "express";
import { requireAuthHeaders } from "../../common/middleware/auth.middleware.js";
import {
  checkDuplicateBusinessController,
  checkDuplicatePhoneEmailController,
  getAllContactsController
} from "./contacts.controller.js";

const router = express.Router();

router.post("/api/check-duplicate", requireAuthHeaders, checkDuplicatePhoneEmailController);
router.post("/api/check-duplicate-contact", requireAuthHeaders, checkDuplicatePhoneEmailController);
router.post("/api/check-duplicate-business", requireAuthHeaders, checkDuplicateBusinessController);
router.post("/api/get-all-contacts", requireAuthHeaders, getAllContactsController);

export default router;
