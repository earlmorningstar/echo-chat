import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useWebSocket } from "./WebSocketContext";
import { useAuth } from "./AuthContext";
import api from "../utils/api";
import { callReducer, initialState, CallState } from "./calls/CallStateManager";
import { RemoteParticipant, Room } from "twilio-video";
import { useMediaStreamManager } from "./calls/MediaStreamManager";
import { useTwilioRoomManager } from "./calls/TwilioRoomManager";
import { CallStatus, CallType } from "../types";
import { CallAction } from "./calls/CallStateManager";
import isEqual from "lodash.isequal";

import type { ActiveCall, TwilioVideo, TwilioVoice } from "../types/calls";

interface CallStateUpdate {
  callId?: string;
  type?: CallType;
  status?: CallStatus;
  participants?: string[];
  activeCall?: ActiveCall;
}

type CallContextType = {
  initiateCall: (recipientId: string, type: CallType) => Promise<void>;
  acceptCall: (callId: string) => Promise<void>;
  rejectCall: (callId: string) => Promise<void>;
  endCall: () => Promise<void>;
  toggleAudio: (enabled: boolean) => void;
  toggleVideo: (enabled: boolean) => void;
  toggleScreenShare: (enabled: boolean) => Promise<void>;
  callState: CallState;
  participants: RemoteParticipant[];
  room: Room | null;
  callManager: {
    videoDevice?: TwilioVideo.Room;
    voiceDevice?: TwilioVoice.Device;
  };
  dispatch: React.Dispatch<CallAction>;
};

const CallContext = createContext<CallContextType | undefined>(undefined);

