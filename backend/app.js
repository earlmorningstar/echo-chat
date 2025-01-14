const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { connectToDatabase } = require("./config/database");
const userRoutes = require("./routes/userRoutes");
const messageRoutes = require("./routes/messageRoutes");
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

const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  console.log("Connected a new ws client");

  ws.on("message", (message) => {
    try {
      const parsedMessage = JSON.parse(message);
      if (parsedMessage.type === "chat") {
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(parsedMessage.text);
          }
        });
      }
    } catch (error) {
      console.error("WS parsing error:", error);
    }
  });
  ws.on("close", () => {
    console.log("Disconnected WS client");
  });
});

connectToDatabase()
  .then((db) => {
    console.log("Database connected and ready to use.");

    app.use((req, res, next) => {
      req.db = db;
      next();
    });

    app.use("/api", userRoutes);
    app.use("/api/messages", messageRoutes);

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
