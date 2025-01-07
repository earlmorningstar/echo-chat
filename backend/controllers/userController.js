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
    const sender = await req.db.collection("users").findOne({ _id: senderId });
    const receiver = await req.db
      .collection("users")
      .findOne({ email: receiverEmail });

    if (!receiver) {
      return sendError(
        res,
        400,
        "User not found. Please check the email address."
      );
    }

    const existingRequest = await req.db.collection("friendRequests").findOne({
      senderId,
      receiverId: receiver._id,
      status: { $in: ["pending", "accepted"] },
    });

    if (existingRequest) {
      const status =
        existingRequest.status === "pending"
          ? "already send"
          : "already friends";
      return sendError(res, 400, `Friend request ${status}`);
    }

    await req.db.collection("friendRequests").insertOne({
      senderId,
      receiverId: receiver._id,
      senderName: `${sender.firstName} ${sender.lastName}`,
      receiverName: `${receiver.firstName} ${receiver.lastName}`,
      status: "pending",
      createdAt: new Date(),
    });
    sendSuccess(res, 200, "Friend request sent successfully.");
  } catch (error) {
    console.error("Error sending friend request:", error);
    sendError(res, 500, "Error sending friend request", {
      error: error.message,
    });
  }
};

const getFriendRequests = async (req, res) => {
  const userId = req.userId;

  try {
    const [sentRequests, recievedRequests] = await Promise.all([
      req.db.collection("friendRequests").find({ senderId: userId }).toArray(),
      req.db
        .collection("friendRequests")
        .find({ receiverId: userId })
        .toArray(),
    ]);
    sendSuccess(res, 200, "Request retrieved successfully", {
      sent: sentRequests,
      received: recievedRequests,
    });
  } catch (error) {
    console.error("Error retrieving friend requests:", error);
    sendError(res, 500, "Error retrieving friend request", {
      error: error.message,
    });
  }
};

const handleFriendRequest = async (req, res) => {
  const { requestId, action } = req.body;
  const userId = req.userId;

  try {
    const request = await req.db.collection("friendRequests").findOne({
      _id: requestId,
      receiverId: userId,
    });

    if (!request) {
      return sendError(res, 404, "Friend request not found");
    }

    if (action === "accept") {
      await req.db
        .collection("friendRequests")
        .updateOne(
          { _id: requestId },
          { $set: { status: "accepted", updatedAt: new Date() } }
        );

      //adding to friends list on both ends
      await Promise.all([
        req.db
          .collection("users")
          .updateOne(
            { _id: request.senderId },
            { $addToSet: { friends: request.receiverId } }
          ),
        req.db
          .collection("users")
          .updateOne(
            { _id: request.receiverId },
            { $addToSet: { friends: request.senderId } }
          ),
      ]);
      sendSuccess(res, 200, "Friend request accepted");
    } else if (action === "decline") {
      await req.db
        .collection("friendRequests")
        .updateOne(
          { _id: requestId },
          { $set: { status: "declined", updatedAt: new Date() } }
        );
      sendSuccess(res, 200, "Friend request declined");
    }
  } catch (error) {
    console.error("Error handling ffriend request:", error);
    sendError(res, 500, "Error handling friend request", {
      error: error.message,
    });
  }
};

const getFriends = async (req, res) => {
  const userId = req.userId;
  try {
    const user = await req.db.collection("users").findOne({ _id: userId });
    const friends = await req.db
      .collection("users")
      .find({ _id: { $in: user.friends || [] } })
      .toArray();

    sendSuccess(res, 200, "Friends retrieved successfully", { friends });
  } catch (error) {
    sendError(res, 500, "Error retrieving friends", { error: error.message });
  }
};

const getUserById = async (req, res) => {
  const {userId} = req.params;
  try {
    const user = await req.db.collection('users').findOne({_id: userId});
    if(!user) {
      return sendError(res, 404, "User not found");
    }
    sendSuccess(res, 200, "User retrieved successfully", {user});
  }catch(error) {
    sendError(res, 500, "Error retrieving user", {error: error.message})
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
  getFriends,
  getUserById,
};