const sendError = (res, statusCode, message, details = {}, log = true) => {
  if (log) {
    console.log("Sending error response:", { statusCode, message, details });
  }
  return res.status(statusCode).json({ success: false, message, ...details });
};

const sendSuccess = (res, statusCode, message, data = {}, log = true) => {
  if (log) {
    console.log("Sending success response:", { statusCode, message, data });
  }
  return res.status(statusCode).json({ success: true, message, ...data });
};

export { sendError, sendSuccess };
