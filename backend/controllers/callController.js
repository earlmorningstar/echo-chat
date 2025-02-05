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
    if (!roomName || !userId) {
      return sendError(res, 400, "Room name and user ID are required");
    }

    // Create access token
    const token = new twilio.jwt.AccessToken(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_API_KEY,
      process.env.TWILIO_API_SECRET,
      { identity: userId.toString() }
    );

    const videoGrant = new twilio.jwt.AccessToken.VideoGrant({
      room: roomName,
    });

    //adding grant to the generated token
    token.addGrant(videoGrant);
    // token.identity = userId;
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
    // if (!receiverId || !type) {
    //   return sendError(res, 400, "Missing required fields");
    // }

    const existingCall = await Call.findOne({
      initiator: initiatorId,
      receiver: receiverId,
      status: { $in: ["initiated", "connected"] },
    });

    if (existingCall) {
      return sendSuccess(res, 200, "Call already exists", {
        callId: existingCall._id,
        roomName: existingCall.roomName,
      });
    }

    const roomName = `${initiatorId}-${receiverId}-${Date.now()}`;

    
    const call = await Call.create({
      initiator: new ObjectId(initiatorId),
      receiver: new ObjectId(receiverId),
      type,
      startTime: new Date(),
      roomName,
    });
    

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
  const { roomName, status, endTime } = req.body;

  try {
    const updateData = {
      status,
      ...(endTime && { endTime: new Date(endTime) }),
    };

    // first get the existing call
    const existingCall = await Call.findOne({ roomName });
    if (!existingCall) return sendError(res, 404, "Call not found");

    // calculate duration if ending call
    if (endTime && existingCall.startTime) {
      updateData.duration = Math.floor(
        (new Date(endTime) - existingCall.startTime) / 1000
      );
    }

    const call = await Call.findOneAndUpdate(
      { roomName },
      { $set: updateData },
      { new: true }
    ).lean();

    sendSuccess(res, 200, "Call status updated successfully", { call });
  } catch (error) {
    console.error("Update call error:", error);
    sendError(res, 500, "Error updating call status", { error: error.message });
  }
};

export { generateToken, initiateCall, updateCallStatus };
