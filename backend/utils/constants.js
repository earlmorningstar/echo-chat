const CallStatus = {
  INITIATED: "initiated",
  MISSED: "missed",
  COMPLETED: "completed",
  REJECTED: "rejected",
  CONNECTED: "connected",
};

const CallType = {
  VOICE: "voice",
  VIDEO: "video",
};

const WsEventType = {
  CALL_INITIATE: "call_initiate",
  CALL_ACCEPT: "call_accept",
  CALL_REJECT: "call_reject",
  CALL_END: "call_end",
  CALL_TIMEOUT: "call_timeout",
  CALL_ERROR: "error",
};

export { CallStatus, CallType, WsEventType };
