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
}

export { validateCall };
