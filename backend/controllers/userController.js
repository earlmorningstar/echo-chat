import { GridFSBucket, ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  sendVerificationEmail,
  sendPasswordResetCode,
  sendFriendRequestNotificationEmail,
  sendFriendRequestAcceptedEmail,
} from "../utils/emailService.js";
import { sendError, sendSuccess } from "../utils/response.js";

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
    const normalizedEmail = email.toLowerCase();

    const existingUser = await req.db
      .collection("users")
      .findOne({ email: normalizedEmail });
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
    sendError(res, 500, "Error creating user");
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
    sendError(res, 500, "Error verifying email");
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
      return sendError(res, 401, "Password is incorrect");
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isVerified: user.isVerified,
        avatarUrl: user.avatarUrl,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    const sanitizedUser = {
      _id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isVerified: user.isVerified,
      avatarUrl: user.avatarUrl,
    };

    sendSuccess(res, 200, "Login successful", {
      user: sanitizedUser,
      token: token,
    });
  } catch (error) {
    sendError(res, 500, "Error logging in");
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
    sendError(res, 500, "Error processing password reset");
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
    sendError(res, 500, "Error resetting password");
  }
};

const getUserProfile = async (req, res) => {
  try {
    const userObjectId = new ObjectId(req.userId);
    const user = await req.db
      .collection("users")
      .findOne({ _id: userObjectId });

    if (!user) {
      return sendError(res, 400, "User not found");
    }

    const userData = {
      _id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isVerified: user.isVerified,
      avatarUrl: user.avatarUrl,
      lastSeen: user.lastSeen,
      status: user.status,
    };
    sendSuccess(res, 200, "User profile retrieved successfully", {
      user: userData,
    });
  } catch (error) {
    sendError(res, 500, "Error retrieving user profile");
  }
};

const updateUserProfile = async (req, res) => {
  try {
    const userObjectId = new ObjectId(req.userId);
    const { avatarUrl } = req.body;

    await req.db
      .collection("users")
      .updateOne({ _id: userObjectId }, { $set: { avatarUrl: avatarUrl } });

    const user = await req.db
      .collection("users")
      .findOne({ _id: userObjectId });

    const friendships = await req.db
      .collection("friendships")
      .find({
        $or: [{ user1id: userObjectId }, { user2id: userObjectId }],
      })
      .toArray();

    friendships.forEach(async (friendship) => {
      await broadcastProfileUpdate(friendship, user);
    });

    sendSuccess(res, 200, "Profile updated successfully");
  } catch (error) {
    sendError(res, 500, "Error updating profile");
  }
};

const sendFriendRequest = async (req, res) => {
  const { receiverEmail } = req.body;

  if (!receiverEmail) {
    return sendError(res, 400, "Receiver email is required");
  }

  try {
    const senderObjectId = new ObjectId(req.userId);
    const sender = await req.db
      .collection("users")
      .findOne({ _id: senderObjectId });

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

    if (!receiver) {
      return sendError(res, 400, "This user is not registered with EchoChat");
    }

    const existingRequest = await req.db.collection("friendRequests").findOne({
      senderId: senderObjectId,
      receiverId: receiver._id,
      status: { $in: ["pending", "accepted"] },
    });

    if (existingRequest) {
      const errorMessage =
        existingRequest.status === "pending"
          ? "Friend request already sent"
          : "Users are already friends";
      return sendError(res, 400, errorMessage);
    }

    const friendRequest = {
      senderId: senderObjectId,
      receiverId: receiver._id,
      senderName: `${sender.firstName} ${sender.lastName}`,
      receiverName: `${receiver.firstName} ${receiver.lastName}`,
      status: "pending",
      createdAt: new Date(),
    };

    await req.db.collection("friendRequests").insertOne(friendRequest);

    try {
      await sendFriendRequestNotificationEmail(
        receiver.email,
        receiver.firstName,
        `${sender.firstName} ${sender.lastName}`
      );
    } catch {
      console.error("Failed to send friend request notification email:");
    }

    sendSuccess(res, 200, "Friend request sent successfully");
  } catch (error) {
    sendError(res, 500, "Error sending friend request");
  }
};

