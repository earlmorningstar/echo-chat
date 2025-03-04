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

    if (message.type.startsWith("call_")) {
      if (!message.callId || !message.callerId || !message.recipientId) {
        throw new Error("Missing required call fields");
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

  async handleCallInitiation(ws, message) {
    console.log("Full message in handleCallInitiation:", message);
    const { callId, callerId, recipientId, type } = message;

    console.log("Connected clients map content:", this.connectedClients);

    //validating input
    if (![CallType.VOICE, CallType.VIDEO].includes(type)) {
      throw new Error("Invalid call type");
    }

    console.log(`Checking recipient connection: ${recipientId}`);
    console.log(`Connected clients: ${Array.from(this.connectedClients.keys())}`);

    //checking if recipient is active(online)
    const recipientWs = this.connectedClients.get(recipientId);
    if (!recipientWs) {
      console.error(`Recipient ${recipientId} offline - marking call as missed`);
      await this.db
        .collection("calls")
        .updateOne(
          { _id: new ObjectId(callId) },
          { $set: { status: CallStatus.MISSED } }
        );
      throw new Error("Recipient is offline");
    }

    console.log(`Sending call_initiate to ${recipientId}`);

    try {
      //sending call invitation to recipient
      await this.sendWithAcknowledgment(recipientWs, {
        type: WsEventType.CALL_INITIATE,
        callId,
        callerId,
        callType: type,
        timestamp: Date.now(),
      });
      console.log(`Call_initiate successfully sent to ${recipientId}`);
    } catch (error) {
      console.error(`Failed to send call_initiate: ${error.message}`);
      await this.db
        .collection("calls")
        .updateOne(
          { _id: new ObjectId(callId) },
          { $set: { status: CallStatus.MISSED } }
        );
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
    await this.db
      .collection("calls")
      .updateOne(
        { _id: new ObjectId(callId) },
        { $set: { status: CallStatus.REJECTED, endTime: new Date() } }
      );

    //notifying caller
    const call = await this.db
      .collection("calls")
      .findOne({ _id: new ObjectId(callId) });
    const callerWs = this.connectedClients.get(call.caller);
    if (callerWs?.readyState === WebSocket.OPEN) {
      callerWs.send(
        JSON.stringify({
          type: WsEventType.CALL_REJECT,
          callId,
          rejectorId,
        })
      );
    }
  }

  async handleCallEnd(ws, message) {
    const { callId, userId } = message;

    const update = {
      $set: {
        status: CallStatus.COMPLETED,
        endTime: new Date(),
      },
    };

    await this.db
      .collection("calls")
      .updateOne({ _id: new ObjectId(callId) }, update);

    //notifying both parties
    const call = await this.db
      .collection("calls")
      .findOne({ _id: new ObjectId(callId) });
    const participants = [call.caller, call.recipient];

    participants.forEach((participantId) => {
      const participantWs = this.connectedClients.get(participantId);
      if (participantWs?.readyState === WebSocket.OPEN) {
        participantWs.send(
          JSON.stringify({
            type: WsEventType.CALL_END,
            callId,
            endedBy: userId,
          })
        );
      }
    });
  }

  async sendWithAcknowledgment(ws, message) {
    const timeoutDuration = 15000;

    return new Promise((resolve, reject) => {
      const messageId = `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 11)}`;
      const timeout = setTimeout(() => {
        this.pendingEvents.has(messageId);
        this.pendingEvents.delete(messageId);
        reject(new Error("Acknowledgment timeout"));
      }, timeoutDuration);

      this.pendingEvents.set(messageId, { resolve, timeout });

      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              ...message,
              id: messageId,
              requireAck: true,
              timestamp: Date.now(),
            })
          );
        } else {
          clearTimeout(timeout);
          reject(new Error("Connection closed"));
        }
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }
}
export default WebSocketEventHandler;

// async handleCallInitiation(message) {
//   try {
//     console.log("Initiating call:", {
//       sender: message.data.senderId,
//       receiver: message.data.receiverId,
//       room: message.data.roomName,
//     });

