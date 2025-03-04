import express from "express";
const router = express.Router();
import { authenticateUser } from "../middleware/authMiddleware.js";
import {
  startCall,
  acceptCall,
  rejectCall,
  endCall,
} from "../controllers/callController.js";

// router.post("/token", authenticateUser, generateToken);
// router.post("/initiate", authenticateUser, initiateCall);
// router.post("/status", authenticateUser, updateCallStatus);

router.post("/start", authenticateUser, startCall);
router.patch("/:callId/accept", authenticateUser, acceptCall);
router.patch("/:callId/reject", authenticateUser, rejectCall);
router.patch("/:callId/end", authenticateUser, endCall);

export default router;
