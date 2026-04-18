import express from "express";
import { requireAuthHeaders } from "./common/middleware/auth.middleware.js";
import {
  checkDuplicateBusinessController,
  checkDuplicatePhoneEmailController,
  checkDuplicatePhoneEmailLegacyController,
  getAllContactsController
} from "./modules/contacts/contacts.controller.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

app.post("/api/check-duplicate", requireAuthHeaders, checkDuplicatePhoneEmailLegacyController);
app.post("/api/check-duplicate-contact", requireAuthHeaders, checkDuplicatePhoneEmailController);
app.post("/api/check-duplicate-business", requireAuthHeaders, checkDuplicateBusinessController);
app.post("/api/get-all-contacts", requireAuthHeaders, getAllContactsController);

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