//     const { receiverId, callType, roomName, senderId } = message.data;

//     if (![receiverId, senderId].every(isValidObjectId)) {
//       throw new Error("Invalid user ID format");
//     }

//     const receiverWs = this.connectedClients.get(receiverId);
//     if (!receiverWs || receiverWs.readyState !== WebSocket.OPEN) {
//       throw new Error("Receiver unavailable");
//     }

//     //updating db
//     await this.db.collection("calls").updateOne(
//       { roomName },
//       {
//         $setOnInsert: {
//           initiatorId: new ObjectId(senderId),
//           receiverId: new ObjectId(receiverId),
//           status: "initiated",
//           startTime: new Date(),
//         },
//       },
//       { upsert: true }
//     );

//     //sending proper formatted message
//     await this.sendWithAcknowledgment(receiverWs, {
//       type: "call_initiate",
//       data: {
//         initiatorId: senderId,
//         receiverId,
//         callType,
//         roomName,
//         timestamp: Date.now(),
//       },
//       id: message.id,
//     });

//     // Send ACK to initiator
//     const initiatorWs = this.connectedClients.get(senderId);
//     if (!initiatorWs?.readyState === WebSocket.OPEN) {
//       initiatorWs.send(JSON.stringify({ type: "ack", id: message.id }));
//     }

//     console.log("Call initiation successful:", {
//       room: message.data.roomName,
//       participants: [senderId, receiverId],
//     });
//   } catch (error) {
//     console.error("Call initiation failed:", error);
//     ws.send(
//       JSON.stringify({
//         type: "error",
//         id: message.id,
//         message: error.message,
//       })
//     );
//   }
// }

// // async handleCallInitiation(message) {
// //   const { senderId, receiverId, roomName, callType } = message.data;

// //   if (!Call) throw new Error("Call model not initialized");
// //   if (!roomName || !senderId || !receiverId) {
// //     throw new Error("Invalid call initiation  parameters");
// //   }

// //   try {
// //     const call = await Call.findOne({ roomName });
// //     if (!call) {
// //       throw new Error(`Call not found for room: ${roomName}`);
// //     }

// //     // Add connection validation
// //     const receiverWs = this.connectedClients.get(receiverId);
// //     if (!receiverWs || receiverWs.readyState !== WebSocket.OPEN) {
// //       await Call.deleteOne({ roomName });
// //       throw new Error("Recipient not connected");
// //     }

// //     await this.sendWithAcknowledgment(
// //       receiverWs,
// //       {
// //         type: "call_initiate",
// //         data: {
// //           senderId,
// //           callType,
// //           roomName,
// //           initiatorId: senderId,
// //           timestamp: Date.now(),
// //           // receiverId,
// //         },
// //       },
// //       10000
// //     );
// //   } catch (error) {
// //     console.error("Call initiation failed:", error);
// //     // Cleanup failed call attempt
// //     await Call.deleteOne({ roomName }).catch(() => {});
// //     throw error;
// //   }
// // }

// async handleCallAcceptance(message) {
//   const { senderId, receiverId, roomName } = message.data;
//   const initiatorWs = this.connectedClients.get(receiverId);

//   if (initiatorWs?.readyState === WebSocket.OPEN) {
//     await this.sendWithAcknowledgment(initiatorWs, {
//       type: "call_accept",
//       data: { roomName, senderId },
//     });
//   }
// }

// // async handleCallAcceptance(ws, event) {
// //   const { roomName, senderId, receiverId } = event.data;

// //   try {
// //     await this.db.collection("calls").updateOne(
// //       { roomName, status: "initiated" },
// //       {
// //         $set: {
// //           status: "connected",
// //           connectedAt: new Date(),
// //         },
// //       }
// //     );

// //     const initiatorWs = this.connectedClients.get(receiverId);
// //     if (!initiatorWs || initiatorWs.readyState !== WebSocket.OPEN) {
// //       throw new Error("Initiator not available");
// //     }

