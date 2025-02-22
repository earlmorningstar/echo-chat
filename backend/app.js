import express from "express";
import http from "http";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import {
  connectToDatabase,
  disconnectFromDatabase,
} from "./config/database.js";
import userRoutes from "./routes/userRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import callRoutes from "./routes/callRoutes.js";
import initializeWebSocket from "./WebSocket/WebSocket.js";
import { setupFriendshipCollections } from "./models/friendshipSchema.js";
import dotenv from "dotenv";

dotenv.config();

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

app.get("/api/health", (req, res) => {
  res.status(200).json({
    message: "API is running successfully!",
    dbStatus:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

app.get("/", (req, res) => {
  res.send("Welcome to the EchoChat Backend API");
});

const server = http.createServer(app);

const initializeServer = async () => {
  try {
    // Connect to database
    const db = await connectToDatabase();
    console.log("Database connected and ready to use.");
    console.log("Current database:", db.databaseName);

    // Initialize collections
    await Promise.all([
      setupFriendshipCollections(db),
      // ensureCallCollection()
    ]);

    // Initialize WebSocket server
    const wss = initializeWebSocket(server, db);

    app.use((req, res, next) => {
      req.db = db;
      next();
    });

    // Routes
    app.use("/api", userRoutes);
    app.use("/api/auth", authRoutes);
    app.use("/api/messages", messageRoutes);
    app.use("/api/uploads", uploadRoutes);
    app.use("/api/call", callRoutes);

    // Handle server shutdown
    const cleanup = async () => {
      console.log("Server shutting down...");
      try {
        await disconnectFromDatabase();
        server.close(() => {
          console.log("Server closed");
          process.exit(0);
        });
      } catch (error) {
        console.error("Error during cleanup");
        process.exit(1);
      }
    };

    process.on("SIGTERM", cleanup);
    process.on("SIGINT", cleanup);

    // Start server
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Server initialization error");
    process.exit(1);
  }
};

initializeServer().catch((err) => {
  console.error("Failed to start server");
  process.exit(1);
});

export default app;
