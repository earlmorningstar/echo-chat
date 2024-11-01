const express = require("express");
const {
  createUser,
  loginUser,
  forgotPassword,
  sendPasswordResetEmail,
  resetPassword,
} = require("../controllers/userController");

const router = express.Router();

router.post("/signup", createUser);
router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword, sendPasswordResetEmail);
router.post("/reset-password/:token", resetPassword);

module.exports = router;
