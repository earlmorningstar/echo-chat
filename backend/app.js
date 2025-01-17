const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { connectToDatabase } = require("./config/database");
const userRoutes = require("./routes/userRoutes");
const messageRoutes = require("./routes/messageRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const WebSocket = require("ws");
require("dotenv").config();

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://echochat-pi.vercel.app",
      "https://echochat-git-master-onyeabor-joels-projects.vercel.app",
      "https://echochat-nvw5ir5wi-onyeabor-joels-projects.vercel.app",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["set-cookie"],
  })
);

app.use(cookieParser());
app.use(express.json());

const server = require("http").createServer(app);

app.get("/api/health", (req, res) => {
  res.status(200).json({ message: "API is running successfully!" });
});

app.get("/", (req, res) => {
  res.send("Welcome to the EchoChat Backend API");
});

const connectedClients = new Map();
const userStatuses = new Map();
const lastSeenTimes = new Map();

const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  console.log("Connected a new ws client");
  let userId = null;

  ws.on("message", (message) => {
    try {
      const parsedMessage = JSON.parse(message);
      console.log("Received message:", parsedMessage);

      if (parsedMessage.type === "register") {
        userId = parsedMessage.senderId;
        connectedClients.set(userId, ws);
        userStatuses.set(userId, "online");
        console.log(`Client ${userId} registered`);

        const currentStatus = userStatuses.get(userId) || "online";
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                type: "status",
                userId: userId,
                status: currentStatus,
                lastSeen: null,
              })
            );
          }
        });

        Array.from(userStatuses.entries())
          .filter(([uid]) => uid !== userId)
          .forEach(([uid, status]) => {
            ws.send(
              JSON.stringify({
                type: "status",
                userId: uid,
                status: status,
                lastSeen: lastSeenTimes.get(uid),
              })
            );
          });
        return;
      }

      if (
        parsedMessage.type === "status" &&
        parsedMessage.status === "offline"
      ) {
        const currentTime = new Date().toISOString();
        lastSeenTimes.set(userId, currentTime);
        userStatuses.set(userId, "offline");

        wss.client.forEach((client) => {
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
        console.log(`Client ${userId} registered`);
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

        case "status":
          userStatuses.set(userId, parsedMessage.status);
          broadcastStatus(userId, parsedMessage.status);
          break;

        default:
          console.log("Unknown message type:", parsedMessage.type);
      }
    } catch (error) {
      console.error("WS parsing error:", error);
    }
  });

  ws.on("close", () => {
    if (userId) {
      const currentTime = new Date().toISOString();
      lastSeenTimes.set(userId, currentTime);
      connectedClients.delete(userId);
      userStatuses.set(userId, "offline");
      console.log(`Client ${userId} disconnected`);

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
    console.log("Disconnected WS client");
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
    if (userId) {
      connectedClients.delete(userId);
      userStatuses.set(userId, "offline");
    }
  });
});

connectToDatabase()
  .then((db) => {
    console.log("Database connected and ready to use.");

    app.use((req, res, next) => {
      req.db = db;
      next();
    });

    app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
      next();
    });

    app.get("/api/test-db", async (req, res) => {
      try {
        const collections = await req.db.listCollections().toArray();
        res.json({
          collections: collections.map((c) => c.name),
          hasGridFS: collections.some((c) => c.name.startsWith("fs.")),
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.use("/api", userRoutes);
    app.use("/api/messages", messageRoutes);
    app.use("/api/uploads", uploadRoutes);

    app.use((err, req, res, next) => {
      console.error("Error:", err);
      res.status(500).json({ error: err.message });
    });

    app.use((req, res, next) => {
      console.log("Incoming request:", {
        method: req.method,
        url: req.url,
        path: req.path,
      });
      next();
    });

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Database connection error:", err);
    process.exit(1);
  });

module.exports = app;
