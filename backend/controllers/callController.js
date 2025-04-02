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

  const token = new AccessToken(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_API_KEY,
    process.env.TWILIO_API_SECRET,
    { identity, ttl: 3600 }
  );

  //adding grants based on call type
  if (callType === CallType.VOICE) {
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: process.env.TWILIO_APP_SID,
      incomingAllow: true,
      enableRingingState: true,
      enableEarlyMedia: true,
    });
    token.addGrant(voiceGrant);
  } else if (callType === CallType.VIDEO) {
    const videoGrant = new VideoGrant({
      room: roomName,
      maxParticipants: 2,
      maxParticipantDuration: 14000,
    });
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

const createTwilioVideoRoom = async (roomName) => {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    throw new Error("Twilio credentials are missing in .env file");
  }

  const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  try {
    const room = await twilioClient.video.v1.rooms.create({
      uniqueName: roomName,
      type: "group",
      maxParticipants: 2,
      statusCallback: `${process.env.BASE_URL}/api/call/video-status`,
      statusCallbackMethod: "POST",
    });

    return room;
  } catch (error) {
    console.error("Error creating Twilio video room");
    throw error;
  }
};

const startCall = async (req, res) => {
  const { callerId, recipientId, callType } = req.body;

  try {
    if (!ObjectId.isValid(callerId)) {
      return sendError(res, 400, "Invalid caller ID format");
    }

    if (!ObjectId.isValid(recipientId)) {
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

    if (!areFriends) {
      return sendError(res, 403, "You can only call your friends");
    }

    const recentCallWindow = new Date(Date.now() - 60000);

    const existingCall = await req.db.collection("calls").findOne({
      $or: [
        {
          caller: callerId,
          recipient: recipientId,
          type: callType,
          status: { $in: [CallStatus.INITIATED, CallStatus.RINGING] },
          createdAt: { $gt: recentCallWindow },
        },
        {
          caller: recipientId,
          recipient: callerId,
          type: callType,
          status: { $in: [CallStatus.INITIATED, CallStatus.RINGING] },
          createdAt: { $gt: recentCallWindow },
        },
      ],
    });

    if (existingCall) {
      return sendError(res, 409, "An active call already exists", {
        existingCallId: existingCall._id.toString(),
      });
    }

    //cleaning up of previous calls
    await req.db.collection("calls").updateMany(
      {
        $or: [
          {
            caller: callerId,
            status: { $in: [CallStatus.INITIATED, CallStatus.RINGING] },
            createdAt: { $lt: recentCallWindow },
          },
          {
            recipient: callerId,
            status: { $in: [CallStatus.INITIATED, CallStatus.RINGING] },
            createdAt: { $lt: recentCallWindow },
          },
        ],
      },
      { $set: { status: CallStatus.FAILED, endTime: new Date() } }
    );

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
          ? `video-${callerId}-${recipientId}-${Date.now()}`
          : `voice-${callerId}-${recipientId}-${Date.now()}`,
      twilioCallSid: null,
    };

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

    if (callType === CallType.VIDEO) {
      try {
        const twilioRoom = await createTwilioVideoRoom(newCall.roomName);
        newCall.twilioCallSid = twilioRoom.sid;
      } catch (error) {
        throw new Error(`Video room creation failed: ${error.message}`);
      }
    }

    //generating twilio access token for frontend
    const accessToken = await generateTwilioToken(
      callerId,
      callType,
      insertedCall.roomName
    );

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
    console.error("Call initiation error");

    if (error.message.includes("Invalid call type")) {
      return sendError(res, 400, error.message);
    }
    sendError(res, 500, "Call initiation failed");
  }
};

const handleVoiceRequest = async (req, res) => {
  try {
    const twiml = new VoiceResponse();
    //getting the 'To' parameter from the request and ensuring it has the client: prefix
    const to = req.body.To.replace(/^client:/, "");
    const from = req.body.From.replace(/^client:/, "");

    if (to) {
      //creating a Dial verb to connect to client
      const dial = twiml.dial({
        answerOnBridge: true,
        callerId: `client:${from}`,
        record: "do-not-record",
        timeout: 30,
        action: `/api/call/voice-status`,
        method: "POST",
      });
      const clientDial = dial.client(`client:${to}`);

      clientDial.parameter({
        name: "CallSid",
        value: "${call_sid}",
      });
    } else {
      twiml.say("Invalid recipient specified");
    }

    //sending TwiMl res
    res.type("text/xml");
    res.send(twiml.toString());
  } catch (error) {
    console.error("Voice handler error");
    //even on error, a valid TwiML response should be sent
    const twiml = new VoiceResponse();
    twiml.say("Service error");
    res.type("text/xml");
    res.send(twiml.toString());
  }
};

