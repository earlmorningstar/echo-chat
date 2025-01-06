const express = require("express");
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
} = require("../controllers/userController");

const router = express.Router();

router.post("/signup", createUser);
router.post("/verify-email", verifyEmail);
router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

router.post("/user/add-friend", authenticateUser, sendFriendRequest);
router.get("/users/friend-requests", authenticateUser, getFriendRequests);
router.post(
  "/users/accept-request/:requestId",
  authenticateUser,
  handleFriendRequest
);
router.post(
  "/users/decline-request/:requestId",
  authenticateUser,
  handleFriendRequest
);

module.exports = router;
