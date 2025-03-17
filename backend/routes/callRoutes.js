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
} from "../controllers/callController.js";


router.get("/test", (req, res) => {
  console.log("Test endpoint hit!");
  res.send("Test endpoint working!");
});
router.post("/voice", handleVoiceRequest);
router.get("/:callId/token", authenticateUser, getCallToken);
router.post("/start", authenticateUser, startCall);
router.patch("/:callId/accept", authenticateUser, acceptCall);
router.patch("/:callId/reject", authenticateUser, rejectCall);
router.patch("/:callId/end", authenticateUser, endCall);

export default router;
