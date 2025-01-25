import { ObjectId } from "mongodb";
import { sendError, sendSuccess } from "../utils/response.js";

const getChatHistory = async (req, res) => {
  const { friendId } = req.params;
  const userId = req.userId;

  try {
    if (!ObjectId.isValid(friendId) || !ObjectId.isValid(userId)) {
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
      .project({
        content: 1,
        type: 1,
        senderId: 1,
        receiverId: 1,
        timestamp: 1,
        status: 1,
        metadata: 1,
      })
      .toArray();

    const formattedMessages = messages.map((message) => ({
      ...message,
      _id: message._id.toString(),
      senderId: message.senderId.toString(),
      receiverId: message.receiverId.toString(),
      type: message.type || "text",
      metadata: message.metadata || undefined,
    }));

    sendSuccess(
      res,
      200,
      "Chat history retrieved successfully",
      {
        messages: formattedMessages,
      },
      false
    );
  } catch (error) {
    sendError(res, 500, "Error retrieving chat history", {
      error: error.message,
    });
  }
};

const sendMessage = async (req, res) => {
  const { content, receiverId, type = "text", metadata = {} } = req.body;
  const senderId = req.userId;

  try {
    const messageData = {
      content,
      type,
      senderId: new ObjectId(senderId),
      receiverId: new ObjectId(receiverId),
      timestamp: new Date(),
      status: "sent",
      metadata:
        type !== "text"
          ? {
              fileName: metadata.fileName,
              fileSize: metadata.fileSize,
              mimeType: metadata.mimeType,
              fileId: metadata.fileId, //storing Gridfs file ID and not the url
            }
          : undefined,
    };

    const message = await req.db.collection("messages").insertOne(messageData);

    sendSuccess(res, 201, "Message sent successfully", {
      messageId: message.insertedId.toString(),
      ...messageData,
      senderId: senderId.toString(),
      receiverId: receiverId.toString(),
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

    sendSuccess(
      res,
      200,
      "Last message retrieved successfully",
      {
        message: lastMessage
          ? {
              content: lastMessage.content,
              timestamp: lastMessage.timestamp,
              unread: unread,
              senderId: lastMessage.senderId.toString(),
              status: lastMessage.status,
            }
          : null,
      },
      false
    );
  } catch (error) {
    sendError(res, 500, "Error retrieving last message", {
      error: error.message,
    });
  }
};

const markMessageAsRead = async (req, res) => {
  const { friendId } = req.params;
  const userId = req.userId;

  try {
    const userObjectId = new ObjectId(userId);
    const friendObjectId = new ObjectId(friendId);

    const result = await req.db.collection("messages").updateMany(
      {
        senderId: friendObjectId,
        receiverId: userObjectId,
        status: "sent",
      },
      {
        $set: { status: "read", readAt: new Date() },
      }
    );

    if (result.modifiedCount > 0) {
      const ws = connectedClients.get(friendId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "read_status",
            senderId: userId,
            receiverId: friendId,
            timestamp: new Date(),
          })
        );
      }
    }

    sendSuccess(res, 200, "Messages marked as read");
  } catch (error) {
    sendError(res, 500, "Error marking messages as read", {
      error: error.message,
    });
  }
};

const getUnreadCount = async (req, res) => {
  const { friendId } = req.params;
  const userId = req.userId;

  try {
    const userObjectId = new ObjectId(userId);
    const friendObjectId = new ObjectId(friendId);

    const count = await req.db.collection("messages").countDocuments({
      senderId: friendObjectId,
      receiverId: userObjectId,
      status: "sent",
    });
    sendSuccess(
      res,
      200,
      "Unread count retrieved successfully",
      { count },
      false
    );
  } catch (error) {
    sendError(res, 500, "Error getting unread count", { error: error.message });
  }
};

export {
  getChatHistory,
  sendMessage,
  getLastMessage,
  markMessageAsRead,
  getUnreadCount,
};
