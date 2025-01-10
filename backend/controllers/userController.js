const { ObjectId } = require("mongodb");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const {
  sendVerificationEmail,
  sendPasswordResetCode,
  sendFriendRequestNotificationEmail,
  sendFriendRequestAcceptedEmail,
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

    sendSuccess(res, 201, "Please check your email for verification code.", {
      userid: user.insertedId,
    });
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
        userId: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      process.env.JWT_SECRET,
      { expiresIn: "9h" }
    );

    const sanitizedUser = {
      _id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isVerified: user.isVerified,
    };

    sendSuccess(res, 200, "Login successful", {
      user: sanitizedUser,
      token: token,
    });
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

const getUserProfile  = async (req, res) => {
  try {
    const userObjectId = new ObjectId(req.userId);
    const user = await req.db.collection("users").findOne({_id: userObjectId});

    if(!user) {
      return sendError(res, 400, "User not found");
    }

    const userData = {
      _id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isVerified: user.isVerified,
    };
    sendSuccess(res, 200, "User profile retrieved successfully", {user: userData});
  } catch(error) {
    console.error("Error retrieving user profile:", error);
    sendError(res, 500, "Error retrieving user profile", {error: error.message});
  }
}

const sendFriendRequest = async (req, res) => {
  console.log("Request body:", req.body);
  console.log("User ID from token:", req.userId);

  const { receiverEmail } = req.body;

  if (!receiverEmail) {
    return sendError(res, 400, "Receiver email is required");
  }

  try {
    const senderObjectId = new ObjectId(req.userId);
    const sender = await req.db
      .collection("users")
      .findOne({ _id: senderObjectId });
    console.log("Sender found:", sender);

    if (!sender) {
      return sendError(res, 400, "Sender not found");
    }

    if (sender.email === receiverEmail) {
      return sendError(
        res,
        400,
        "You cannot send a friend request to yourself, haha!"
      );
    }

    const receiver = await req.db
      .collection("users")
      .findOne({ email: receiverEmail });
    console.log("Reciever found:", receiver);

    if (!receiver) {
      return sendError(
        res,
        400,
        "User not found. Please check the email address."
      );
    }

    const existingRequest = await req.db.collection("friendRequests").findOne({
      senderId: senderObjectId,
      receiverId: receiver._id,
      status: { $in: ["pending", "accepted"] },
    });
    console.log("Existing request:", existingRequest);

    if (existingRequest) {
      const status =
        existingRequest.status === "pending"
          ? "already send"
          : "already friends";
      return sendError(res, 400, `Friend request ${status}`);
    }

    const friendRequest = {
      senderId: senderObjectId,
      receiverId: receiver._id,
      senderName: `${sender.firstName} ${sender.lastName}`,
      receiverName: `${receiver.firstName} ${receiver.lastName}`,
      status: "pending",
      createdAt: new Date(),
    };
    console.log("Creating friend request:", friendRequest);

    await req.db.collection("friendRequests").insertOne(friendRequest);

    try {
      await sendFriendRequestNotificationEmail(
        receiver.email,
        receiver.firstName,
        `${sender.firstName} ${sender.lastName}`
      );
    } catch (emailError) {
      console.error(
        "Failed to send friend request notification email:",
        emailError
      );
    }

    sendSuccess(res, 200, "Friend request sent successfully.");
  } catch (error) {
    console.error("Detailed error in sendFriendRequest:", {
      error: error.message,
      stack: error.stack,
      userId: req.userId,
      receiverEmail,
    });

    if (error.name === "BSONTypeError" || error.name === "BSONError") {
      return sendError(res, 400, "Invalid user ID format");
    }

    sendError(res, 500, "Error sending friend request", {
      error: error.message,
    });
  }
};