const handleTwilioCallStatus = async (req, res) => {
  try {
    const { CallStatus, CallSid, From, To, RecordingUrl } = req.body;
    const twiml = new VoiceResponse();

    const call = await req.db.collection("calls").findOne({
      $or: [
        { roomName: `voice-${From}-${To}` },
        { roomName: `voice-${To}-${From}` },
        { roomName: `video-${From}-${To}` },
        { roomName: `video-${To}-${From}` },
      ],
    });

    if (!call) {
      return res.status(200).type("text/xml").send(twiml.toString());
    }

    let newStatus;
    switch (CallStatus) {
      case "completed":
        newStatus = CallStatus.COMPLETED;
        twiml.say("Call completed");
        break;
      case "failed":
        newStatus = CallStatus.FAILED;
        twiml.say("Call failed");
        break;
      case "no-answer":
        newStatus = CallStatus.MISSED;
        twiml.say("No answer");
        break;
      case "busy":
        newStatus = CallStatus.MISSED;
        twiml.say("Line busy");
        break;
      case "canceled":
        newStatus = CallStatus.REJECTED;
        twiml.say("Call canceled");
        break;
      case "in-progress":
        newStatus = CallStatus.CONNECTED;
        twiml.say("Call in progress");
        break;
      case "ringing":
        newStatus = CallStatus.RINGING;
        twiml.say("Call ringing");
        break;
      default:
        return res.status(200).type("text/xml").send(twiml.toString());
    }

    //updating call document
    await req.db.collection("calls").updateOne(
      { _id: call._id },
      {
        $set: {
          status: newStatus,
          updatedAt: new Date(),
          twilioCallSid: CallSid,
          recordingUrl: RecordingUrl || null,
        },
      }
    );

    res.status(200).type("text/xml").send(twiml.toString());
  } catch (error) {
    console.error("Error processing Twilio call status");
    const twiml = new VoiceResponse();
    twiml.say("Service error");
    res.status(500).type("text/xml").send(twiml.toString());
  }
};

const handleVideoStatus = async (req, res) => {
  try {
    const {
      RoomSid,
      RoomName,
      RoomStatus,
      ParticipantIdentity,
      ParticipantStatus,
      ParticipantDuration,
    } = req.body;

    const call = await req.db.collection("calls").findOne({
      $or: [{ roomName: RoomName }, { twilioRoomSid: RoomSid }],
    });

    if (!call) {
      // console.warn(`No call found for Twilio video room: ${RoomName}`);
      return res.status(200).send("OK");
    }

    //updating call status based on room status
    let newStatus;
    if (RoomStatus === "completed") {
      newStatus = CallStatus.COMPLETED;
    } else if (
      RoomStatus === "in-progress" &&
      call.status !== CallStatus.CONNECTED
    ) {
      newStatus = CallStatus.CONNECTED;
    } else if (RoomStatus === "failed") {
      newStatus = CallStatus.FAILED;
    }

    if (newStatus) {
      await req.db.collection("calls").updateOne(
        { _id: call._id },
        {
          $set: {
            status: newStatus,
            updateAt: new Date(),
            ...(newStatus === CallStatus.COMPLETED
              ? { endTime: new Date() }
              : {}),
          },
        }
      );
    }

    if (ParticipantIdentity && ParticipantStatus) {
      if (ParticipantStatus === "connected") {
        await req.db.collection("calls").updateOne(
          { _id: call._id },
          {
            $addToSet: { participants: ParticipantIdentity },
            $set: { updateAt: new Date() },
          }
        );
      }
    }
    res.status(200).send("OK");
  } catch (error) {
    console.error("Error processing Twilio video status");
    res.status(500).send("Error");
  }
};

const closeTwilioVideoRoom = async (roomSid) => {
  if (!roomSid) return;

  try {
    const twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    await twilioClient.video.v1.rooms(roomSid).update({ status: "completed" });
    console.log(`Closed Twilio video room: ${roomSid}`);
  } catch (error) {
    console.error(`Error closing Twilio video room ${roomSid}`);
  }
};

const restartVideoCall = async (req, res) => {
  const { callId } = req.params;
  const { userId } = req.body;

  try {
    if (!ObjectId.isValid(callId) || !ObjectId.isValid(userId)) {
      return sendError(res, 400, "Invalid ID format");
    }

    const call = await req.db.collection("calls").findOne({
      _id: new ObjectId(callId),
      $or: [{ caller: userId }, { recipient: userId }],
      type: CallType.VIDEO,
    });

    if (!call) {
      return sendError(res, 404, "Video call not found");
    }

    //closing old rooms if they exists
    if (call.twilioRoomSid) {
      await closeTwilioVideoRoom(call.twilioRoomSid);
    }

    //creating new room with the same name
    const twilioRoom = await createTwilioVideoRoom(call.roomName);

    //updating call doc
    await req.db.collection("calls").updateOne(
      { _id: new ObjectId(callId) },
      {
        $set: {
          twilioRoomSid: twilioRoom.sid,
          status: CallStatus.INITIATED,
          updateAt: new Date(),
          restartedAt: new Date(),
          restartredBy: userId,
        },
      }
    );

    //generating new tokem
    const token = await generateTwilioToken(
      userId,
      CallType.VIDEO,
      call.roomName
    );

    sendSuccess(res, 200, "Video call restarted", {
      token,
      roomName: call.roomName,
      twilioRoomSid: twilioRoom.sid,
    });
  } catch (error) {
    console.error("Error restarting video call");
    sendError(res, 500, "Failed to restart video call");
  }
};

