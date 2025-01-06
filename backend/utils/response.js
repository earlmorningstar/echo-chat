const sendError = (res, statusCode, message, error = null) => {
    res.status(statusCode).json({ success: false, message, error });
  };
  
  const sendSuccess = (res, statusCode, message, data = null) => {
    res.status(statusCode).json({ success: true, message, data });
  };
  
  module.exports = { sendError, sendSuccess };
  