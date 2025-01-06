const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const {
  sendVerificationEmail,
  sendPasswordResetCode,
} = require("../utils/emailService");
const { sendError, sendSuccess } = require("../utils/response");

const generateRandomCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const createUser = async (req, res) => {
  const { firstName, lastName, email, password, confirmPassword } = req.body;

  if (!firstName || !lastName || !email || !password || !confirmPassword) {
    return sendError(res, 400, "All fields are required");
  }

  if (password !== confirmPassword) {
    return sendError(res, 400, "Passwords do not match");
  }

  try {
    const existingUser = await req.db.collection("users").findOne({ email });
    if (existingUser) {
      return sendError(
        res,
        400,
        "Email already in use. Try using another email address"
      );
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = generateRandomCode();

    const user = await req.db.collection("users").insertOne({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      isVerified: false,
      verificationCode,
      verificationCodeExpires: new Date(Date.now() + 600000),
    });

    await sendVerificationEmail(email, verificationCode);

    sendSuccess(
      res,
      201,
      "Account created successfully. Please check your email for verification code.",
      { userid: user.insertedId }
    );
  } catch (error) {
    console.error("Error creating user:", error);
    sendError(res, 500, "Error creating user", { error: error.message });
  }
};

const verifyEmail = async (req, res) => {
  const { email, code } = req.body;

  try {
    const user = await req.db.collection("users").findOne({
      email,
      verificationCode: code,
      verificationCodeExpires: { $gt: new Date() },
    });

    if (!user) {
      return sendError(res, 400, "Invalid or expired verification code");
    }

    await req.db.collection("users").updateOne(
      { email },
      {
        $set: { isVerified: true },
        $unset: { verificationCode: "", verificationCodeExpires: "" },
      }
    );
    sendSuccess(res, 200, "Email verified successfully");
  } catch (error) {
    console.error("Error verifying email:", error);
    sendError(res, 500, "Error verifying email", { error: error.message });
  }
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return sendError(res, 400, "Email and password are required");
  }

  try {
    const user = await req.db.collection("users").findOne({ email });

    if (!user) {
      return sendError(res, 401, "Invalid email or password");
    }

    if (!user.isVerified) {
      return sendError(res, 401, "Please verify your email before logging in");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return sendError(res, 401, "Invalid email or password");
    }

    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      process.env.JWT_SECRET,
      { expiresIn: "9h" }
    );

    sendSuccess(res, 200, "Login successful", token);
  } catch (error) {
    console.error("Error during login:", error);
    sendError(res, 500, "Error logging in", { error: error.message });
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return sendError(res, 400, "Your email address is required");
  }

  try {
    const user = await req.db.collection("users").findOne({ email });
    if (!user) {
      return sendError(res, 404, "User not found");
    }

    const resetCode = generateRandomCode();
    // const resetTokenExpiry = Date.now() + 3600000;
    await req.db.collection("users").updateOne(
      { email },
      {
        $set: {
          resetCode,
          resetCodeExpires: new Date(Date.now() + 600000),
        },
      }
    );

    await sendPasswordResetCode(email, resetCode);

    // await userModel.setPasswordResetToken(
    //   req.db,
    //   email,
    //   resetToken,
    //   resetTokenExpiry
    // );

    // const resetUrl = `http://localhost:3000/reset-password/${resetToken}`;

    // await transporter.sendMail({
    //   from: '"EchoChat Support Group" <support@echochat.com>',
    //   to: email,
    //   subject: "Password Reset Request",
    //   text: `You requested a password reset. Click here to reset your EchoChat password. Do not click the link if you did not initiate this process.: ${resetUrl}`,
    //   html: `<p>You requested a password reset. Click <a href="${resetUrl}">here</a> to reset your EchoChat password. Do not click the link if you did not initiate this process.</p>`,
    // });

    sendSuccess(res, 200, "Password reset code has been sent to your email");
  } catch (error) {
    console.error("Error processing password reset:", error);
    sendError(res, 500, "Error processing password reset", {
      error: error.message,
    });
  }
};

const resetPassword = async (req, res) => {
  const { email, code, newPassword } = req.body;

  try {
    const user = await req.db.collection("users").findOne({
      email,
      resetCode: code,
      resetCodeExpires: { $gt: new Date() },
    });

    if (!user) {
      return sendError(res, 400, "Invalid or expired reset code.");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await req.db.collection("users").updateOne(
      { email },
      {
        $set: { password: hashedPassword },
        $unset: { resetCode: "", resetCodeExpires: "" },
      }
    );

    sendSuccess(res, 200, "Password reset successful.");
  } catch (error) {
    console.error("Error resetting password:", error);
    sendError(res, 500, "Error resetting password", { error: error.message });
  }
};

const sendFriendRequest = async (req, res) => {
  const { receiverEmail } = req.body;
  const senderId = req.userId;

  try {
    const receiver = await userModel.findUserByEmail(req.db, receiverEmail);
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: "This user is not registered with EchoChat",
      });
    }

    await userModel.createFriendRequest(req.db, senderId, receiver._id);
    res
      .status(200)
      .json({ success: true, message: "Friend request sent successfully." });
  } catch (error) {
    console.error("Error sending friend request:", error);
    res
      .status(500)
      .json({ success: false, message: "Error sending friend request", error });
  }
};

const getFriendRequests = async (req, res) => {
  const userId = req.userId;

  try {
    const requests = await userModel.getPendingFriendRequests(req.db, userId);
    res.status(200).json({ success: true, requests });
  } catch (error) {
    console.error("Error retrieving friend requests:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving friend requests",
      error,
    });
  }
};

const handleFriendRequest = async (req, res) => {
  const { requestId, accept } = req.body;

  try {
    if (accept) {
      await userModel.acceptFriendRequest(req.db, requestId);
      res
        .status(200)
        .json({ success: true, message: "Friend request accepted" });
    } else {
      await userModel.declineFriendRequest(req.db, requestId);
      res
        .status(200)
        .json({ success: true, message: "Friend request declined" });
    }
  } catch (error) {
    console.error("Error handling friend request:", error);
    res.status(500).json({
      success: false,
      message: "Error handling friend request",
      error,
    });
  }
};

module.exports = {
  createUser,
  verifyEmail,
  loginUser,
  forgotPassword,
  resetPassword,
  sendFriendRequest,
  getFriendRequests,
  handleFriendRequest,
};
