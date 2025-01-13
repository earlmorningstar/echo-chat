const express = require("express");
const router = express.Router();
const authenticateUser = require("../middleware/authMiddleware");
const {
  getChatHistory,
  sendMessage,
  getLastMessage,
  markMessageAsRead,
  getUnreadCount,
} = require("../controllers/messageController");

router.get("/:friendId", authenticateUser, getChatHistory);
router.post("/send", authenticateUser, sendMessage);
router.get("/last/:userId", authenticateUser, getLastMessage);
router.post("/mark-read/:friendId", authenticateUser, markMessageAsRead);
router.get("/unread-count/:friendId", authenticateUser, getUnreadCount);

module.exports = router;
