import { CallStatus, CallType } from "./constants.js";
import { sendError } from "./response.js";

function validateCall(call) {
  if (!call.caller || !call.recipient) {
    sendError(res, 400, "Caller and recipient are required");
  }

  if (!Object.values(CallType).includes(call.type)) {
    sendError(res, 400, "Invalid call type");
  }

  if (!Object.values(CallStatus).includes(call.status)) {
    sendError(res, 400, "Invalid call status");
  }

  if (call.type === CallType.VIDEO) {
    //video room names, following a specific pattern
    if (!call.roomName.startsWith("video-")) {
      sendError(res, 400, "Video room name must start with 'video-'");
    }
  }

  if (call.type === CallType.VOICE) {
    //same as this
    if (!call.roomName.startsWith("voice-")) {
      sendError(res, 400, "Voice room name must start with 'video-'");
    }
  }
}

export { validateCall };
