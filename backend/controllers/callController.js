// import Call from "../models/callSchema.js";
// import { Types } from "mongoose";
// const { ObjectId } = Types;
// import twilio from "twilio";
// import { sendError, sendSuccess } from "../utils/response.js";

// const twilioClient = twilio(
//   process.env.TWILIO_API_KEY,
//   process.env.TWILIO_API_SECRET,
//   { accountSid: process.env.TWILIO_ACCOUNT_SID }
// );

// const generateToken = async (req, res) => {
//   const { roomName } = req.body;
//   const userId = req.userId;

//   try {
//     if (!roomName || !userId) {
//       return sendError(res, 400, "Room name and user ID are required");
//     }

//     // Create access token
//     const token = new twilio.jwt.AccessToken(
//       process.env.TWILIO_ACCOUNT_SID,
//       process.env.TWILIO_API_KEY,
//       process.env.TWILIO_API_SECRET,
//       { identity: userId.toString() }
//     );

//     const videoGrant = new twilio.jwt.AccessToken.VideoGrant({
//       room: roomName,
//     });

//     //adding grant to the generated token
//     token.addGrant(videoGrant);
//     // token.identity = userId;
//     sendSuccess(res, 200, "Token generated successfully", {
//       token: token.toJwt(),
//     });
//   } catch (error) {
//     console.error("Token generation error:", error);
//     sendError(res, 500, "Could not generate token", error);
//   }
// };

// const initiateCall = async (req, res) => {
//   const { receiverId, type } = req.body;
//   const initiatorId = req.userId;

//   try {
//     //validate receiver exists
//     const receiver = await User.findById(receiverId);
//     if (!receiver) return sendError(res, 404, "Receiver not found");

//     const room = await twilioClient.video.rooms.create({
//       uniqueName: roomName,
//       type: "peer-to-peer",
//     });

//     const call = await Call.create({
//       initiator: new ObjectId(initiatorId),
//       receiver: new ObjectId(receiverId),
//       type,
//       roomName,
//       status: "initiated",
//       startTime: new Date(),
//     });

//     const existingCall = await Call.findOne({
//       initiator: initiatorId,
//       receiver: receiverId,
//       status: { $in: ["initiated", "connected"] },
//     });

//     if (existingCall) {
//       return sendSuccess(res, 200, "Call already exists", {
//         callId: existingCall._id,
//         roomName: existingCall.roomName,
//       });
//     }

//     const roomName = `room-${initiatorId}-${receiverId}-${Date.now()}`;

//     sendSuccess(res, 201, "Call initiated successfully", {
//       callId: call._id.toString(),
//       roomName,
//     });
//   } catch (error) {
//     console.error("Call initiation error:", error);
//     sendError(res, 500, "Error initiating call", { error: error.message });
//   }
// };

// const updateCallStatus = async (req, res) => {
//   const { roomName, status, endTime } = req.body;

//   try {
//     const updateData = {
//       status,
//       ...(endTime && { endTime: new Date(endTime) }),
//     };

//     // first get the existing call
//     const existingCall = await Call.findOne({ roomName });
//     if (!existingCall) return sendError(res, 404, "Call not found");

//     // calculate duration if ending call
//     if (endTime && existingCall.startTime) {
//       updateData.duration = Math.floor(
//         (new Date(endTime) - existingCall.startTime) / 1000
//       );
//     }

//     const call = await Call.findOneAndUpdate(
//       { roomName },
//       { $set: updateData },
//       { new: true }
//     ).lean();

//     sendSuccess(res, 200, "Call status updated successfully", { call });
//   } catch (error) {
//     console.error("Update call error:", error);
//     sendError(res, 500, "Error updating call status", { error: error.message });
//   }
// };

// export { generateToken, initiateCall, updateCallStatus };

import { Types } from "mongoose";
const { ObjectId } = Types;
import twilio from "twilio";
const AccessToken = twilio.jwt.AccessToken;
const { VideoGrant, VoiceGrant } = AccessToken;
import { sendError, sendSuccess } from "../utils/response.js";
import { CallStatus, CallType } from "../utils/constants.js";
import { validateCall } from "../utils/validateCall.js";

const generateTwilioToken = async (identity, callType, roomName) => {
  if (
    !process.env.TWILIO_ACCOUNT_SID ||
    !process.env.TWILIO_API_KEY ||
    !process.env.TWILIO_API_SECRET
  ) {
    throw new Error("Twilio credentials are missing in .env file");
  }

  const token = new AccessToken(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_API_KEY,
    process.env.TWILIO_API_SECRET,
    { identity: identity.toString(), ttl: 3600 }
  );

  //adding grants based on call type
  if (callType === CallType.VIDEO) {
    const videoGrant = new VideoGrant({ room: roomName });
    token.addGrant(videoGrant);
  } else if (callType === CallType.VOICE) {
    const voiceGrant = new VoiceGrant({
      outgoingCallPermissions: {
        allowedDestinations: ["client:*"],
      },
    });
    token.addGrant(voiceGrant);
  } else {
    throw new Error(`Invalid call type: ${callType}`);
  }

  return token.toJwt();
};

