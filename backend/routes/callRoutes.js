import express from "express";
const router = express.Router();
import { authenticateUser } from "../middleware/authMiddleware.js";
import {
  startCall,
  acceptCall,
  rejectCall,
  endCall,
  getCallToken,
  handleVoiceRequest,
  handleTwilioCallStatus,
  handleVideoStatus,
  restartVideoCall,
  getCallHistory,
} from "../controllers/callController.js";

router.post("/voice", handleVoiceRequest);
router.post("/voice-status", handleTwilioCallStatus);
router.get("/:callId/token", authenticateUser, getCallToken);
router.post("/start", authenticateUser, startCall);
router.patch("/:callId/accept", authenticateUser, acceptCall);
router.patch("/:callId/reject", authenticateUser, rejectCall);
router.patch("/:callId/end", authenticateUser, endCall);
router.post("/video-status", handleVideoStatus);
router.post("/:callId/restart", authenticateUser, restartVideoCall);
router.get("/history", authenticateUser, getCallHistory);

export default router;
