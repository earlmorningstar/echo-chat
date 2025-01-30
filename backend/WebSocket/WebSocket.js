import { WebSocketServer } from "ws";
import { ObjectId } from "mongodb";

const connectedClients = new Map();
const userStatuses = new Map();

const initializeWebSocket = (server, db) => {
  if (!db) {
    throw new Error("Database connection is required");
  }

  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    let userId = null;

    ws.on("message", async (message) => {
      try {
        const parsedMessage = JSON.parse(message);

        if (parsedMessage.type === "register") {
          userId = parsedMessage.senderId;
          connectedClients.set(userId, ws);
          userStatuses.set(userId, "online");

          try {
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
          } catch (error) {
            console.error("Database operation failed during registeration");
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

          default:
            console.log("Unknown message type");
        }
      } catch (error) {
        console.error("WS parsing error");
      }
    });

    ws.on("close", async () => {
      if (userId) {
        const currentTime = new Date().toISOString();
        connectedClients.delete(userId);
        userStatuses.set(userId, "offline");

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

  return wss;
};

export default initializeWebSocket;
