import express from "express";
const router = express.Router();
import { upload } from "../config/storage.js";
import {authenticateUser} from "../middleware/authMiddleware.js";
import {
  handleFileUpload,
  serveFile,
} from "../controllers/uploadController.js";

router.post(
  "/upload",
  authenticateUser,
  upload.single("file"),
  handleFileUpload
);
router.get("/files/:fileId", serveFile);

export default router;
