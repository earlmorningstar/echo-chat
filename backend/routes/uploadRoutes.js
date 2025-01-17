const express = require("express");
const router = express.Router();
const { upload } = require("../config/storage");
const authenticateUser = require("../middleware/authMiddleware");
const {
  handleFileUpload,
  serveFile,
} = require("../controllers/uploadController");

router.post(
  "/upload",
  authenticateUser,
  upload.single("file"),
  handleFileUpload
);
router.get("/files/:fileId", serveFile);

module.exports = router;
