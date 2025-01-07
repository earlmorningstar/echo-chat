const express = require("express");
const router = express.Router();
const authenticateUser = require("../middleware/authMiddleware");
const {
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
} = require("../controllers/userController");

router.post("/signup", createUser);
router.post("/verify-email", verifyEmail);
router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

router.post("/user/send-friend-request", authenticateUser, sendFriendRequest);
router.get("/user/friend-requests", authenticateUser, getFriendRequests);
router.post(
  "/user/handle-friend-request",
  authenticateUser,
  handleFriendRequest
);
router.get("/user/friends", authenticateUser, getFriends);
router.get("/user/:userId", authenticateUser, getUserById);

module.exports = router;
