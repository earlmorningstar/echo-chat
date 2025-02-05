import { WebSocketServer } from "ws";
import { ObjectId } from "mongodb";

const connectedClients = new Map();
const userStatuses = new Map();

const initializeWebSocket = (server, db) => {
  if (!db) {
    throw new Error("Database connection is required");
  }

  const wss = new WebSocketServer({ server });

  //helper for db operations with logic to retry
  const executeDbOperation = async (operation, maxRetries = 3) => {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        console.error(
          `Database operation failed (attempt ${i + 1}/${maxRetries})`
        );
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * Math.pow(2, i))
        );
      }
    }
    throw lastError;
  };

  wss.on("connection", (ws) => {
    let userId = null;

    const handleDatabaseError = (error, operation) => {
      console.error(`Error during ${operation}`);
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Database operation failed",
          operation,
        })
      );
    };

    ws.on("message", async (message) => {
      try {
        const parsedMessage = JSON.parse(message);

        if (parsedMessage.type === "register") {
          userId = parsedMessage.senderId;
          connectedClients.set(userId, ws);
          userStatuses.set(userId, "online");

          try {
            await executeDbOperation(async () => {
              await db
                .collection("users")
                .updateOne(
                  { _id: new ObjectId(userId) },
                  { $set: { status: "online" } }
                );

              const users = await db
                .collection("users")
                .find(
                  {
                    _id: { $ne: new ObjectId(userId) },
                  },
                  {
                    projection: {
                      _id: 1,
                      status: 1,
                      lastSeen: 1,
                    },
                  }
                )
                .toArray();

              //bc status updates
              wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(
                    JSON.stringify({
                      type: "status",
                      userId: userId,
                      status: "online",
                      lastSeen: null,
                    })
                  );
                }
              });
              //sending existing users status to new client
              users.forEach((user) => {
                ws.send(
                  JSON.stringify({
                    type: "status",
                    userId: user._id.toString(),
                    status: user.status || "offline",
                    lastSeen: user.lastSeen,
                  })
                );
              });
            });
          } catch (error) {
            handleDatabaseError(error, "registeration");
          }
          return;
        }

        if (
          parsedMessage.type === "status" &&
          parsedMessage.status === "offline"
        ) {
          const currentTime = new Date();
          try {
            await db.collection("users").updateOne(
              { _id: new ObjectId(userId) },
              {
                $set: {
                  lastSeen: currentTime,
                  status: "offline",
                },
              }
            );

            wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(
                  JSON.stringify({
                    type: "status",
                    userId: userId,
                    status: "offline",
                    lastSeen: currentTime,
                  })
                );
              }
            });
          } catch (error) {
            console.error("Error updating offline status");
          }
        }

        if (parsedMessage.type === "status") {
          userStatuses.set(userId, parsedMessage.status);
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(
                JSON.stringify({
                  type: "status",
                  userId: userId,
                  status: parsedMessage.status,
                })
              );
            }
          });
        }

        if (!userId && parsedMessage.senderId) {
          userId = parsedMessage.senderId;
          connectedClients.set(userId, ws);
        }

        switch (parsedMessage.type) {
          case "message":
            const receiverWs = connectedClients.get(parsedMessage.receiverId);
            if (receiverWs && receiverWs.readyState === WebSocket.OPEN) {
              receiverWs.send(
                JSON.stringify({
                  type: "message",
                  senderId: parsedMessage.senderId,
                  content: parsedMessage.content,
                  timestamp: parsedMessage.timestamp,
                  status: "sent",
                })
              );
            }
            break;

          case "typing":
            const receiverTypingWs = connectedClients.get(
              parsedMessage.receiverId
            );
            if (
              receiverTypingWs &&
              receiverTypingWs.readyState === WebSocket.OPEN
            ) {
              receiverTypingWs.send(
                JSON.stringify({
                  type: "typing",
                  senderId: parsedMessage.senderId,
                  isTyping: parsedMessage.isTyping,
                })
              );
            }
            break;

          case "read_status":
            const senderWs = connectedClients.get(parsedMessage.receiverId);
            if (senderWs && senderWs.readyState === WebSocket.OPEN) {
              senderWs.send(
                JSON.stringify({
                  type: "read_status",
                  senderId: parsedMessage.senderId,
                  receiverId: parsedMessage.receiverId,
                  timestamp: parsedMessage.timestamp,
                })
              );
            }
            break;

          case "call_initiate":
            if (
              !parsedMessage.receiverId ||
              !parsedMessage.callType ||
              !parsedMessage.roomName
            ) {
              console.error("Invalid call initiation request");
              return;
            }

            const existingCall = await db.collection("calls").findOne({
              roomName: parsedMessage.roomName,
              status: { $in: ["initiated", "connected"] },
            });

            if (!existingCall) {
              console.log("No valid call found, aborting initiation");
              return;
            }

            const callReceiverWs = connectedClients.get(
              parsedMessage.receiverId
            );
            if (callReceiverWs?.readyState === WebSocket.OPEN) {
              callReceiverWs.send(
                JSON.stringify({
                  type: "call_initiate",
                  initiatorId: userId,
                  callType: parsedMessage.callType,
                  roomName: parsedMessage.roomName,
                })
              );
            }

            // try {
            //   await db.collection("calls").insertOne({
            //     initiator: new ObjectId(userId),
            //     receiver: new ObjectId(parsedMessage.receiverId),
            //     type: parsedMessage.callType,
            //     status: "initiated",
            //     startTime: new Date(),
            //     roomName: parsedMessage.roomName
            //   });
            // } catch (dbError) {
            //   console.error("Error saving call to DB:", dbError);
            // }
            break;

          case "call_accepted":
            const callerWs = connectedClients.get(parsedMessage.receiverId);
            if (callerWs?.readyState === WebSocket.OPEN) {
              callerWs.send(
                JSON.stringify({
                  type: "call_accepted",
                  senderId: userId,
                  roomName: parsedMessage.roomName,
                })
              );

              await db.collection("calls").updateOne(
                { roomName: parsedMessage.roomName },
                {
                  $set: {
                    status: "connected",
                    // startTime: new Date(),
                  },
                }
              );
            }
            break;

          case "call_rejected":
            const rejectedCallerWs = connectedClients.get(
              parsedMessage.initiatorId
            );
            if (rejectedCallerWs?.readyState === WebSocket.OPEN) {
              rejectedCallerWs.send(
                JSON.stringify({
                  type: "call_rejected",
                  senderId: userId,
                  roomName: parsedMessage.roomName,
                })
              );

              await db
                .collection("calls")
                .updateOne(
                  { roomName: parsedMessage.roomName },
                  { $set: { status: "rejected", endTime: new Date() } }
                );
            }
            break;

          case "call_ended":
            const endedCallWs = connectedClients.get(parsedMessage.initiatorId);
            if (endedCallWs?.readyState === WebSocket.OPEN) {
              endedCallWs.send(
                JSON.stringify({
                  type: "call_ended",
                  senderId: userId,
                  roomName: parsedMessage.roomName,
                })
              );

              await db.collection("calls").updateOne(
                { roomName: parsedMessage.roomName },
                {
                  $set: {
                    status: "completed",
                    endTime: new Date(),
                  },
                }
              );
            }
            break;

          default:
            console.log("Unknown message type");
        }
      } catch (error) {
        console.error("WebSocket message handling error");
        ws.send(
          JSON.stringify({
            type: "error",
            message: "failed to process message",
          })
        );
      }
    });

    ws.on("close", async () => {
      if (userId) {
        const currentTime = new Date().toISOString();
        connectedClients.delete(userId);
        userStatuses.set(userId, "offline");

        try {
          await executeDbOperation(async () => {
            await db.collection("users").updateOne(
              { _id: new ObjectId(userId) },
              {
                $set: {
                  lastSeen: currentTime,
                  status: "offline",
                },
              }
            );

            wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(
                  JSON.stringify({
                    type: "status",
                    userId: userId,
                    status: "offline",
                    lastSeen: currentTime,
                  })
                );
              }
            });
          });
        } catch (error) {
          console.error("Error updating offline status");
        }
      }
    });

    ws.on("error", (error) => {
      console.error("WebSocket error");
      if (userId) {
        connectedClients.delete(userId);
        userStatuses.set(userId, "offline");
      }
    });
  });

  setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  return wss;
};

export default initializeWebSocket;
