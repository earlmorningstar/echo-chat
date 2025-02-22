import { ObjectId } from "mongodb";
const isValidObjectId = (id) => ObjectId.isValid(id);

class WebSocketEventHandler {
  constructor(wss, db) {
    this.wss = wss;
    this.db = db;
    this.connectedClients = new Map();
    this.userStatuses = new Map();
    this.pendingEvents = new Map();
    this.eventQueue = [];
    this.processingQueue = false;
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  async handleEvent(ws, message) {
    try {
      await this.validateMessage(message);

      //message validation
      if (message.type.startsWith("call_") && !message.data) {
        throw new Error("Invalid call message format");
      }

      const handlers = {
        typing: () => this.handleTypingIndicator(message),
        status: () => this.handleStatusUpdate(message),
        message: () => this.handleMessage(ws, message),
        read_status: () => this.handleReadStatus(ws, message),
      };

      if (message.type.startsWith("call_")) {
        return this.handleCallEvent(ws, message);
      }

      const handler = handlers[message.type];
      if (handler) {
        await handler();
      }

      if (message.requireAck) {
        ws.send(
          JSON.stringify({
            type: "ack",
            id: message.id,
          })
        );
      }
    } catch (error) {
      console.error("Error handling event:", error);
      if (message.requireAck) {
        ws.send(
          JSON.stringify({
            type: "error",
            id: message.id,
            message: error.message,
          })
        );
      }

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Failed to process event",
            originalEvent: message.type,
          })
        );
      }
    }
  }

  async validateMessage(message) {
    if (!message || typeof message !== "object") {
      throw new Error("Invalid message format");
    }

    if (!message.type) {
      throw new Error("Message type is required");
    }

    return true;
  }

  async handleCallEvent(ws, event) {
    const handlers = {
      call_initiate: () => this.handleCallInitiation(ws, event),
      call_accepted: () => this.handleCallAcceptance(ws, event),
      call_rejected: () => this.handleCallRejection(ws, event),
      call_ended: () => this.handleCallEnding(ws, event),
    };

    const handler = handlers[event.type];
    if (handler) {
      await this.retryOperation(handler, 3);
    }
  }

  async retryOperation(operation, maxRetries, delay = 1000) {
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, delay * Math.pow(2, attempt))
          );
        }
      }
    }

    throw lastError;
  }

  async handleStatusUpdate(message) {
    const { senderId, status } = message;
    const currentTime = new Date();

    try {
      if (status === "offline" && this.connectedClients.has(senderId)) {
        return;
      }

      await this.db.collection("users").updateOne(
        { _id: new ObjectId(senderId) },
        {
          $set: {
            status,
            lastSeen: status === "offline" ? currentTime : null,
          },
        }
      );

      this.userStatuses.set(senderId, status);
      this.broadcastStatus(
        senderId,
        status,
        status === "offline" ? currentTime : null
      );
    } catch (error) {
      console.error("Status update failed:", error);
      throw error;
    }
  }

  broadcastStatus(userId, status, lastSeen = null) {
    const message = JSON.stringify({
      type: "status",
      userId,
      status,
      lastSeen,
    });

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  async registerClient(userId, ws) {
    try {
      if (!userId || !ws) {
        throw new Error("Invalid registration parameters");
      }

      this.connectedClients.set(userId, ws);
      this.userStatuses.set(userId, "online");

      await this.db.collection("users").updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            status: "online",
            lastSeen: null,
          },
        }
      );

      return true;
    } catch (error) {
      console.error("Client registration failed:", {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  async removeClient(userId) {
    try {
      if (!userId) {
        throw new Error("User ID is required for client removal");
      }

      this.connectedClients.delete(userId);
      this.userStatuses.set(userId, "offline");
      const currentTime = new Date();

      await this.db.collection("users").updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            status: "offline",
            lastSeen: currentTime,
          },
        }
      );

      this.broadcastStatus(userId, "offline", currentTime);
    } catch (error) {
      console.error("Client removal failed:", {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  async handleTypingIndicator(message) {
    const { senderId, receiverId, isTyping } = message;

    //validating IDs using proper MongoDB check
    if (!isValidObjectId(senderId) || !isValidObjectId(receiverId)) {
      throw new Error("Invalid user IDs");
    }

    //validating typing status type
    if (typeof isTyping !== "boolean") {
      throw new Error("Invalid typing status format");
    }

    try {
      const receiverWs = this.connectedClients.get(receiverId);
      if (receiverWs?.readyState === WebSocket.OPEN) {
        //sending immediate acknowledgment
        if (message.requireAck) {
          receiverWs.send(
            JSON.stringify({
              type: "ack",
              id: message.id,
            })
          );
        }

        //sending typing notification
        receiverWs.send(
          JSON.stringify({
            type: "typing",
            senderId,
            isTyping,
            timestamp: Date.now(),
          })
        );
      }
    } catch (error) {
      console.error("Typing indicator failed:", error);
      throw error;
    }
  }

  validateTypingMessage(message) {
    return (
      message.isTyping !== undefined &&
      typeof message.isTyping === "boolean" &&
      isValidObjectId(message.senderId) &&
      isValidObjectId(message.receiverId)
    );
  }

  // async handleCallInitiation(ws, event) {
  //   try {
  //     const { data } = event;
  //     const { receiverId, callType, roomName, senderId } = data;

  //     //validating connection state
  //     const receiverWs = this.connectedClients.get(receiverId);
  //     if (!receiverWs || receiverWs.readyState !== WebSocket.OPEN) {
  //       throw new Error("Receiver not connected");
  //     }

  //     if (
  //       !receiverId ||
  //       !callType ||
  //       !roomName ||
  //       !senderId ||
  //       !isValidObjectId(receiverId) ||
  //       !isValidObjectId(senderId)
  //     ) {
  //       throw new Error("Missing or invalid call parameters");
  //     }

  //     //validating all required parameters
  //     if (!roomName || !receiverId || !senderId || !callType) {
  //       throw new Error("Missing required call parameters");
  //     }

  //     //covert IDs to Obj
  //     const initiatorObjId = new ObjectId(senderId);
  //     const receiverObjId = new ObjectId(receiverId);

  //     const existingCall = await this.db.collection("calls").findOne({
  //       roomName,
  //       status: { $in: ["initiated", "connected"] },
  //     });

  //     if (!existingCall) {
  //       await this.db.collection("calls").insertOne({
  //         roomName,
  //         initiatorId: initiatorObjId,
  //         receiverId: receiverObjId,
  //         callType,
  //         status: "initiated",
  //         startTime: new Date(),
  //       });
  //     }

  //     await this.sendWithAcknowledgment(receiverWs, {
  //       type: "call_initiate",
  //       initiatorObjId,
  //       callType,
  //       roomName,
  //     });
  //   } catch (error) {
  //     console.error("Call initiation failed:", error);
  //     if (event.requireAck) {
  //       ws.send(
  //         JSON.stringify({
  //           type: "error",
  //           id: event.id,
  //           message: error.message,
  //         })
  //       );
  //     }
  //     throw error;
  //   }
  // }

  async handleCallInitiation(ws, event) {
    try {
      //validating event structure
      if (!event.data || typeof event.data !== "object") {
        throw new Error("Invalid event format");
      }

      //destructuring with defaults
      const {
        receiverId = null,
        callType = null,
        roomName = null,
        senderId = null,
      } = event.data;

      //validating parameters in a single check
      if (
        !roomName ||
        !receiverId ||
        !senderId ||
        !callType ||
        !isValidObjectId(receiverId) ||
        !isValidObjectId(senderId) ||
        !["voice", "video"].includes(callType)
      ) {
        throw new Error("Invalid call parameters");
      }

      //checking receiver connection state
      const receiverWs = this.connectedClients.get(receiverId);
      if (!receiverWs?.readyState === WebSocket.OPEN) {
        throw new Error("Receiver unavailable");
      }

      //db operations with error handling
      const existingCall = await this.db.collection("calls").findOne({
        roomName,
        status: { $in: ["initiated", "connected"] },
      });

      if (!existingCall) {
        await this.db.collection("calls").updateOne(
          { roomName },
          {
            $setOnInsert: {
              initiatorId: new ObjectId(senderId),
              receiverId: new ObjectId(receiverId),
              callType,
              status: "initiated",
              startTime: new Date(),
            },
          },
          { upsert: true }
        );
      }

      // sending properly formatted message to receiver
      await this.sendWithAcknowledgment(receiverWs, {
        type: "call_initiate",
        data: {
          initiatorId: senderId, //keeping as string for client
          callType,
          roomName,
          timestamp: Date.now(),
        },
      });

      //sending success ACK to initiator
      if (event.requireAck) {
        ws.send(
          JSON.stringify({
            type: "ack",
            id: event.id,
          })
        );
      }
    } catch (error) {
      console.error("Call initiation failed:", {
        error: error.message,
        event: JSON.stringify(event),
      });

      //safe error ACK handling
      if (event.requireAck && event.id) {
        ws.send(
          JSON.stringify({
            type: "error",
            id: event.id,
            message: error.message,
          })
        );
      }

      throw error;
    }
  }

  async handleCallAcceptance(ws, event) {
    const { roomName, senderId, receiverId } = event.data;

    try {
      await this.db.collection("calls").updateOne(
        { roomName, status: "initiated" },
        {
          $set: {
            status: "connected",
            connectedAt: new Date(),
          },
        }
      );

      const initiatorWs = this.connectedClients.get(receiverId);
      if (!initiatorWs || initiatorWs.readyState !== WebSocket.OPEN) {
        throw new Error("Initiator not available");
      }

      await this.sendWithAcknowledgment(initiatorWs, {
        type: "call_accepted",
        senderId,
        roomName,
      });
    } catch (error) {
      console.error("Call acceptance failed:", {
        roomName,
        error: error.message,
      });
      throw error;
    }
  }

  async handleCallRejection(ws, event) {
    const { roomName, senderId, initiatorId } = event.data;

    try {
      await this.db.collection("calls").updateOne(
        { roomName },
        {
          $set: {
            status: "rejected",
            endTime: new Date(),
          },
        }
      );

      const initiatorWs = this.connectedClients.get(initiatorId);
      if (!initiatorWs || initiatorWs.readyState !== WebSocket.OPEN) {
        throw new Error("Initiator not available");
      }

      await this.sendWithAcknowledgment(initiatorWs, {
        type: "call_rejected",
        senderId,
        roomName,
      });
    } catch (error) {
      console.error("Call rejection failed:", {
        roomName,
        error: error.message,
      });
      throw error;
    }
  }

  async handleCallEnding(ws, event) {
    try {
      const { roomName, senderId } = event.data;

      if (!roomName || !!senderId) {
        throw new Error("Missing parameters for call ending");
      }

      await this.db.collection("calls").updateOne(
        { roomName },
        {
          $set: {
            status: "completed",
            endTime: new Date(),
          },
        }
      );

      if (event.requireAck) {
        ws.send(
          JSON.stringify({
            type: "ack",
            id: event.id,
          })
        );
      }

      const otherParticipantWs = this.connectedClients.get(senderId);
      if (otherParticipantWs?.readyState === WebSocket.OPEN) {
        await this.sendWithAcknowledgment(otherParticipantWs, {
          type: "call_ended",
          roomName,
        });
      }
    } catch (error) {
      console.error("Call ending failed:", error);
      throw error;
    }
  }

  async sendWithAcknowledgment(ws, message) {
    return new Promise((resolve, reject) => {
      if (ws.readyState !== WebSocket.OPEN) {
        reject(new Error("Connection closed"));
        return;
      }

      const messageId = `${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      const timeout = setTimeout(() => {
        this.pendingEvents.has(messageId);
        this.pendingEvents.delete(messageId);
        reject(new Error("Acknowledgment timeout"));
      }, 3000);

      this.pendingEvents.set(messageId, { resolve, timeout });

      try {
        ws.send(
          JSON.stringify({
            ...message,
            id: messageId,
            requireAck: true,
          })
        );
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }
}
export default WebSocketEventHandler;
