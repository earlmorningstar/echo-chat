// const bcrypt = require("bcrypt");
// const jwt = require("jsonwebtoken");
// const crypto = require("crypto");

const { sendError, sendSuccess } = require("../utils/response");

const getChatHistory = async (req, res) => {
  const { friendId } = req.params;
  const userId = req.userId;

  try {
    const message = await req.db
      .collection("messages")
      .find({
        $or: [
          { senderId: userId, receiverId: friendId },
          { senderId: friendId, receiverId: userId },
        ],
      })
      .sort({ timestamp: 1 })
      .toArray();
    sendSuccess(res, 200, "Chat history retrieved successfully", { message });
  } catch (error) {
    sendError(res, 500, "Error retrieving chat history", {
      error: error.message,
    });
  }
};

const sendMessage = async (req, res) => {
  const { content, receiverId } = req.body;
  const senderId = req.userId;

  try {
    const message = await req.db.collection("message").insertOne({
      content,
      senderId,
      receiverId,
      timestamp: new Date(),
      status: "sent",
    });
    sendSuccess(res, 201, "Message sent successfully", {
      messageId: message.insertedId,
    });
  } catch (error) {
    sendError(res, 500, "Error sending message", { error: error.message });
  }
};

const getLastMessage = async (req, res) => {
  const userId = req.userId;
  const friendId = req.params.userId;

  try {
    const lastMessage = await req.db.collection("messages").findOne(
      {
        $or: [
          { senderId: userId, receiverId: friendId },
          { senderId: friendId, receiverId: userId },
        ],
      },
      {
        sort: { timestamp: -1 },
        projection: {
          content: 1,
          timestamp: 1,
          senderId: 1,
          receiverId: 1,
          status: 1,
        },
      }
    );

    const unread = lastMessage
      ? lastMessage.status === "sent" && lastMessage.receiverId === userId
      : false;

    sendSuccess(res, 200, "Last message retrieved successfully", {
      message: lastMessage
        ? {
            content: lastMessage.content,
            timestamp: lastMessage.timestamp,
            unread: unread,
          }
        : null,
    });
  } catch (error) {
    sendError(res, 500, "Error retrieving last message", {
      error: error.message,
    });
  }
};

module.exports = {
  getChatHistory,
  sendMessage,
  getLastMessage,
};
