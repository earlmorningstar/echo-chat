import express from "express";
const router = express.Router();
import { renewToken, authenticateUser } from "../middleware/authMiddleware.js";

router.post("/renew-token", authenticateUser, renewToken);

export default router;
