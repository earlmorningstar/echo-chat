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
import {
  callReducer,
  initialState,
  CallState,
  CallAction,
} from "./calls/CallStateManager";
import { RemoteParticipant, Room } from "twilio-video";
import { useMediaStreamManager } from "./calls/MediaStreamManager";
import { useTwilioRoomManager } from "./calls/TwilioRoomManager";
import { CallEvent, CallStatus, CallType } from "../types";
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
  initializeVoiceDevice: (
    token: string,
    callId: string,
    recipientId: string
  ) => TwilioVoice.Device;
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
  mediaControls: ReturnType<typeof useMediaStreamManager>;
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
  const currentCallUpdate: Partial<CallState["currentCall"]> = {};

  if (update.callId !== undefined) {
    currentCallUpdate.id = update.callId ?? null;
  }
  if (update.type !== undefined) {
    currentCallUpdate.type = update.type ?? null;
  }
  if (update.status !== undefined) {
    currentCallUpdate.status = update.status;
  }
  if (update.participants !== undefined) {
    currentCallUpdate.participants = update.participants ?? [];
  }

  const adaptedUpdate: Partial<CallState> = {};
  if (Object.keys(currentCallUpdate).length > 0) {
    adaptedUpdate.currentCall = currentCallUpdate as CallState["currentCall"];
  }

  return adaptedUpdate;
};

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(callReducer, initialState);
  const { user } = useAuth();
  const { sendMessage, eventManager, isConnected } = useWebSocket();
  const lastUpdate = useRef<CallStateUpdate | null>(null);
  const updateMedia = useCallback(
    (payload: Partial<{ audioEnabled: boolean; videoEnabled: boolean }>) => {
      dispatch({ type: "UPDATE_MEDIA", payload });
    },
    [dispatch]
  );
  const mediaControls = useMediaStreamManager(updateMedia);
  const { toggleAudio, toggleVideo } = mediaControls;
  const updateCallback = useCallback(
    (update: CallStateUpdate) => {
      if (isEqual(update, lastUpdate.current)) return;
      lastUpdate.current = update;
      dispatch({
        type: "UPDATE_CALL",
        payload: adaptCallStateUpdate(update),
      });
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
    useCallback(updateCallback, [updateCallback]),
    state.currentCall.recipientId || undefined
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

        dispatch({ type: "END_CALL" });
        await mediaControls.stopAllTracks();
        const {success, tracks} = await mediaControls.getMediaPermissions(CallType.VIDEO);
        if (!success) throw new Error("Permissions denied");

        //reseting twilio device
        if (callManager.voiceDevice) {
          callManager.voiceDevice.destroy();
        }

        if (callManager.videoDevice) {
          callManager.videoDevice.disconnect();
        }

        const response = await api.post("/api/call/start", {
          callerId: user._id,
          recipientId,
          callType: type,
        });

        const { call, token, roomName } = response.data;

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
          await connectToVideoRoom(token, roomName, call._id, tracks);
        } else if (type === CallType.VOICE) {
          const device = initializeVoiceDevice(token, call._id, recipientId);

          try {
            //waiting for device to be ready
            await new Promise((resolve, reject) => {
              if (device.state === "registered") {
                resolve("ready");
              } else {
                device.once("registered", () => resolve("ready"));
                device.once("error", (error) => reject(error));
                setTimeout(
                  () => reject(new Error("Device never became registered")),
                  30000
                );
              }
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
              dispatch({
                type: "UPDATE_CALL",
                payload: {
                  currentCall: {
                    id: call._id,
                    type: CallType.VOICE,
                    status: CallStatus.CONNECTED,
                    participants: [],
                    initiator: user._id,
                    recipientId: recipientId,
                    roomName: call.roomName,
                  },
                },
              });
            });
          } catch (error) {
            throw error;
          }
        }
      } catch (error) {
        console.error("Call failed");
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
      callManager,
      mediaControls,
    ]
  );

  const acceptCall = useCallback(
    async (callId: string) => {
      try {
        const response = await api.patch(`/api/call/${callId}/accept`, {
          userId: user?._id,
        });

        const { token, roomName, type } = response.data;

        //initializing media befoee accepting
        const {success, tracks} = await mediaControls.getMediaPermissions(CallType.VIDEO);
        if (!success) throw new Error("Permissions denied");

        dispatch({
          type: "ACCEPT_CALL",
          payload: { callId },
        });

        if (type === CallType.VIDEO) {
          //disconnecting any existing video device
          if (callManager.videoDevice) {
            callManager.videoDevice.disconnect();
          }
          await connectToVideoRoom(token, roomName, callId, tracks);
          dispatch({ type: "CLEAR_INCOMING_CALL" });
          } else if (type === CallType.VOICE) {
          dispatch({
            type: "UPDATE_CALL",
            payload: {
              currentCall: {
                id: callId,
                type,
                status: CallStatus.CONNECTED,
                participants: [],
                initiator: state.incomingCall.callerId!,
                recipientId: user?._id!,
                roomName: state.incomingCall.roomName!,
              },
            },
          });

          const connection = state.incomingCall
            .activeCall as TwilioVoice.Connection;
          if (connection) {
            connection.accept();
            // console.log("Call accepted by recipient");
          }
        }

        dispatch({ type: "CLEAR_INCOMING_CALL" });
      } catch (error) {
        console.error("Call acceptance failed");
        dispatch({ type: "SET_ERROR", payload: "Failed to accept call" });
      }
    },
    [
      user?._id,
      connectToVideoRoom,
      state.incomingCall,
      mediaControls,
      callManager,
    ]
  );

  const rejectCall = useCallback(
    async (callId: string) => {
      try {
        await api.patch(`/api/call/${callId}/reject`, { userId: user?._id });
        dispatch({ type: "CLEAR_INCOMING_CALL" });

        sendMessage({
          type: "call_reject",
          callId,
          rejectorId: user?._id,
          recipientId: state.incomingCall.callerId,
        });
      } catch (error) {
        dispatch({ type: "SET_ERROR", payload: "Failed to reject call" });
      }
    },
    [user?._id, sendMessage, state.incomingCall]
  );

  const endCall = useCallback(async () => {
    if (!state.currentCall.id) return;

    try {
      await api.patch(`/api/call/${state.currentCall.id}/end`, {
        userId: user?._id,
      });

      sendMessage({
        type: "call_end",
        callId: state.currentCall.id,
        endedBy: user?._id,
        recipientId: state.currentCall.recipientId,
      });

      dispatch({ type: "END_CALL" });
      disconnectCall();
    } catch (error) {
      console.error("Failed to end call");
      dispatch({ type: "SET_ERROR", payload: "Failed to end call" });
    }
  }, [state.currentCall, user?._id, sendMessage, disconnectCall]);

  const handleAudioToggle = useCallback(
    (enabled: boolean) => {
      toggleAudio(enabled);
    },
    [toggleAudio]
  );

  const handleVideoToggle = useCallback(
    (enabled: boolean) => {
      toggleVideo(enabled);
    },
    [toggleVideo]
  );

  const handleCallEvent = useCallback(
    async (message: any) => {
      // Universal ACK handling
      if (message.requireAck && message.id) {
        sendMessage({
          type: "ack",
          originalId: message.id,
          timestamp: Date.now(),
        });
      }

      try {
        switch (message.type) {
          case "call_initiate":
            if (state.incomingCall.callId === message.callId) return;
            if (message.callType === "video") {
              dispatch({
                type: "SHOW_INCOMING_CALL",
                payload: {
                  callId: message.callId,
                  callerId: message.callerId,
                  type: CallType.VIDEO,
                  token: message.token,
                  roomName: message.roomName,
                },
              });
              return; //skipping voice device initializtation for vvideo calls
            }

            //showing incoming call UI, even if another call exists
            dispatch({
              type: "SHOW_INCOMING_CALL",
              payload: {
                callId: message.callId,
                callerId: message.callerId,
                type: CallType.VOICE,
                token: message.token!,
                roomName: message.roomName,
              },
            });

            // Initialize device only if not already initialized
            if (!callManager.voiceDevice) {
              const device = initializeVoiceDevice(
                message.token!,
                message.callId,
                message.callerId
              );

              // Handle device registration status
              await new Promise((resolve, reject) => {
                const timeout = setTimeout(
                  () => reject(new Error("Device registration timeout")),
                  10000
                );

                device.once("registered", () => {
                  clearTimeout(timeout);
                  resolve(true);
                });

                device.once("error", (error) => {
                  clearTimeout(timeout);
                  reject(error);
                });
              });

              // Set up incoming call handler
              device.on("incoming", (connection) => {
                dispatch({
                  type: "UPDATE_INCOMING_CALL",
                  payload: {
                    activeCall: connection,
                    status: CallStatus.RINGING,
                  },
                });
              });
            }
            break;

          case "call_accept":
            if (state.currentCall.id === message.callId) {
              dispatch({
                type: "UPDATE_CALL",
                payload: {
                  currentCall: {
                    ...state.currentCall,
                    status: CallStatus.CONNECTED,
                    roomName: message.roomName,
                  },
                },
              });

              if (message.token && message.roomName) {
                await connectToVideoRoom(
                  message.token,
                  message.roomName,
                  message.callId,
                  message.tracks
                );
              }
            }
            break;

          case "call_reject":
            dispatch({
              type: "REJECT_CALL",
              payload: { callId: message.callId },
            });
            disconnectCall();
            if (callManager.videoDevice) {
              callManager.videoDevice.disconnect();
            }
            if (callManager.voiceDevice) {
              callManager.voiceDevice.destroy();
            }
            break;

          case "call_end":
            if (message.force) {
              disconnectCall();
            }
            dispatch({ type: "END_CALL" });
            break;

          default:
            break;
        }
      } catch (error) {
        console.error("Error handling call event");
        dispatch({
          type: "SET_ERROR",
          payload:
            error instanceof Error ? error.message : "Call processing failed",
        });

        if (message.type === "call_initiate") {
          sendMessage({
            type: "call_reject",
            callId: message.callId,
            rejectorId: user?._id,
          });
        }
      }
    },
    [
      callManager,
      initializeVoiceDevice,
      connectToVideoRoom,
      disconnectCall,
      sendMessage,
      user?._id,
      state.currentCall,
      dispatch,
      state.incomingCall,
    ]
  );

  useEffect(() => {
    return () => {
      if (callManager.voiceDevice) {
        callManager.voiceDevice.destroy();
      }
      if (callManager.videoDevice) {
        callManager.videoDevice.disconnect();
      }
    };
  }, [callManager]);

  useEffect(() => {
    const manager = eventManager.current;
    if (!manager || !isConnected) return;

    const handler = (msg: CallEvent) => {
      handleCallEvent(msg);
    };

    manager.on("call", handler);
    return () => {
      manager.off("call", handler);
    };
  }, [handleCallEvent, eventManager, isConnected, state.currentCall.id]);

  const value = useMemo(
    () => ({
      initiateCall,
      initializeVoiceDevice,
      acceptCall,
      rejectCall,
      endCall,
      mediaControls,
      toggleAudio: handleAudioToggle,
      toggleVideo: handleVideoToggle,
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
      initializeVoiceDevice,
      acceptCall,
      rejectCall,
      endCall,
      state,
      handleAudioToggle,
      handleVideoToggle,
      mediaControls,
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
