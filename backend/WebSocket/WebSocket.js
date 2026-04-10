import { WebSocketServer } from "ws";
import WebSocketEventHandler from "./WebSocketEventHandler.js";
import { RateLimiter, createRequestPool } from "../utils/networkControl.js";
import { ObjectId } from "mongodb";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const isValidObjectId = (id) => ObjectId.isValid(id);

const HEARTBEAT_INTERVAL = 45000;
const HEARTBEAT_TIMEOUT = 20000;

const initializeWebSocket = (server, db) => {
  if (!db) {
    throw new Error("Database connection is required");
  }

  const wss = new WebSocketServer({
    server,
    clientTracking: true,
    maxPayload: 50 * 1024,
  });

  const eventHandler = new WebSocketEventHandler(wss, db);
  const rateLimiter = new RateLimiter();
  const requestPool = createRequestPool(10);
  const connectedClients = new Map();

  wss.on("connection", async (ws, req) => {
    const clientId = `${req.socket.remoteAddress}-${Date.now()}`;
    let userId = null;

    const setupClient = async () => {
      ws.isAlive = true;
      ws.clientId = clientId;
      rateLimiter.initializeClient(clientId);
    };

    const handleClientPing = () => {
      ws.isAlive = true;
      ws.send(JSON.stringify({ type: "pong" }));
    };

    const processMessage = async (rawMessage) => {
      if (!rateLimiter.checkLimit(clientId)) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Rate limit exceeded. Please slow down.",
          }),
        );
        return;
      }

      try {
        const message = JSON.parse(rawMessage);

        if (message.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
          return;
        }

        if (message.type === "ping") {
          handleClientPing();
          return;
        }

        if (message.type === "register") {
          await handleRegistration(message);
          return;
        }

        await requestPool.execute(() => eventHandler.handleEvent(ws, message));
      } catch (error) {
        // console.error("Message processing error:", {
        //   error: error.message,
        //   rawMessage: rawMessage.toString(),
        // });

        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: error.message,
            }),
          );
        }
        handleError(error);
      }
    };

    const handleRegistration = async (message) => {
      try {
        // ── JWT Token verification ────────────────────────────────
        const token = message.token;
        if (!token) {
          ws.send(
            JSON.stringify({
              type: "error",
              id: message.id,
              message: "Authentication required: no token provided",
            }),
          );
          ws.close(4001, "No token provided");
          return;
        }

        let decoded;
        try {
          decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (jwtError) {
          ws.send(
            JSON.stringify({
              type: "error",
              id: message.id,
              message: "Authentication failed: invalid or expired token",
            }),
          );
          ws.close(4001, "Invalid token");
          return;
        }

        // Ensure the token's userId matches the claimed senderId
        const tokenUserId = decoded.userId?.toString();
        const claimedUserId = message.senderId?.toString();

        if (!tokenUserId || !claimedUserId || tokenUserId !== claimedUserId) {
          ws.send(
            JSON.stringify({
              type: "error",
              id: message.id,
              message:
                "Authentication failed: token does not match sender identity",
            }),
          );
          ws.close(4001, "Token mismatch");
          return;
        }

        if (!isValidObjectId(claimedUserId)) {
          throw new Error("Invalid user ID format");
        }

        const stringUserId = claimedUserId;

        userId = stringUserId;
        connectedClients.set(userId, ws);
        await eventHandler.registerClient(userId, ws);

        //sending immediate acknowledgment
        if (message.requireAck) {
          ws.send(
            JSON.stringify({
              type: "ack",
              id: message.id,
            }),
          );
        }

        const connectedUsers = Array.from(connectedClients.keys()).filter(
          (id) => id !== userId,
        );

        // to broadcast new user's status
        broadcastStatus(userId, "online");

        //sending existing users statuses
        connectedUsers.forEach((connectedUserId) => {
          ws.send(
            JSON.stringify({
              type: "status",
              userId: connectedUserId,
              status: "online",
              lastSeen: null,
            }),
          );
        });
      } catch (error) {
        console.error("Registration failed");
        if (message.requireAck) {
          ws.send(
            JSON.stringify({
              type: "error",
              id: message.id,
              message: "Registration failed",
            }),
          );
        }
        throw error;
      }
    };

    const broadcastStatus = (targetUserId, status) => {
      const statusMessage = JSON.stringify({
        type: "status",
        userId: targetUserId,
        status: status,
        lastSeen: status === "offline" ? new Date() : null,
      });

      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(statusMessage);
        }
      });
    };

    const handleError = (error) => {
      ws.send(
        JSON.stringify({
          type: "error",
          message: "An error occurred processing your request",
        }),
      );
    };

    const cleanup = async () => {
      clearInterval(heartbeatInterval);
      rateLimiter.removeClient(clientId);

      if (userId) {
        connectedClients.delete(userId);
        await eventHandler.removeClient(userId);

        try {
          await eventHandler.handleStatusUpdate({
            senderId: userId,
            status: "offline",
          });
        } catch (error) {
          console.error("Error updating offline status");
        }
      }
    };

    await setupClient();

    const heartbeatInterval = setInterval(() => {
      if (!ws.isAlive) {
        cleanup().finally(() => ws.terminate());
        return;
      }

      ws.isAlive = false;
      try {
        ws.ping();
      } catch (error) {
        cleanup().finally(() => ws.terminate());
      }

      const timeout = setTimeout(() => {
        if (!ws.isAlive) {
          cleanup().finally(() => ws.terminate());
        }
      }, HEARTBEAT_TIMEOUT);

      ws.once("pong", () => {
        clearTimeout(timeout);
        ws.isAlive = true;
      });
    }, HEARTBEAT_INTERVAL);

    ws.on("message", (message) => processMessage(message));
    ws.on("pong", () => {
      ws.isAlive = true;
    });
    ws.on("close", cleanup);
    ws.on("error", (error) => {
      handleError(error);
      cleanup();
    });
  });

  return wss;
};

export default initializeWebSocket;