const getFriendRequests = async (req, res) => {
  const userId = req.userId;

  try {
    const userObjectId = new ObjectId(userId);

    const [sentRequests, receivedRequests] = await Promise.all([
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

    const response = {
      statusCode: 200,
      message: "Request retrieved successfully",
      data: {
        sent: sentRequests || [],
        received: receivedRequests || [],
      },
    };

    return res.status(200).json(response);
  } catch (error) {
    sendError(res, 500, "Error retrieving friend request");
  }
};

const handleFriendRequest = async (req, res) => {
  const { requestId, action } = req.body;
  const userId = req.userId;

  try {
    const requestObjectId = new ObjectId(requestId);
    const userObjectId = new ObjectId(userId);

    const request = await req.db.collection("friendRequests").findOne({
      _id: requestObjectId,
      receiverId: userObjectId,
    });

    if (!request) {
      return sendError(res, 404, "Friend request not found");
    }

    if (action === "accept") {
      try {
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
          } catch {
            console.error("Failed to send acceptance email:");
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

        const friendship = await req.db.collection("friendships").insertOne({
          user1: senderObjectId,
          user2: userObjectId,
          createdAt: new Date(),
          status: "active",
        });

        return sendSuccess(res, 200, "Friend request accepted", friendship);
      } catch (error) {
        console.error("Error in friend request acceptance:");
        throw error;
      }
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
    console.error("Error handling friend request:");
    if (error.message.includes("ObjectId")) {
      return sendError(res, 400, "Invalid Request ID format");
    }
    sendError(res, 500, "Error handling friend request");
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

    const friendObjectIds = userFriends
      .map((id) => {
        try {
          return new ObjectId(id);
        } catch (error) {
          console.error("Invalid friend Id");
          return null;
        }
      })
      .filter((id) => id !== null);

    const friends = await req.db
      .collection("users")
      .find({ _id: { $in: friendObjectIds } })
      .project({ password: 0, resetPasswordToken: 0, resetPasswordExpires: 0 })
      .toArray();

    const formattedFriends = friends.map((friend) => ({
      ...friend,
      _id: friend._id.toString(),
    }));

    sendSuccess(
      res,
      200,
      "Friends retrieved successfully",
      {
        friends: formattedFriends,
      },
      false
    );
  } catch (error) {
    console.error("Error retrieving friends:");

    if (error.name === "BSONTypeError" || error.name === "BSONError") {
      return sendError(res, 400, "invalid user ID format");
    }

    sendError(res, 500, "Error retrieving friends");
  }
};

const getUserById = async (req, res) => {
  const { userId } = req.params;

  try {
    const userObjectId = new ObjectId(userId);

    const user = await req.db
      .collection("users")
      .findOne({ _id: userObjectId });

    if (!user) {
      return sendError(res, 404, "User not found");
    }

    const userResponse = {
      ...user,
      _id: user._id.toString(),
    };

    sendSuccess(res, 200, "User retrieved successfully", {
      user: userResponse,
    });
  } catch (error) {
    console.error("Detailed User Retrieval Error");

    if (error.name === "BSONTypeError" || error.name === "BSONError") {
      return sendError(res, 400, "Invalid user ID format");
    }
    sendError(res, 500, "Error retrieving user");
  }
};

const updateUserStatus = async (req, res) => {
  const userId = req.userId;
  const { status } = req.body;

  try {
    await req.db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          lastSeen: new Date(),
          status: "offline",
        },
      }
    );

    sendSuccess(res, 200, "User status updated successfully");
  } catch (error) {
    sendError(res, 500, "Error updating user status", { error: error.message });
  }
};

const getFriendshipStatus = async (req, res) => {
  try {
    const userId = new ObjectId(req.user._id);
    const friendId = new ObjectId(req.params.friendId);

    const friendship = await req.db.collection("friendships").findOne({
      $or: [
        { user1: userId, user2: friendId },
        { user1: friendId, user2: userId },
      ],
    });

    if (!friendship) {
      return sendError(res, 404, "Friendship not found");
    }

    const createdAt =
      friendship.createdAt instanceof Date
        ? friendship.createdAt.toISOString()
        : new Date(friendship.createdAt).toISOString();

    const response = {
      data: {
        friendship: {
          createdAt,
          _id: friendship._id.toString(),
          user1: friendship.user1.toString(),
          user2: friendship.user2.toString(),
          status: friendship.status,
        },
      },
    };

    sendSuccess(res, 200, "friendship retrieved successfully", response);
  } catch (error) {
    console.error("Error in getFriendshipStatus");

    if (error.name === "BSONTypeError" || error.name === "BSONError") {
      return sendError(res, 400, "Invalid ID format");
    }
    sendError(res, 500, "Error retrieving friendship");
  }
};

const deleteUserAccount = async (req, res) => {
  try {
    const userObjectId = new ObjectId(req.userId);

    //deleting user doc
    await req.db.collection("users").deleteOne({ _id: userObjectId });

    //clean up related data (delete user files from gridFS)
    const bucket = new GridFSBucket(req.db);
    const userFiles = await req.db
      .collection("fs.files")
      .find({ "metadata.userId": req.userId })
      .toArray();

    for (const file of userFiles) {
      await bucket.delete(file._id);
    }

    sendSuccess(res, 200, "Account deleted successfully");
  } catch (error) {
    sendError(res, 500, "Error deleting account");
  }
};

const logoutUser = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return sendError(res, 401, "User not authenticated");
    }
    const userId = new ObjectId(req.user._id);

    await req.db
      .collection("users")
      .updateOne({ _id: userId }, { $unset: { activeTokens: 1 } });

    sendSuccess(res, 200, "Logout successful");
  } catch (error) {
    sendError(res, 500, "Error during logout");
  }
};

export {
  createUser,
  verifyEmail,
  loginUser,
  forgotPassword,
  resetPassword,
  getUserProfile,
  updateUserProfile,
  sendFriendRequest,
  getFriendRequests,
  handleFriendRequest,
  getFriends,
  getUserById,
  updateUserStatus,
  getFriendshipStatus,
  deleteUserAccount,
  logoutUser,
};
