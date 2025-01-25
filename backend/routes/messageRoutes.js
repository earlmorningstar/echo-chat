import express from "express";
const router = express.Router();
import {authenticateUser} from "../middleware/authMiddleware.js";
import {
  getChatHistory,
  sendMessage,
  getLastMessage,
  markMessageAsRead,
  getUnreadCount,
} from "../controllers/messageController.js";

router.get("/:friendId", authenticateUser, getChatHistory);
router.post("/send", authenticateUser, sendMessage);
router.get("/last/:userId", authenticateUser, getLastMessage);
router.post("/mark-read/:friendId", authenticateUser, markMessageAsRead);
router.get("/unread-count/:friendId", authenticateUser, getUnreadCount);

export default router;
