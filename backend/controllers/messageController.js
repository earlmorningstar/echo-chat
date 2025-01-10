const { ObjectId } = require("mongodb");
const { sendError, sendSuccess } = require("../utils/response");

const getChatHistory = async (req, res) => {
  const { friendId } = req.params;
  const userId = req.userId;

  try {

    if(!ObjectId.isValid(friendId) || !ObjectId.isValid(userId)) {
      return sendError(res, 400, "Invalid user or friend ID format");
    }

    const userObjectId = new ObjectId(userId);
    const friendObjectId = new ObjectId(friendId);

    const messages = await req.db
      .collection("messages")
      .find({
        $or: [
          { senderId: userObjectId, receiverId: friendObjectId },
          { senderId: friendObjectId, receiverId: userObjectId },
        ],
      })
      .sort({ timestamp: 1 })
      .toArray();

    const formattedMessages = messages.map((message) => ({
      ...message,
      _id: message._id.toString(),
      senderId: message.senderId.toString(),
      receiverId: message.receiverId.toString(),
    }));

    sendSuccess(res, 200, "Chat history retrieved successfully", {
      messages: formattedMessages,
    });
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
    const message = await req.db.collection("messages").insertOne({
      content,
      senderId: new ObjectId(senderId),
      receiverId: new ObjectId(receiverId),
      timestamp: new Date(),
      status: "sent",
    });

    sendSuccess(res, 201, "Message sent successfully", {
      messageId: message.insertedId.toString(),
    });
  } catch (error) {
    sendError(res, 500, "Error sending message", { error: error.message });
  }
};

const getLastMessage = async (req, res) => {
  const userId = req.userId;
  const friendId = req.params.userId;

  try {
    const userObjectId = new ObjectId(userId);
    const friendObjectId = new ObjectId(friendId);

    const lastMessage = await req.db.collection("messages").findOne(
      {
        $or: [
          { senderId: userObjectId, receiverId: friendObjectId },
          { senderId: friendObjectId, receiverId: userObjectId },
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
      ? lastMessage.status === "sent" &&
        lastMessage.receiverId.toString() === userId
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
