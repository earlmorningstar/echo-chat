import { ObjectId } from "mongodb";
import { CallStatus, CallType, WsEventType } from "../utils/constants.js";
import { generateTwilioToken } from "../controllers/callController.js";
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

      if (message.type === "ack") {
        const pending = this.pendingEvents.get(message.id);
        if (pending) {
          clearTimeout(pending.timeout);
          pending.resolve();
          this.pendingEvents.delete(message.id);
        }
        return;
      }

      const handlers = {
        typing: () => this.handleTypingIndicator(message),
        status: () => this.handleStatusUpdate(message),
        message: () => this.handleMessage(ws, message),
        read_status: () => this.handleReadStatus(ws, message),
        call_initiate: () => this.handleCallInitiation(ws, message),
        call_accept: () => this.handleCallAcceptance(ws, message),
        call_reject: () => this.handleCallRejection(ws, message),
        call_end: () => this.handleCallEnd(ws, message),
      };

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

    if (message.type.startsWith("call_")) {
      const requiredFields = {
        [WsEventType.CALL_INITIATE]: ["callId", "callerId", "recipientId"],
        [WsEventType.CALL_ACCEPT]: ["callId", "acceptorId"],
        [WsEventType.CALL_REJECT]: ["callId", "rejectorId"],
        [WsEventType.CALL_END]: ["callId", "endedBy"],
      };

      const required = requiredFields[message.type] || [];
      const missing = required.filter((field) => !message[field]);

      if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(", ")}`);
      }
    }

    return true;
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
      // console.error("Typing indicator failed:", error);
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

  async handleCallInitiation(ws, message) {
    try {
      const call = await this.db.collection("calls").findOne({
        _id: new ObjectId(message.callId),
      });

      if (call?.caller?.toString() === message.recipientId) {
        // console.error("Self-call attempt blocked");
        return;
      }

      if (!call) {
        throw new Error("Call not found");
      }

      // Video-specific validation
      if (call.type === CallType.VIDEO) {
        const recipientWs = this.connectedClients.get(message.recipientId);

        //checking if recipient and WS is connected
        if (!recipientWs || recipientWs.readyState !== WebSocket.OPEN) {
          // console.error("Recipient WS not connected:", message.recipientId);
          return;
        }

        //generating token without 'client:' prefix for video calls
        const recipientToken = await generateTwilioToken(
          // message.recipientId,
          `client:${message.recipientId}`,
          call.type,
          call.roomName
        );

        const callInitiateMessage = {
          type: WsEventType.CALL_INITIATE,
          callId: call._id.toString(),
          callerId: message.callerId,
          recipientId: message.recipientId,
          callType: call.type,
          roomName: call.roomName,
          token: recipientToken,
          requireAck: true,
          id: `call-${call._id}`,
        };

        //sending call invitation to recipient

        await this.sendWithAcknowledgment(recipientWs, callInitiateMessage);
      } else {
        // Existing logic for non-video calls remains the same
        const recipientWs = this.connectedClients.get(message.recipientId);

        //checking if recipient and WS is connected
        if (!recipientWs || recipientWs.readyState !== WebSocket.OPEN) {
          // console.error("Recipient WS not connected:", message.recipientId);
          return;
        }

        //generating token with proper identity format for non-video calls
        const recipientToken = await generateTwilioToken(
          `client:${message.recipientId}`,
          call.type,
          call.roomName
        );

        const callInitiateMessage = {
          type: WsEventType.CALL_INITIATE,
          callId: call._id.toString(),
          callerId: message.callerId,
          recipientId: message.recipientId,
          callType: call.type,
          roomName: call.roomName,
          token: recipientToken,
          requireAck: true,
          id: `call-${Date.now()}-${call._id}`,
        };

        //sending call invitation to recipient

        await this.sendWithAcknowledgment(recipientWs, callInitiateMessage);
      }
    } catch (error) {
      // console.error(`Failed to send call_initiate: ${error.message}`);

      const callerId = message.callerId;
      try {
        await this.db
          .collection("calls")
          .updateOne(
            { _id: new ObjectId(message.callId) },
            { $set: { status: CallStatus.MISSED } }
          );

        //notifying caller about the failed calls
        const callerWs = this.connectedClients.get(callerId);
        if (callerWs.readyState === WebSocket.OPEN) {
          callerWs.send(
            JSON.stringify({
              type: WsEventType.CALL_ERROR,
              callId: message.callId,
              error: "Failed to reach recipient",
              timestamp: Date.now(),
            })
          );
        }
      } catch (dbError) {
        console.error("Failed to notify caller");
      }
    }
  }

  async handleCallAcceptance(ws, message) {
    const { callId, acceptorId } = message;

    //updating call status
    await this.db
      .collection("calls")
      .updateOne(
        { _id: new ObjectId(callId) },
        { $set: { status: CallStatus.CONNECTED } }
      );

    //notifying original caller
    const call = await this.db
      .collection("calls")
      .findOne({ _id: new ObjectId(callId) });

    const callerWs = this.connectedClients.get(call.caller);
    if (callerWs?.readyState === WebSocket.OPEN) {
      callerWs.send(
        JSON.stringify({
          type: WsEventType.CALL_ACCEPT,
          callId,
          acceptorId,
          roomName: call.roomName,
          token: generateTwilioToken(acceptorId, call.type, call.roomName),
        })
      );
    }
  }

  async handleCallRejection(ws, message) {
    const { callId, rejectorId } = message;

    //updating call status
    await this.db.collection("calls").updateOne(
      { _id: new ObjectId(callId) },
      {
        $set: {
          status: CallStatus.REJECTED,
          endTime: new Date(),
        },
      }
    );

    //notifying both users
    const call = await this.db
      .collection("calls")
      .findOne({ _id: new ObjectId(callId) });
    [call.caller, call.recipient].forEach((userId) => {
      const callerWs = this.connectedClients.get(userId);
      if (callerWs?.readyState === WebSocket.OPEN) {
        callerWs.send(
          JSON.stringify({
            type: WsEventType.CALL_REJECT,
            callId,
            rejectorId,
            forceDisconnect: true,
          })
        );
      }
    });
  }

  async handleCallEnd(ws, message) {
    const { callId, userId } = message;

    //updating status for all participants
    await this.db.collection("calls").updateOne(
      { _id: new ObjectId(callId) },
      {
        $set: {
          status: CallStatus.COMPLETED,
          endTime: new Date(),
        },
      }
    );

    //notifying both parties
    const call = await this.db
      .collection("calls")
      .findOne({ _id: new ObjectId(callId) });
    [call.caller, call.recipient].forEach((participantId) => {
      const participantWs = this.connectedClients.get(participantId);
      if (participantWs?.readyState === WebSocket.OPEN) {
        participantWs.send(
          JSON.stringify({
            type: WsEventType.CALL_END,
            callId,
            endedBy: userId,
            force: true,
          })
        );
      }
    });
  }

  async sendWithAcknowledgment(ws, message) {
    const timeoutDuration = 30000;

    return new Promise((resolve, reject) => {
      const messageId = message.id;

      const cleanup = () => {
        clearTimeout(timeout);
        this.pendingEvents.delete(messageId);
      };

      const timeout = setTimeout(() => {
        // this.pendingEvents.has(messageId);
        cleanup();
        reject(new Error(`No response after ${timeoutDuration}ms`));
      }, timeoutDuration);

      this.pendingEvents.set(messageId, { resolve, timeout });

      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              ...message,
              id: messageId,
              // requireAck: true,
              timestamp: Date.now(),
            })
          );
        } else {
          cleanup();
          reject(new Error("Connection closed"));
        }
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  }
}
export default WebSocketEventHandler;
