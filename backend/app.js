import express from "express";
import http from "http";
import cors from "cors";
import cookieParser from "cookie-parser";
import { connectToDatabase } from "./config/database.js";
import userRoutes from "./routes/userRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import initializeWebSocket from "./WebSocket/WebSocket.js";
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
  res.status(200).json({ message: "API is running successfully!" });
});

app.get("/", (req, res) => {
  res.send("Welcome to the EchoChat Backend API");
});

const server = http.createServer(app);

connectToDatabase()
  .then((db) => {
    console.log("Database connected and ready to use.");

    const wss = initializeWebSocket(server, db);

    app.use((req, res, next) => {
      req.db = db;
      next();
    });

    app.use("/api", userRoutes);
    app.use("/api/auth", authRoutes);
    app.use("/api/messages", messageRoutes);
    app.use("/api/uploads", uploadRoutes);

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Database connection error:", err);
    process.exit(1);
  });

export default app;