const startCall = async (req, res) => {
  const { callerId, recipientId, callType } = req.body;

  console.log("Received call request with:", {
    callerId,
    recipientId,
    callType,
  });

  try {
    if (!ObjectId.isValid(callerId)) {
      console.error("Invalid callerId format:", callerId);
      return sendError(res, 400, "Invalid caller ID format");
    }

    if (!ObjectId.isValid(recipientId)) {
      console.error("Invalid recipientId format:", recipientId);
      return sendError(res, 400, "Invalid recipient ID format");
    }

    //validating input
    // if (!ObjectId.isValid(callerId) || !ObjectId.isValid(recipientId)) {
    //   return sendError(res, 400, "Invalid user ID format");
    // }

    const callerObjectId = new ObjectId(callerId);
    const recipientObjectId = new ObjectId(recipientId);

    //checking if user exists
    const [caller, recipient] = await Promise.all([
      req.db.collection("users").findOne({ _id: callerObjectId }),
      req.db.collection("users").findOne({ _id: recipientObjectId }),
    ]);

    if (!caller || !recipient) {
      return sendError(res, 404, "Caller or recipient not found");
    }

    //preventing call to self
    if (callerId === recipientId) {
      return sendError(res, 400, "You cannot call yourself");
    }

    //checking friendship status
    const areFriends = await req.db.collection("friendships").findOne({
      $or: [
        {
          user1Id: callerId,
          user2Id: recipientId,
        },
        {
          user1Id: recipientId,
          user2Id: callerId,
        },
      ],
      status: "accepted",
    });

    console.log("Friendship query:", {
      $or: [
        { user1Id: callerId, user2Id: recipientId },
        { user1Id: recipientId, user2Id: callerId },
      ],
      status: "accepted",
    });

    console.log("Friendship exists:", !!areFriends);

    if (!areFriends) {
      return sendError(res, 403, "You can only call your friends");
    }

    //create call object
    const newCall = {
      caller: callerId,
      recipient: recipientId,
      startTime: new Date(),
      type: callType,
      status: CallStatus.INITIATED,
      createdAt: new Date(),
      updateAt: new Date(),
      roomName: `room-${callerId}-${Date.now()}`,
    };

    validateCall(newCall);

    //inserting into db
    const result = await req.db.collection("calls").insertOne(newCall);
    const insertedCall = await req.db
      .collection("calls")
      .findOne({ _id: result.insertedId });

    console.log("Inserted call document:", insertedCall);

    //generating twilio access token for frontend
    const accessToken = await generateTwilioToken(
      callerId,
      callType,
      newCall.roomName
      // result.insertedId.toString()
    );

    console.log("Twilio token generated:", accessToken);
    console.log("Response payload:", {
      call: {
        ...insertedCall,
        _id: insertedCall._id.toString(),
        twilioRoomSid: insertedCall._id.toString(),
      },
      token: accessToken,
    });

    sendSuccess(
      res,
      201,
      "Call initiated successfully",
      {
        call: {
          ...insertedCall,
          _id: insertedCall._id.toString(),
          twilioRoomSid: insertedCall._id.toString(),
        },
        token: accessToken,
      },
      false
    );
  } catch (error) {
    console.error("Call initiation error:", error.message);

    if (error.message.includes("Invalid call type")) {
      return sendError(res, 400, error.message);
    }
    sendError(res, 500, "Failed to initiate call");
  }
};

const acceptCall = async (req, res) => {
  const { callId } = req.params;
  const { userId } = req.body;

  try {
    const call = await req.db
      .collection("calls")
      .findOne({ _id: new ObjectId(callId), recipient: userId });

    if (!call) {
      return sendError(res, 404, "Call not found");
    }

    await req.db
      .collection("calls")
      .updateOne(
        { _id: new ObjectId(callId) },
        { $set: { status: CallStatus.CONNECTED } }
      );

    sendSuccess(res, 200, "Call accapted", { callId }, false);
  } catch (error) {
    sendError(res, 500, "Error acceptingh call");
  }
};

const rejectCall = async (req, res) => {
  const { callId } = req.params;
  const { userId } = req.body;

  try {
    const call = await req.db
      .collection("calls")
      .findOne({ _id: new ObjectId(callId), recipient: userId });

    if (!call) {
      return sendError(res, 404, "Call not found");
    }

    await req.db
      .collection("calls")
      .updateOne(
        { _id: new ObjectId(callId) },
        { $set: { status: CallStatus.REJECTED, endTime: new Date() } }
      );

    sendSuccess(res, 200, "Call rejected", { callId }, false);
  } catch (error) {
    sendError(res, 500, "Error rejecting call");
  }
};

const endCall = async (req, res) => {
  const { callId } = req.params;
  const { userId } = req.body;

  try {
    const call = await req.db.collection("calls").findOne({
      _id: new ObjectId(callId),
      $or: [{ caller: userId }, { recipient: userId }],
    });

    if (!call) {
      return sendError(res, 404, "Call not found");
    }

    await req.db
      .collection("calls")
      .updateOne(
        { _id: new ObjectId(callId) },
        { $set: { status: CallStatus.COMPLETED, endTime: new Date() } }
      );

    sendSuccess(res, 200, "Call ended", { callId }, false);
  } catch (error) {
    sendError(res, 500, "Error ending call");
  }
};
export { generateTwilioToken, startCall, acceptCall, rejectCall, endCall };