const adaptCallStateUpdate = (
  update: Partial<{
    callId?: string;
    type?: CallType;
    status?: CallStatus;
    participants?: string[];
    activeCall?: ActiveCall;
  }>
): Partial<CallState> => {
  const adaptedUpdate: Partial<CallState> = {};

  if (update.callId) {
    adaptedUpdate.currentCall = {
      ...initialState.currentCall,
      id: update.callId,
    };
  }
  if (update.type) {
    adaptedUpdate.currentCall = {
      ...initialState.currentCall,
      type: update.type,
    };
  }
  if (update.status) {
    adaptedUpdate.currentCall = {
      ...initialState.currentCall,
      status: update.status,
    };
  }

  if (update.participants) {
    adaptedUpdate.currentCall = {
      ...initialState.currentCall,
      participants: update.participants,
    };
  }
  return adaptedUpdate;
};

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(callReducer, initialState);
  const { user } = useAuth();
  const { sendMessage, eventManager } = useWebSocket();
  const lastUpdate = useRef<CallStateUpdate | null>(null);

  const mediaControls = useMediaStreamManager((payload) =>
    dispatch({ type: "UPDATE_MEDIA", payload })
  );
  const updateCallback = useCallback(
    (update: CallStateUpdate) => {
      if (isEqual(update, lastUpdate.current)) return;
      lastUpdate.current = update;
      dispatch({ type: "UPDATE_CALL", payload: adaptCallStateUpdate(update) });
    },
    [dispatch]
  );

  const {
    connectToVideoRoom,
    initializeVoiceDevice,
    makeVoiceCall,
    disconnectCall,
    callManager,
  } = useTwilioRoomManager(
    mediaControls.localTracks,
    useCallback(updateCallback, [updateCallback])
  );

  const callManagerRef = useRef({
    videoDevice: callManager.videoDevice,
    voiceDevice: callManager.voiceDevice,
  });

  const initiateCall = useCallback(
    async (recipientId: string, type: CallType) => {
      let call: any = null;

      try {
        if (!user?._id) {
          throw new Error("User not authenticated");
        }

        console.log("Initiating call to:", recipientId);

        const response = await api.post("/api/call/start", {
          callerId: user._id,
          recipientId,
          callType: type,
        });

        const { call, token, roomName } = response.data;
        console.log("Call initiation response:", response.data);

        dispatch({
          type: "INITIATE_CALL",
          payload: {
            callId: call._id,
            type,
            recipientId,
            initiator: user._id,
          },
        });

        sendMessage({
          type: "call_initiate",
          callId: call._id,
          callerId: user._id,
          recipientId,
          callType: type,
          roomName,
          token,
          requireAck: true,
        });

        if (type === CallType.VIDEO) {
          await connectToVideoRoom(token, roomName, call._id);
        } else if (type === CallType.VOICE) {
          console.log("Initializing voice device with token");
          const device = initializeVoiceDevice(token, call._id);

          await new Promise((resolve, reject) => {
            device.once("ready", () => resolve("ready"));
            device.once("error", (error) => reject(error));

            setTimeout(
              () => reject(new Error("Device never became ready")),
              30000
            );
          });

          console.log("Twilio device ready - making call");
          console.log("Making voice call with params:", {
            To: `client:${recipientId}`,
            From: `client:${user._id}`,
            CallSid: call._id,
          });

          //after device is ready, makee the call
          const voiceCall = await makeVoiceCall(
            recipientId,
            call._id,
            user?._id
          );

          if (!voiceCall) {
            throw new Error("Voice connection failed");
          }

          voiceCall.on("accept", () => {
            console.log("Call accepted by recipient");
            dispatch({
              type: "UPDATE_CALL",
              payload: {
                currentCall: {
                  id: call._id,
                  type: CallType.VOICE,
                  status: CallStatus.CONNECTED,
                  participants: [],
                  initiator: user._id,
                  roomName: call.roomName,
                },
              },
            });
          });
        }
      } catch (error) {
        console.error("Call failed:", error);
        //cleanup on any error
        if (call?._id) {
          await api.patch(`/api/call/${call._id}/end`, {
            userId: user?._id || "unknown",
          });
        }

        dispatch({
          type: "SET_ERROR",
          payload: error instanceof Error ? error.message : "Call Failed",
        });
      }
    },
    [
      user?._id,
      sendMessage,
      connectToVideoRoom,
      initializeVoiceDevice,
      makeVoiceCall,
    ]
  );

  useEffect(() => {
    return () => {
      if (callManager.voiceDevice) {
        callManager.voiceDevice.destroy();
      }
    };
  }, [callManager.voiceDevice]);

  const acceptCall = useCallback(
    async (callId: string) => {
      try {
        await api.patch(`/api/call/${callId}/accept`, { userId: user?._id });
        const response = await api.get(`/api/call/${callId}/token`);

        const { token, roomName, type } = response.data;

        dispatch({
          type: "ACCEPT_CALL",
          payload: { callId },
        });

        if (type === CallType.VIDEO) {
          await connectToVideoRoom(token, roomName, callId);
        } else if (type === CallType.VOICE) {
          initializeVoiceDevice(token, callId);
          makeVoiceCall(state.incomingCall.callerId!, callId, user?._id || "");
        }
      } catch (error) {
        dispatch({ type: "SET_ERROR", payload: "Failed to accept call" });
      }
    },
    [
      user?._id,
      connectToVideoRoom,
      initializeVoiceDevice,
      makeVoiceCall,
      state.incomingCall.callerId,
    ]
  );

  const rejectCall = useCallback(
    async (callId: string) => {
      try {
        await api.patch(`/api/call/${callId}/reject`, { userId: user?._id });
        dispatch({ type: "REJECT_CALL", payload: { callId } });
        disconnectCall();
      } catch (error) {
        dispatch({ type: "SET_ERROR", payload: "Failed to reject call" });
      }
    },
    [user?._id, disconnectCall]
  );

  const endCall = useCallback(async () => {
    if (!state.currentCall.id) return;

    try {
      await api.patch(`/api/call/${state.currentCall.id}/end`, {
        userId: user?._id,
      });
      dispatch({ type: "END_CALL" });
      disconnectCall();
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: "Failed to end call" });
    }
  }, [state.currentCall.id, user?._id, disconnectCall]);

  const handleCallEvent = useCallback(
    async (message: any) => {
      console.log("Call event received:", message);

      switch (message.type) {
        case "call_initiate":
          console.log("Processing call_initiate:", message);
          if (!state.currentCall.id) {
            dispatch({
              type: "SHOW_INCOMING_CALL",
              payload: {
                callId: message.callId,
                callerId: message.callerId,
                type: message.callType,
                token: message.token,
              },
            });

            initializeVoiceDevice(message.token, message.callId);
          }
          break;

        case "call_accept":
          if (state.currentCall.id === message.callId) {
            dispatch({
              type: "ACCEPT_CALL",
              payload: { callId: message.callId },
            });
            dispatch({ type: "CLEAR_INCOMING_CALL" });
          }
          break;

        case "call_reject":
          dispatch({ type: "CLEAR_INCOMING_CALL" });
          if (state.currentCall.id === message.callId) {
            dispatch({
              type: "REJECT_CALL",
              payload: { callId: message.callId },
            });
            disconnectCall();
          }
          break;

        case "call_end":
          if (state.currentCall.id === message.callId) {
            dispatch({ type: "END_CALL" });
            disconnectCall();
          }
          break;

        default:
          break;
      }
    },
    [state.currentCall.id, disconnectCall, initializeVoiceDevice]
  );

  useEffect(() => {
    const manager = eventManager.current;
    if (!manager) return;

    const handler = (msg: any) => {
      if (msg.type === "call_initiate" && state.incomingCall.callId) return;
      handleCallEvent(msg);
    };

    manager.on("call", handler);
    return () => {
      manager.off("call", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.incomingCall.callId]);

  const value = useMemo(
    () => ({
      initiateCall,
      acceptCall,
      rejectCall,
      endCall,
      toggleAudio: mediaControls.toggleAudio,
      toggleVideo: mediaControls.toggleVideo,
      toggleScreenShare: mediaControls.toggleScreenShare,
      callState: state,
      participants: callManager.videoDevice
        ? Array.from(callManager.videoDevice.participants.values())
        : [],
      room: callManagerRef.current.videoDevice || null,
      callManager: {
        videoDevice: callManager.videoDevice,
        voiceDevice: callManager.voiceDevice,
      },
      dispatch,
    }),
    [
      initiateCall,
      acceptCall,
      rejectCall,
      endCall,
      state,
      mediaControls.toggleAudio,
      mediaControls.toggleVideo,
      mediaControls.toggleScreenShare,
      callManager.videoDevice,
      callManager.voiceDevice,
    ]
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) throw new Error("useCall must be used within CallProvider");
  return context;
};