// //     await this.sendWithAcknowledgment(initiatorWs, {
// //       type: "call_accepted",
// //       senderId,
// //       roomName,
// //     });
// //   } catch (error) {
// //     console.error("Call acceptance failed:", {
// //       roomName,
// //       error: error.message,
// //     });
// //     throw error;
// //   }
// // }

// async handleCallRejection(message) {
//   const { senderId, receiverId, roomName } = message.data;
//   const initiatorWs = this.connectedClients.get(receiverId);

//   if (initiatorWs?.readyState === WebSocket.OPEN) {
//     await this.sendWithAcknowledgment(initiatorWs, {
//       type: "call_reject",
//       data: { roomName, senderId },
//     });
//   }
// }

// // async handleCallRejection(ws, event) {
// //   const { roomName, senderId, initiatorId } = event.data;

// //   try {
// //     await this.db.collection("calls").updateOne(
// //       { roomName },
// //       {
// //         $set: {
// //           status: "rejected",
// //           endTime: new Date(),
// //         },
// //       }
// //     );

// //     const initiatorWs = this.connectedClients.get(initiatorId);
// //     if (!initiatorWs || initiatorWs.readyState !== WebSocket.OPEN) {
// //       throw new Error("Initiator not available");
// //     }

// //     await this.sendWithAcknowledgment(initiatorWs, {
// //       type: "call_rejected",
// //       senderId,
// //       roomName,
// //     });
// //   } catch (error) {
// //     console.error("Call rejection failed:", {
// //       roomName,
// //       error: error.message,
// //     });
// //     throw error;
// //   }
// // }

// async handleCallEnd(message) {
//   const { senderId, receiverId, roomName } = message.data;
//   try {
//     if (!roomName) throw new Error("Missing room name");

//     //updating call status
//     await Call.findOneAndUpdate(
//       { roomName },
//       { status: "completed", endTime: new Date() },
//       { new: true }
//     );
//     //status refresh
//     this.broadcastStatus(senderId, "online");
//     this.broadcastStatus(receiverId, "online");
//   } catch (error) {
//     console.error("Call end cleanup failed:", error);
//   }

//   const otherUserWs = this.connectedClients.get(receiverId);
//   if (otherUserWs?.readyState === WebSocket.OPEN) {
//     await this.sendWithAcknowledgment(otherUserWs, {
//       type: "call_ended",
//       data: { roomName, senderId },
//     });
//   }
// }

// // async handleCallEnding(ws, event) {
// //   try {
// //     const { roomName, senderId } = event.data;

// //     if (!roomName || !senderId) {
// //       throw new Error("Missing parameters for call ending");
// //     }

// //     await this.db.collection("calls").updateOne(
// //       { roomName },
// //       {
// //         $set: {
// //           status: "completed",
// //           endTime: new Date(),
// //         },
// //       }
// //     );

// //     if (event.requireAck) {
// //       ws.send(
// //         JSON.stringify({
// //           type: "ack",
// //           id: event.id,
// //         })
// //       );
// //     }

// //     const otherParticipantWs = this.connectedClients.get(senderId);
// //     if (otherParticipantWs?.readyState === WebSocket.OPEN) {
// //       await this.sendWithAcknowledgment(otherParticipantWs, {
// //         type: "call_ended",
// //         roomName,
// //       });
// //     }
// //   } catch (error) {
// //     console.error("Call ending failed:", error);
// //     throw error;
// //   }
// // }

// async handleICECandidate(message) {
//   const { senderId, receiverId, candidate } = message.data;
//   const receiverWs = this.connectedClients.get(receiverId);

//   if (receiverWs?.readyState === WebSocket.OPEN) {
//     await this.sendWithAcknowledgment(receiverWs, {
//       type: "call_ice_candidate",
//       data: { candidate, senderId, timestamp: Date.now() },
//     });
//   }
// }
