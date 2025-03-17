import { Types } from "mongoose";
const { ObjectId } = Types;
import twilio from "twilio";
const AccessToken = twilio.jwt.AccessToken;
const { VideoGrant, VoiceGrant } = AccessToken;
const { VoiceResponse } = twilio.twiml;
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

  const cleanIdentity = identity.replace(/^client:/, "");

  const token = new AccessToken(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_API_KEY,
    process.env.TWILIO_API_SECRET,
    { identity: `client:${cleanIdentity}`, ttl: 3600 }
  );

  //adding grants based on call type
  if (callType === CallType.VOICE) {
    const voiceGrant = new VoiceGrant({
      incomingAllow: true,
      outgoingApplicationSid: process.env.TWILIO_APP_SID,
      outgoingCallApplicationSid: process.env.TWILIO_APP_SID,
    });
    token.addGrant(voiceGrant);

    console.log("Generated token for:", `client:${cleanIdentity}`);
    console.log("Token grants:", {
      incomingAllow: true,
      outgoingApplicationSid: process.env.TWILIO_APP_SID,
    });
  } else if (callType === CallType.VIDEO) {
    const videoGrant = new VideoGrant({ room: roomName });
    token.addGrant(videoGrant);
  } else {
    throw new Error(`Invalid call type: ${callType}`);
  }

  return token.toJwt();
};

const getCallToken = async (req, res) => {
  try {
    const call = await req.db.collection("calls").findOne({
      _id: new ObjectId(req.params.callId),
      $or: [{ caller: req.user._id }, { recipient: req.user._id }],
    });

    if (!call) return sendError(res, 404, "Call not found");

    const token = await generateTwilioToken(
      req.user._id.toString(),
      call.type,
      call.roomName
    );
    sendSuccess(res, 200, "Token generated", {
      token,
      roomName: call.roomName,
    });
  } catch (error) {
    sendError(res, 500, "Token generation failed");
  }
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

    const existingCall = await req.db.collection("calls").findOne({
      caller: callerId,
      recipient: recipientId,
      status: CallStatus.INITIATED,
      createdAt: { $gt: new Date(Date.now() - 5000) },
    });

    if (existingCall) {
      return sendError(res, 400, "Call already initiated");
    }

    //creating call object
    const newCall = {
      caller: callerId,
      recipient: recipientId,
      startTime: new Date(),
      type: callType,
      status: CallStatus.INITIATED,
      createdAt: new Date(),
      updateAt: new Date(),
      roomName:
        callType === CallType.VIDEO
          ? `room-${callerId}-${Date.now()}`
          : `voice-${callerId}-${Date.now()}`,
    };

    if (callType === CallType.VOICE && !newCall.roomName) {
      newCall.roomName = `voice-${callerId}-${Date.now()}`;
    }

    validateCall(newCall);

    //inserting into db
    const result = await req.db.collection("calls").insertOne(newCall);

    if (!result.acknowledged) {
      throw new error("Failed to insert call doc");
    }
    const insertedCall = await req.db
      .collection("calls")
      .findOne({ _id: result.insertedId });

    if (!insertedCall) {
      throw new error("Failed to retrieve inserted call document");
    }

    console.log("Inserted call document:", insertedCall);

    //generating twilio access token for frontend
    const accessToken = await generateTwilioToken(
      callerId,
      callType,
      insertedCall.roomName
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
    sendError(res, 500, "Failed to initiate call", {
      error: error.message,
      stack: error.stack,
    });
  }
};

const handleVoiceRequest = async (req, res) => {
  console.log("Raw request body:", req.body);
  console.log("Request headers:", req.headers);

  try {
    const twiml = new VoiceResponse();
    //getting the 'To' parameter from the request
    const to = req.body.To;
    const from = req.body.From;
    const callSid = req.body.CallSid;

    console.log("Processed parameters:", { to, from, callSid });

    if (to && to.startsWith("client:")) {
      //creating a Dial verb to connect to client
      const dial = twiml.dial({
        callerId: from,
        record: "record-from-answer",
      });
      dial.client(to.replace("client:", ""));
      console.log(`Connecting ${from} to ${to}`);
    } else {
      twiml.say("Invalid recipient specified");
    }

    //sending TwiMl res
    res.type("text/xml");
    res.send(twiml.toString());
  } catch (error) {
    console.error("Voice handler error:", error);
    //even on error, a valid TwiML response should be sent
    const twiml = new VoiceResponse();
    twiml.say("Service error");
    res.type("text/xml").res.send(twiml.toString());
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

export {
  generateTwilioToken,
  getCallToken,
  startCall,
  handleVoiceRequest,
  acceptCall,
  rejectCall,
  endCall,
};
