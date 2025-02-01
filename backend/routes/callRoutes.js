import express from "express";
const router = express.Router();
import { authenticateUser } from "../middleware/authMiddleware.js";
import {
  generateToken,
  initiateCall,
  updateCallStatus,
} from "../controllers/callController.js";

router.post("/token", authenticateUser, generateToken);
router.post("/initiate", authenticateUser, initiateCall);
router.post("/status", authenticateUser, updateCallStatus);

export default router;