const acceptCall = async (req, res) => {
  const { callId } = req.params;
  const { userId } = req.body;

  try {
    if (!ObjectId.isValid(callId) || !ObjectId.isValid(userId)) {
      return sendError(res, 400, "Invalid ID format");
    }

    const call = await req.db.collection("calls").findOne({
      _id: new ObjectId(callId),
      recipient: userId,
      status: { $in: [CallStatus.INITIATED, CallStatus.RINGING] },
    });

    if (!call) return sendError(res, 404, "Call not found");

    const token = await generateTwilioToken(userId, call.type, call.roomName);

    const updateResult = await req.db.collection("calls").updateOne(
      { _id: new ObjectId(callId) },
      {
        $set: {
          status: CallStatus.CONNECTED,
          acceptTime: new Date(),
          updateAt: new Date(),
        },
      }
    );

    if (updateResult.modifiedCount === 0) {
      console.warn(`Failed to update call ${callId} status to CONNECTED`);
      return sendError(res, 500, "Failed to update call status");
    }

    sendSuccess(
      res,
      200,
      "Call accapted",
      {
        token,
        roomName: call.roomName,
        type: call.type,
        callId: call._id.toString(),
      },
      false
    );
  } catch (error) {
    console.error("Error accepting call");
    sendError(res, 500, "Error accepting call");
  }
};

const rejectCall = async (req, res) => {
  const { callId } = req.params;
  const { userId } = req.body;

  try {
    if (!ObjectId.isValid(callId) || !ObjectId.isValid(userId)) {
      return sendError(res, 400, "Invalid ID format");
    }

    const call = await req.db.collection("calls").findOne({
      _id: new ObjectId(callId),
      recipient: userId,
      status: { $in: [CallStatus.INITIATED, CallStatus.RINGING] },
    });

    if (!call) {
      return sendError(res, 404, "Call not found");
    }

    const updateResult = await req.db.collection("calls").updateOne(
      { _id: new ObjectId(callId) },
      {
        $set: {
          status: CallStatus.REJECTED,
          endTime: new Date(),
          updateAt: new Date(),
        },
      }
    );

    if (updateResult.modifiedCount === 0) {
      console.warn(`Failed to update call ${callId} status to REJECTED`);
      return sendError(res, 500, "Failed to update call status");
    }

    sendSuccess(
      res,
      200,
      "Call rejected",
      { callId: call._id.toString(), status: CallStatus.REJECTED },
      false
    );
  } catch (error) {
    console.error("Error rejecting call:", error);
    sendError(res, 500, "Error rejecting call", {
      errorMessage: error.message,
      errorStack: error.stack,
    });
  }
};

const endCall = async (req, res) => {
  const { callId } = req.params;
  const { userId } = req.body;

  try {
    if (!ObjectId.isValid(callId) || !ObjectId.isValid(userId)) {
      return sendError(res, 400, "Invalid ID format");
    }

    const call = await req.db.collection("calls").findOne({
      _id: new ObjectId(callId),
      $or: [{ caller: userId }, { recipient: userId }],
      status: {
        $in: [CallStatus.INITIATED, CallStatus.RINGING, CallStatus.CONNECTED],
      },
    });

    if (!call) {
      return sendError(res, 404, "Call not found or already ended");
    }

    const endedBy = userId === call.caller ? "caller" : "recipient";

    const updateResult = await req.db.collection("calls").updateOne(
      { _id: new ObjectId(callId) },
      {
        $set: {
          status: CallStatus.COMPLETED,
          endTime: new Date(),
          updateAt: new Date(),
          endedBy: endedBy,
        },
      }
    );

    if (updateResult.modifiedCount === 0) {
      console.warn(`Failed to update call ${callId} status to COMPLETED`);
      return sendError(res, 500, "Failed to update call status");
    }

    if (call.type === CallType && call.twilioRoomSid) {
      await closeTwilioVideoRoom(call.twilioRoomSid);
    }

    sendSuccess(
      res,
      200,
      "Call ended",
      { callId: call._id.toString(), status: CallStatus.COMPLETED, endedBy },
      false
    );
  } catch (error) {
    console.error("Error ending call:", error);
    sendError(res, 500, "Error ending call", {
      errorMessage: error.message,
      errorStack: error.stack,
    });
  }
};

export {
  generateTwilioToken,
  getCallToken,
  startCall,
  handleVoiceRequest,
  handleTwilioCallStatus,
  handleVideoStatus,
  acceptCall,
  rejectCall,
  endCall,
  restartVideoCall,
};