const getFriendRequests = async (req, res) => {
  const userId = req.userId;

  try {
    const userObjectId = new ObjectId(userId);

    const [sentRequests, recievedRequests] = await Promise.all([
      req.db
        .collection("friendRequests")
        .find({
          senderId: userObjectId,
          status: "pending",
        })
        .toArray(),
      req.db
        .collection("friendRequests")
        .find({ receiverId: userObjectId, status: "pending" })
        .toArray(),
    ]);

    console.log("Database results:", {
      sent: sentRequests,
      recieved: recievedRequests,
    });

    const response = {
      statusCode: 200,
      message: "Request retrieved successfully",
      data: {
        sent: sentRequests || [],
        received: recievedRequests || [],
      },
    };

    console.log("Sending response:", response);
    // sendSuccess(res, 200, "Request retrieved successfully", {
    //   sent: sentRequests,
    //   received: recievedRequests,
    // });
    return res.status(200).json(response);
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
    const requestObjectId = new ObjectId(requestId);
    const userObjectId = new ObjectId(userId);

    console.log("Looking for request with:", {
      requestObjectId,
      userObjectId,
      action,
    });

    const request = await req.db.collection("friendRequests").findOne({
      _id: requestObjectId,
      receiverId: userObjectId,
    });

    console.log("Found request:", request);

    if (!request) {
      return sendError(res, 404, "Friend request not found");
    }

    if (action === "accept") {
      await req.db
        .collection("friendRequests")
        .updateOne(
          { _id: requestObjectId },
          { $set: { status: "accepted", updatedAt: new Date() } }
        );

      const senderObjectId =
        typeof request.senderId === "string"
          ? new ObjectId(request.senderId)
          : request.senderId;

      const sender = await req.db
        .collection("users")
        .findOne({ _id: senderObjectId });
      const accepter = await req.db
        .collection("users")
        .findOne({ _id: userObjectId });

      if (sender && accepter) {
        try {
          await sendFriendRequestAcceptedEmail(
            sender.email,
            sender.firstName,
            `${accepter.firstName} ${accepter.lastName}`
          );
        } catch (emailError) {
          console.error("Failed to send acceptance email:", emailError);
        }
      }

      //adding to friends list on both ends
      await Promise.all([
        req.db
          .collection("users")
          .updateOne(
            { _id: senderObjectId },
            { $addToSet: { friends: userObjectId } }
          ),
        req.db
          .collection("users")
          .updateOne(
            { _id: userObjectId },
            { $addToSet: { friends: senderObjectId } }
          ),
      ]);
      return sendSuccess(res, 200, "Friend request accepted");
    } else if (action === "decline") {
      await req.db
        .collection("friendRequests")
        .updateOne(
          { _id: requestObjectId },
          { $set: { status: "declined", updatedAt: new Date() } }
        );
      return sendSuccess(res, 200, "Friend request declined");
    }
  } catch (error) {
    console.error("Error handling friend request:", {
      error: error.message,
      stack: error.stack,
      requestId,
      userId,
      action,
    });
    if (error.message.includes("ObjectId")) {
      return sendError(res, 400, "Invalid Request ID format");
    }
    sendError(res, 500, "Error handling friend request", {
      error: error.message,
    });
  }
};

const getFriends = async (req, res) => {
  try {
    const userObjectId = new ObjectId(req.userId);

    const user = await req.db
      .collection("users")
      .findOne({ _id: userObjectId });

    if (!user) {
      return sendError(res, 404, "User not found");
    }

    const userFriends = user.friends || [];

    const friendObjectIds = userFriends.map((id) => new ObjectId(id));

    const friends = await req.db
      .collection("users")
      .find({ _id: { $in: friendObjectIds } })
      .project({ password: 0, resetPasswordToken: 0, resetPasswordExpires: 0 })
      .toArray();

      const formattedFriends = friends.map(friend => ({
        ...friend,
        _id: friend._id.toString()
      }));

    sendSuccess(res, 200, "Friends retrieved successfully", { friends: formattedFriends });
  } catch (error) {
    console.error("Error retrieving friends:", error);

    if (error.name === "BSONTypeError" || error.name === "BSONError") {
      return sendError(res, 400, "invalid user ID format");
    }

    sendError(res, 500, "Error retrieving friends", { error: error.message });
  }
};

const getUserById = async (req, res) => {
  const { userId } = req.params;
  try {

    const userObjectId = new ObjectId(userId);
  
    const user = await req.db.collection("users").findOne({ _id: userObjectId });
    if (!user) {
      return sendError(res, 404, "User not found");
    }

    const userResponse = {
      ...user,
      _id: user._id.toString()
    };

    sendSuccess(res, 200, "User retrieved successfully", { user: userResponse });
  } catch (error) {
    if(error.name === "BSONTypeError" || error.name === "BSONError") {
      return sendError(res, 400, "Invalid user ID format");
    }
    sendError(res, 500, "Error retrieving user", { error: error.message });
  }
};

module.exports = {
  createUser,
  verifyEmail,
  loginUser,
  forgotPassword,
  resetPassword,
  getUserProfile,
  sendFriendRequest,
  getFriendRequests,
  handleFriendRequest,
  getFriends,
  getUserById,
};
