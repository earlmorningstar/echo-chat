import Call from "../models/callSchema.js";
import { Types } from "mongoose";
const { ObjectId } = Types;
import twilio from "twilio";
import { sendError, sendSuccess } from "../utils/response.js";

const twilioClient = twilio(
  process.env.TWILIO_API_KEY,
  process.env.TWILIO_API_SECRET,
  { accountSid: process.env.TWILIO_ACCOUNT_SID }
);

const generateToken = async (req, res) => {
  const { roomName } = req.body;
  const userId = req.userId;

  try {
    // Creating video grant
    const videoGrant = new twilio.jwt.AccessToken.VideoGrant({
      room: roomName,
    });

    // Create access token
    const token = new twilio.jwt.AccessToken(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_API_KEY,
      process.env.TWILIO_API_SECRET
    );

    //adding grant to the generated token
    token.addGrant(videoGrant);
    token.identity = userId;
    sendSuccess(res, 200, "Token generated successfully", {
      token: token.toJwt(),
    });
  } catch (error) {
    console.error("Token generation error:", error);
    sendError(res, 500, "Could not generate token", error);
  }
};

const initiateCall = async (req, res) => {
  const { receiverId, type } = req.body;
  const initiatorId = req.userId;

  try {
    if (!receiverId || !type) {
      return sendError(res, 400, "Missing required fields");
    }

    const roomName = `${initiatorId}-${receiverId}-${Date.now()}`;

    let call;
    try {
      // const call = await Call.create({
      call = await Call.create({
        initiator: new ObjectId(initiatorId),
        receiver: new ObjectId(receiverId),
        type,
        //   status: "missed", //this will be updated when a call is answered or rejected
        startTime: new Date(),
        roomName,
      });
    } catch (dbError) {
      console.error("Database error during call creation:", dbError);
      return sendError(res, 500, "Database error during call creation", {
        error: dbError.message,
      });
    }

    //socket evt for incoming call
    if (req.io) {
      req.io.to(receiverId).emit("incomingCall", {
        callId: call._id.toString(),
        initiatorId,
        type,
        roomName,
      });
    }
    sendSuccess(res, 201, "Call initiated successfully", {
      callId: call._id.toString(),
      roomName,
    });
  } catch (error) {
    console.error("Call initiation error:", error);
    sendError(res, 500, "Error initiating call", { error: error.message });
  }
};

const updateCallStatus = async (req, res) => {
  const { callId, status, endTime } = req.body;

  try {
    if (!callId || !status) {
      return sendError(res, 400, "Missing required fields");
    }

    const call = await Call.findById(new ObjectId(callId));
    if (!call) {
      return sendError(res, 404, "Call not found");
    }

    call.status = status;
    if (endTime) {
      call.endTime = new Date(endTime);
      call.duration = (new Date(endTime) - call.startTime) / 1000;
    }

    await call.save();

    sendSuccess(res, 200, "Call status updated successfully", {
      call: call.toObject(),
    });
  } catch (error) {
    console.error("Call status update error:", error);
    sendError(res, 500, "Error updating call status", { error: error.message });
  }
};

export { generateToken, initiateCall, updateCallStatus };
