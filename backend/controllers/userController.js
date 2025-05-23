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

  try {
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      return sendError(res, 400, "All fields are required");
    }

    if (password !== confirmPassword) {
      return sendError(res, 400, "Passwords do not match");
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return sendError(res, 400, "Invalid email format");
    }

    // Check DB connection
    if (!req.db) {
      console.error("Database connection not available");
      return sendError(res, 500, "Database connection error");
    }

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

    const userDoc = {
      firstName,
      lastName,
      email: normalizedEmail,
      password: hashedPassword,
      isVerified: false,
      verificationCode,
      verificationCodeExpires: new Date(Date.now() + 600000),
      createdAt: new Date(),
      status: "offline",
      lastSeen: new Date(),
      friends: [],
    };

    const user = await req.db.collection("users").insertOne(userDoc);

    // Initialize friendships for new user
    try {
      await initializeFriendshipsForUser(req.db, user.insertedId);
    } catch (friendshipError) {
      console.error("Friendship initialization error");
    }

    try {
      await sendVerificationEmail(email, verificationCode);
    } catch (emailError) {
      console.error("Email sending error");
    }

    return sendSuccess(
      res,
      201,
      "Please check your email for verification code.",
      {
        userid: user.insertedId,
      },
      false
    );
  } catch (error) {
    console.error("User creation error");
    return sendError(
      res,
      500,
      "Error creating user",
      {
        error:
          process.env.NODE_ENV === "development"
            ? error.message
            : "Internal server error",
      },
      false
    );
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

    sendSuccess(
      res,
      200,
      "Login successful",
      {
        user: sanitizedUser,
        token: token,
      },
      false
    );
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
    sendSuccess(
      res,
      200,
      "User profile retrieved successfully",
      {
        user: userData,
      },
      false
    );
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

    //checking if either user has blocked the other
    const blockExists = await req.db.collection("blockedUsers").findOne({
      $or: [
        { blockerId: senderObjectId, blockedId: receiver._id },
        { blockerId: receiver._id, blockedId: senderObjectId },
      ],
    });

    if (blockExists) {
      return sendError(
        res,
        403,
        "Cannot send friend request due to block settings"
      );
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

const toObjectId = (id) => {
  if (!id) return null;
  try {
    if (id instanceof ObjectId) return id;
    return typeof id === "string" ? new ObjectId(id) : id;
  } catch (error) {
    return null;
  }
};

const toString = (id) => {
  if (!id) return null;
  if (typeof id === "string") return id;
  return id.toString();
};

const handleFriendRequest = async (req, res) => {
  const { requestId, action } = req.body;
  const userId = req.userId;

  try {
    const requestObjectId = toObjectId(requestId);
    const userObjectId = toObjectId(userId);

    if (!requestObjectId || !userObjectId) {
      return sendError(res, 400, "Invalid ID format");
    }

    const request = await req.db.collection("friendRequests").findOne({
      _id: requestObjectId,
      receiverId: userObjectId,
    });

    if (!request) {
      return sendError(res, 404, "Friend request not found");
    }

    const senderObjectId = toObjectId(request.senderId);

    if (action === "accept") {
      const session = req.db.client.startSession();

      try {
        await session.withTransaction(async () => {
          // Update request status
          await req.db.collection("friendRequests").updateOne(
            { _id: requestObjectId },
            {
              $set: {
                status: "accepted",
                updatedAt: new Date(),
              },
            },
            { session }
          );

          // Create or update friendship
          await req.db.collection("friendships").updateOne(
            {
              $or: [
                {
                  user1Id: toString(senderObjectId),
                  user2Id: toString(userObjectId),
                },
                {
                  user1Id: toString(userObjectId),
                  user2Id: toString(senderObjectId),
                },
              ],
            },
            {
              $set: {
                status: "accepted",
                updatedAt: new Date(),
              },
              $setOnInsert: {
                user1Id: toString(senderObjectId),
                user2Id: toString(userObjectId),
                createdAt: new Date(),
              },
            },
            { upsert: true, session }
          );

          // Get user details for email
          const [sender, accepter] = await Promise.all([
            req.db
              .collection("users")
              .findOne({ _id: senderObjectId }, { session }),
            req.db
              .collection("users")
              .findOne({ _id: userObjectId }, { session }),
          ]);

          if (sender && accepter) {
            try {
              await sendFriendRequestAcceptedEmail(
                sender.email,
                sender.firstName,
                `${accepter.firstName} ${accepter.lastName}`
              );
            } catch (emailError) {
              console.error("Failed to send acceptance email");
            }
          }
        });

        return sendSuccess(res, 200, "Friend request accepted");
      } catch (error) {
        console.error("Error in friend request acceptance");
      } finally {
        await session.endSession();
      }
    } else if (action === "decline") {
      await req.db.collection("friendRequests").updateOne(
        { _id: requestObjectId },
        {
          $set: {
            status: "declined",
            updatedAt: new Date(),
          },
        }
      );

      await req.db.collection("friendships").updateOne(
        {
          $or: [
            {
              user1Id: toString(senderObjectId),
              user2Id: toString(userObjectId),
            },
            {
              user1Id: toString(userObjectId),
              user2Id: toString(senderObjectId),
            },
          ],
        },
        {
          $set: {
            status: "declined",
            updatedAt: new Date(),
          },
        }
      );

      return sendSuccess(res, 200, "Friend request declined");
    }

    return sendError(res, 400, "Invalid action");
  } catch (error) {
    return sendError(res, 500, "Error handling friend request");
  }
};

const getFriends = async (req, res) => {
  try {
    const userId = toString(req.userId);
    const userObjectId = toObjectId(userId);

    if (!userObjectId) {
      return sendError(res, 400, "Invalid user ID format (to Get Friends)");
    }

    // Find all accepted friendships for this user
    const friendships = await req.db
      .collection("friendships")
      .find({
        $or: [{ user1Id: userId }, { user2Id: userId }],
        status: "accepted",
      })
      .toArray();

    const newFriendships = await req.db
      .collection("friendships")
      .find({
        $or: [{ user1Id: userId }, { user2Id: userId }],
        status: "accepted",
      })
      .toArray();

    if (newFriendships.length === 0) {
      return sendSuccess(
        res,
        200,
        "Friends retrieved successfully",
        {
          friends: [],
        },
        false
      );
    }
    // Extract friend IDs
    const friendIds = friendships
      .map((friendship) =>
        toObjectId(
          friendship.user1Id === userId
            ? friendship.user2Id
            : friendship.user1Id
        )
      )
      .filter((id) => id !== null);

    // Get friend details
    const friends = await req.db
      .collection("users")
      .find({ _id: { $in: friendIds } })
      .project({
        password: 0,
        resetPasswordToken: 0,
        resetPasswordExpires: 0,
        verificationCode: 0,
        verificationCodeExpires: 0,
      })
      .toArray();

    const formattedFriends = friends.map((friend) => ({
      ...friend,
      _id: toString(friend._id),
    }));

    return sendSuccess(
      res,
      200,
      "Friends retrieved successfully",
      {
        friends: formattedFriends,
      },
      false
    );
  } catch (error) {
    return sendError(res, 500, "Error retrieving friends");
  }
};

const initializeFriendshipsForUser = async (db, userId) => {
  try {
    // search for all users except the current user
    const otherUsers = await db
      .collection("users")
      .find({
        _id: { $ne: new ObjectId(userId) },
      })
      .toArray();

    // Create friendship records
    const friendshipPromises = otherUsers.map(async (otherUser) => {
      const existingFriendship = await db.collection("friendships").findOne({
        $or: [
          { user1Id: userId, user2Id: otherUser._id.toString() },
          { user1Id: otherUser._id.toString(), user2Id: userId },
        ],
      });

      if (!existingFriendship) {
        const status =
          otherUsers.indexOf(otherUser) < 3 ? "accepted" : "pending";

        return db.collection("friendships").insertOne({
          user1Id: userId,
          user2Id: otherUser._id.toString(),
          status,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    });

    await Promise.all(friendshipPromises);
    return true;
  } catch (error) {
    console.error("Error initializing friendships");
    return false;
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

    sendSuccess(
      res,
      200,
      "User retrieved successfully",
      {
        user: userResponse,
      },
      false
    );
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
    sendError(res, 500, "Error updating user status");
  }
};

const getFriendshipStatus = async (req, res) => {
  try {
    const currentUserId = req.userId;
    const { friendId } = req.params;

    const currentUserObjectId = toObjectId(currentUserId);
    const friendObjectId = toObjectId(friendId);

    if (!currentUserObjectId || !friendObjectId) {
      return sendError(res, 400, "Invalid user ID format");
    }

    //checking for block status
    const blockStatus = await Promise.all([
      req.db.collection("blockedUsers").findOne({
        blockerId: currentUserObjectId,
        blockedId: friendObjectId,
      }),
      req.db.collection("blockedUsers").findOne({
        blockerId: friendObjectId,
        blockedId: currentUserObjectId,
      }),
    ]);

    const isBlocked = !!blockStatus[0] || !!blockStatus[1];

    //ids to strings for consistency
    const currentUserIdStr = toString(currentUserObjectId);
    const friendIdStr = toString(friendObjectId);

    const friendship = await req.db.collection("friendships").findOne({
      $or: [
        { user1Id: currentUserIdStr, user2Id: friendIdStr },
        { user1Id: friendIdStr, user2Id: currentUserIdStr },
        { user1Id: currentUserObjectId, user2Id: friendObjectId },
        { user1Id: friendObjectId, user2Id: currentUserObjectId },
      ],
    });

    //if friendship exists, return
    if (friendship) {
      const response = {
        data: {
          friendship: {
            createdAt: friendship.createdAt,
            status: friendship.status,
            _id: toString(friendship._id),
            user1Id: toString(friendship.user1Id),
            user2Id: toString(friendship.user2Id),
          },
        },
      };

      return sendSuccess(
        res,
        200,
        "Friendship retrieved successfully",
        response,
        false
      );
    }

    //if blocked, return blocked status
    if (isBlocked) {
      return sendSuccess(
        res,
        200,
        "Friendship blocked",
        {
          data: {
            friendship: {
              status: "blocked",
              isBlocked: true,
              _id: "blocked",
              user1Id: currentUserIdStr,
              user2Id: friendIdStr,
              createdAt: new Date(),
            },
          },
        },
        false
      );
    }

    //when friendship doesn't exist, return a default "not-friends" status preventing (404) breaking of UI
    return sendSuccess(
      res,
      200,
      "No friendship found",
      {
        data: {
          friendship: {
            status: "not-friends",
            _id: "not-friends",
            user1Id: currentUserIdStr,
            user2Id: friendIdStr,
            createdAt: new Date(),
          },
        },
      },
      false
    );
  } catch (error) {
    return sendError(res, 500, "Error retrieving friendship");
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

const blockUser = async (req, res) => {
  //current user
  const blockerId = req.userId;
  //user to be blocked
  const { blockedId } = req.body;

  if (!blockedId) {
    return sendError(res, 400, "User ID to block is required");
  }

  try {
    const blockerObjectId = toObjectId(blockerId);
    const blockedObjectId = toObjectId(blockedId);

    if (!blockerObjectId || !blockedObjectId) {
      return sendError(res, 400, "Invalid user ID format");
    }

    // Convert IDs to strings consistently
    const blockerIdStr = toString(blockerObjectId);
    const blockedIdStr = toString(blockedObjectId);

    //checking if users exist
    const [blocker, blocked] = await Promise.all([
      req.db.collection("users").findOne({ _id: blockerObjectId }),
      req.db.collection("users").findOne({ _id: blockedObjectId }),
    ]);

    if (!blocker || !blocked) {
      return sendError(res, 404, "User not found");
    }

    //checking if user is already blocked
    const existingBlock = await req.db.collection("blockedUsers").findOne({
      blockerId: blockerObjectId,
      blockedId: blockedObjectId,
    });

    if (existingBlock) {
      return sendError(res, 400, "User is already blocked");
    }

    const session = req.db.client.startSession();

    try {
      await session.withTransaction(async () => {
        //creating  a block record
        await req.db.collection("blockedUsers").insertOne(
          {
            blockerId: blockerObjectId,
            blockedId: blockedObjectId,
            createdAt: new Date(),
          },
          { session }
        );

        //removing friendship if it exists
        await req.db.collection("friendships").deleteOne(
          {
            $or: [
              { user1Id: blockerIdStr, user2Id: blockedIdStr },
              { user1Id: blockedIdStr, user2Id: blockerIdStr },
            ],
          },
          { session }
        );

        //removing any pending friend requests between users
        await req.db.collection("friendRequests").deleteMany(
          {
            $or: [
              { senderId: blockerObjectId, receiverId: blockedObjectId },
              { senderId: blockedObjectId, receiverId: blockerObjectId },
            ],
          },
          { session }
        );
      });

      return sendSuccess(res, 200, "User blocked successfully");
    } catch (error) {
      return sendError(res, 500, "Error blocking user");
    } finally {
      await session.endSession();
    }
  } catch (error) {
    return sendError(res, 500, "Error blocking user");
  }
};

const unblockUser = async (req, res) => {
  const blockerId = req.userId;
  const { blockedId } = req.body;

  if (!blockedId) {
    return sendError(res, 400, "User ID to unblock is required");
  }

  try {
    const blockerObjectId = toObjectId(blockerId);
    const blockedObjectId = toObjectId(blockedId);

    if (!blockerObjectId || !blockedObjectId) {
      return sendError(res, 400, "Invalid user ID format");
    }

    const result = await req.db.collection("blockedUsers").deleteOne({
      blockerId: blockerObjectId,
      blockedId: blockedObjectId,
    });

    if (result.deletedCount === 0) {
      return sendError(res, 404, "Block record not found");
    }

    return sendSuccess(res, 200, "User unblocked successfully");
  } catch (error) {
    return sendError(res, 500, "Error unblocking user");
  }
};

const getBlockedUsers = async (req, res) => {
  const userId = req.userId;

  try {
    const userObjectId = toObjectId(userId);

    if (!userObjectId) {
      return sendError(res, 400, "Invalid user ID format");
    }

    //getting all blocked users
    const blockedRecords = await req.db
      .collection("blockedUsers")
      .find({ blockerId: userObjectId })
      .toArray();

    if (blockedRecords.length === 0) {
      return sendSuccess(
        res,
        200,
        "No blocked users found",
        { blockedUsers: [] },
        false
      );
    }

    //getting details of blocked user
    const blockedUserIds = blockedRecords.map((record) =>
      toObjectId(record.blockedId)
    );

    const blockedUsers = await req.db
      .collection("users")
      .find({ _id: { $in: blockedUserIds } })
      .project({
        password: 0,
        resetPasswordToken: 0,
        resetPasswordExpires: 0,
        verificationCode: 0,
        verificationCodeExpires: 0,
      })
      .toArray();

    const formattedBlockedUsers = blockedUsers.map((user) => {
      const blockRecord = blockedRecords.find(
        (record) => record.blockedId.toString() === user._id.toString()
      );

      return {
        ...user,
        _id: toString(user._id),
        blockedAt: blockRecord?.createdAt || new Date(),
      };
    });

    return sendSuccess(
      res,
      200,
      "Blocked users retrieved successfully",
      {
        blockedUsers: formattedBlockedUsers,
      },
      false
    );
  } catch (error) {
    return sendError(res, 500, "Error retrieving blocked users");
  }
};

const checkBlockStatus = async (req, res) => {
  const userId = req.userId;
  const { friendId } = req.params;

  try {
    const userObjectId = toObjectId(userId);
    const targetObjectId = toObjectId(friendId);

    if (!userObjectId || !targetObjectId) {
      return sendError(res, 400, "Invalid user ID format");
    }

    //checking if current user blocked target
    const youBlockedThem = await req.db.collection("blockedUsers").findOne({
      blockerId: userObjectId,
      blockedId: targetObjectId,
    });

    //checking if target blocked current user
    const theyBlockedYou = await req.db.collection("blockedUsers").findOne({
      blockerId: targetObjectId,
      blockedId: userObjectId,
    });

    return sendSuccess(
      res,
      200,
      "Block status retrieved",
      {
        youBlockedThem: !!youBlockedThem,
        theyBlockedYou: !!theyBlockedYou,
      },
      false
    );
  } catch (error) {
    return sendError(res, 500, "Error checking block status");
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

    sendSuccess(res, 200, "Logout successful", false);
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
  initializeFriendshipsForUser,
  getUserById,
  updateUserStatus,
  getFriendshipStatus,
  deleteUserAccount,
  blockUser,
  unblockUser,
  getBlockedUsers,
  checkBlockStatus,
  logoutUser,
};
