const express = require("express");
const router = express.Router();
const authenticateUser = require("../middleware/authMiddleware");
const {
  getChatHistory,
  sendMessage,
  getLastMessage,
} = require("../controllers/messageController");

router.get("/:friendId", authenticateUser, getChatHistory);
router.post("/send", authenticateUser, sendMessage);
router.get("/last/:userId", authenticateUser, getLastMessage);

module.exports = router;
