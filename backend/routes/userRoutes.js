import express from "express";
const router = express.Router();
import { authenticateUser } from "../middleware/authMiddleware.js";
import {
  createUser,
  verifyEmail,
  loginUser,
  forgotPassword,
  resetPassword,
  sendFriendRequest,
  getFriendRequests,
  handleFriendRequest,
  getFriends,
  getUserById,
  getUserProfile,
  updateUserStatus,
  getFriendshipStatus,
  updateUserProfile,
  deleteUserAccount,
} from "../controllers/userController.js";

router.post("/signup", createUser);
router.post("/verify-email", verifyEmail);
router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/profile", authenticateUser, getUserProfile);
router.patch("/user/profile", authenticateUser, updateUserProfile);
router.delete("/user/profile", authenticateUser, deleteUserAccount);

router.post("/user/send-friend-request", authenticateUser, sendFriendRequest);
router.get("/user/friend-requests", authenticateUser, getFriendRequests);
router.post(
  "/user/handle-friend-request",
  authenticateUser,
  handleFriendRequest
);
router.get("/user/friends", authenticateUser, getFriends);
router.get("/user/:userId", authenticateUser, getUserById);
router.post("/user/status", authenticateUser, updateUserStatus);
router.get("/user/friendship/:friendId", authenticateUser, getFriendshipStatus);

export default router;
