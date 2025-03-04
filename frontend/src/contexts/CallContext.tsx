import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
} from "react";
import { useWebSocket } from "./WebSocketContext";
import { useAuth } from "./AuthContext";
import api from "../utils/api";
import { callReducer, initialState, CallState } from "./calls/CallStateManager";
import { RemoteParticipant, Room } from "twilio-video";
import { useMediaStreamManager } from "./calls/MediaStreamManager";
import { useTwilioRoomManager } from "./calls/TwilioRoomManager";
import { CallType } from "../types";

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
};

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(callReducer, initialState);
  const { user } = useAuth();
  const { sendMessage, eventManager } = useWebSocket();
  const { localTracks, ...mediaControls } = useMediaStreamManager((payload) =>
    dispatch({ type: "UPDATE_MEDIA", payload })
  );
  // const { room, connectToRoom, disconnectFromRoom, participants } =
  //   useTwilioRoomManager(localTracks, (update: Partial<CallState>) =>
  //     dispatch({ type: "UPDATE_CALL", payload: update })
  //   );

  const { 
    connectToVideoRoom, 
    initializeVoiceDevice, 
    makeVoiceCall, 
    disconnectCall,
    callManager,
  } = useTwilioRoomManager(
    localTracks, 
    (update: Partial<CallState>) => dispatch({ type: "UPDATE_CALL", payload: update }),
  );

  const initiateCall = useCallback(
    async (recipientId: string, type: CallType) => {
      try {
        if (!user?._id) {
          throw new Error("User not authenticated");
        }

        const response = await api.post("/api/call/start", {
          callerId: user._id,
          recipientId,
          callType: type,
        });

        // const { callId, token, roomName } = response.data;
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
        });

        // await connectToRoom(token, call.roomName);
        // await connectToRoom(token, roomName);
        if(type === CallType.VIDEO){
          await connectToVideoRoom(token, roomName, call._id);
        } else if (type === CallType.VOICE) {
          initializeVoiceDevice(token, call._id);
          makeVoiceCall(recipientId, call._id);
        }
      } catch (error) {
        dispatch({
          type: "SET_ERROR",
          payload:
            error instanceof Error ? error.message : "Failed to initiate call",
        });
      }
    },
    [user?._id, sendMessage, connectToVideoRoom, initializeVoiceDevice, makeVoiceCall]
  );

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


        // await connectToRoom(response.data.token, response.data.roomName);

        if(type === CallType.VIDEO){
          await connectToVideoRoom(token, roomName, callId);
        } else if (type === CallType.VOICE){
          initializeVoiceDevice(token, callId);
          makeVoiceCall(user?._id, callId);
        }

      } catch (error) {
        dispatch({ type: "SET_ERROR", payload: "Failed to accept call" });
      }
    },
    [user?._id, connectToVideoRoom, initializeVoiceDevice, makeVoiceCall]
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

  useEffect(() => {
    if (!eventManager.current) return;

    const currentManager = eventManager.current;

    const handleCallEvent = (message: any) => {
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
                // recipientId: message.callerId,
              },
            });
          }
          break;

        case "call_accept":
          if (state.currentCall.id === message.callId) {
            dispatch({
              type: "ACCEPT_CALL",
              payload: { callId: message.callId },
            });

            //connecting to the twilio room with the token
            if (message.token && message.roomName) {
              connectToRoom(message.token, message.roomName);
            }

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
    };

    currentManager.on("call", handleCallEvent);

    return () => {
      currentManager.off("call", handleCallEvent);
    };
  }, [
    state.currentCall.id,
    state.incomingCall.callId,
    disconnectCall,
    connectToRoom,
    eventManager,
  ]);

  const value = {
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleAudio: mediaControls.toggleAudio,
    toggleVideo: mediaControls.toggleVideo,
    toggleScreenShare: mediaControls.toggleScreenShare,
    callState: state,
    participants: callManager.participants || [],
    room: callManager.videoDevice || callManager.voiceDevice, 
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) throw new Error("useCall must be used within CallProvider");
  return context;
};

// import React, {
//   createContext,
//   useContext,
//   useEffect,
//   useReducer,
//   useCallback,
//   useRef,
// } from "react";
// import { useAuth } from "./AuthContext";
// import { useWebSocket } from "./WebSocketContext";
// import { useQueryClient } from "@tanstack/react-query";
// import {
//   CallState,
//   CallEvent,
//   CallQuality,
//   CallType,
//   CallContextType,
//   Friend,
// } from "../types";
// import { LocalAudioTrack, LocalVideoTrack } from "twilio-video";
// import { TwilioRoomManager } from "./calls/TwilioRoomManager";
// import { MediaStreamManager } from "./calls/MediaStreamManager";
// import api from "../utils/api";

// type CallAction =
//   | { type: "SET_STATE"; payload: Partial<CallState> }
//   | { type: "SET_QUALITY"; payload: CallQuality }
//   | { type: "TOGGLE_AUDIO" }
//   | { type: "TOGGLE_VIDEO" }
//   | { type: "TOGGLE_SCREEN_SHARE"; payload: boolean }
//   | { type: "RESET" };

// const callReducer = (state: CallState, action: CallAction): CallState => {
//   switch (action.type) {
//     case "SET_STATE":
//       return { ...state, ...action.payload };
//     case "SET_QUALITY":
//       return { ...state, callQuality: action.payload };
//     case "TOGGLE_AUDIO":
//       return { ...state, localAudioEnabled: !state.localAudioEnabled };
//     case "TOGGLE_VIDEO":
//       return { ...state, localVideoEnabled: !state.localVideoEnabled };
//     case "TOGGLE_SCREEN_SHARE":
//       return { ...state, isScreenSharing: !state.isScreenSharing };
//     case "RESET":
//       return initialState;
//     default:
//       return state;
//   }
// };

// const initialState: CallState = {
//   isInCall: false,
//   callType: null,
//   callStatus: "idle",
//   remoteUser: null,
//   roomName: null,
//   localStream: null,
//   remoteStream: null,
//   localAudioEnabled: true,
//   localVideoEnabled: true,
//   isScreenSharing: false,
//   callQuality: null,
// };

// const CallContext = createContext<CallContextType | null>(null);

// interface CallProviderProps {
//   children: React.ReactNode;
// }

// export const CallProvider: React.FC<CallProviderProps> = ({ children }) => {
//   const [state, dispatch] = useReducer(callReducer, initialState);
//   const { user } = useAuth();
//   const { sendMessage, eventManager } = useWebSocket();
//   const roomManager = useRef<TwilioRoomManager | null>(null);
//   const mediaManager = useRef(new MediaStreamManager());
//   const queryClient = useQueryClient();
//   const updateState = useCallback((payload: Partial<CallState>) => {
//     dispatch({ type: "SET_STATE", payload });
//   }, []);

//   //initialize twilioRoomManager with state updater
//   useEffect(() => {
//     roomManager.current = new TwilioRoomManager(updateState);
//   }, [updateState]);

//   const endCall = useCallback(async () => {
//     if (!state.roomName) return;

//     try {
//       //updating call status on the backend
//       await api.post("/api/call/status", {
//         roomName: state.roomName,
//         status: "completed",
//         endTime: new Date().toISOString(),
//       });

//       const sendWithRetry = async (attempt = 0): Promise<void> => {
//         try {
//           sendMessage({
//             type: "call_ended",
//             data: {
//               receiverId: state.remoteUser?._id,
//               roomName: state.roomName,
//             },
//           });
//         } catch (error) {
//           if (attempt < 3) {
//             await new Promise((resolve) =>
//               setTimeout(resolve, 1000 * (attempt + 1))
//             );
//             return sendWithRetry(attempt + 1);
//           }
//           throw error;
//         }
//       };
//       await sendWithRetry();
//     } finally {
//       //cleaning up media and room without affecting ws
//       mediaManager.current.cleanupLocalStream();
//       mediaManager.current.cleanupRemoteStream();
//       roomManager.current?.handleDisconnect();
//       dispatch({ type: "RESET" });

//       queryClient.invalidateQueries({ queryKey: ["userStatus"] });
//     }
//   }, [state, sendMessage, queryClient]);

//   const initiateCall = useCallback(
//     async (friend: Friend, type: CallType) => {
//       try {
//         if (!user?._id) {
//           throw new Error("User not authenticated");
//         }
//         // getting room name first
//         const response = await api.post("/api/call/initiate", {
//           receiverId: friend._id,
//           type,
//         });

//         //getting token after room creation
//         const tokenResponse = await api.post("/api/call/token", {
//           roomName: response.data.roomName,
//         });

//         //setting up media after token acquisition
//         // const localStream = await mediaManager.current.setupLocalStream(type);

//         //connecting to room before sending WS message
//         if (roomManager.current) {
//           //getting media tracks first
//           const tracks = await roomManager.current.getMediaTracks(type);

//           //creating a local stream from the audio and video tracks
//           const trackElements = tracks.filter(
//             (track) => track.kind === "audio" || track.kind === "video"
//           );

//           const localStream = new MediaStream(
//             trackElements.map((track) => {
//               if (track.kind === "audio" || track.kind === "video") {
//                 return (track as LocalAudioTrack | LocalVideoTrack)
//                   .mediaStreamTrack;
//               }
//               throw new Error("Unexpected track type");
//             })
//           );

//           //connecting toroom with token
//           await roomManager.current.connectToRoom(
//             response.data.roomName,
//             tokenResponse.data.token,
//             type
//           );

//           //sending initiation message after successful connection
//           sendMessage({
//             type: "call_initiate",
//             data: {
//               receiverId: friend._id,
//               roomName: response.data.roomName,
//               callType: type,
//               senderId: user?._id,
//             },
//           });

//           //updating state with call info
//           updateState({
//             localStream,
//             callStatus: "outgoing",
//             callType: type,
//             remoteUser: friend,
//             roomName: response.data.roomName,
//             isInCall: true,
//           });
//         }
//       } catch (error) {
//         console.error("Call initiation failed:", error);
//         endCall();
//       }
//     },
//     [sendMessage, updateState, endCall, user?._id]
//   );

//   const acceptCall = useCallback(async () => {
//     if (!roomManager.current || !state.roomName || !state.remoteUser) return;

//     try {
//       updateState({ callStatus: "connecting" });

//       const tokenResponse = await api.post("/api/call/token", {
//         roomName: state.roomName,
//       });

//       // const localStream = await mediaManager.current.setupLocalStream(
//       //   state.callType || "video"
//       // );

//       if (roomManager.current) {
//         //connecting to the room with the token and call type
//         await roomManager.current.connectToRoom(
//           state.roomName,
//           tokenResponse.data.token,
//           state.callType || "video"
//         );

//         //getting local stream from room managre
//         const localStream = roomManager.current.getLocalStream();

//         updateState({
//           localStream,
//           callStatus: "connected",
//           isInCall: true,
//         });

//         sendMessage({
//           type: "call_accept",
//           data: {
//             receiverId: state.remoteUser?._id,
//             roomName: state.roomName,
//           },
//         });
//       }
//     } catch (error) {
//       console.error("Call acceptance failed:", error);
//       endCall();
//     }
//   }, [state, sendMessage, updateState, endCall]);

//   const rejectCall = useCallback(async () => {
//     if (!state.roomName || !state.remoteUser) return;

//     sendMessage({
//       type: "call_reject",
//       data: {
//         receiverId: state.remoteUser._id,
//         roomName: state.roomName,
//       },
//     });

//     await api.post("/api/call/status", {
//       roomName: state.roomName,
//       status: "rejected",
//     });

//     endCall();
//   }, [state, sendMessage, endCall]);

//   const toggleAudio = useCallback(() => {
//     roomManager.current?.toggleAudio();
//     dispatch({ type: "TOGGLE_AUDIO" });
//   }, []);

//   const toggleVideo = useCallback(() => {
//     roomManager.current?.toggleVideo();
//     dispatch({ type: "TOGGLE_VIDEO" });
//   }, []);

//   const toggleScreenShare = useCallback(async () => {
//     if (!roomManager.current) return;
//     const isSharing = !state.isScreenSharing;
//     await roomManager.current.toggleScreenShare(isSharing);
//     updateState({ isScreenSharing: isSharing });
//   }, [state.isScreenSharing, updateState]);

//   //handling ws messages
//   useEffect(() => {
//     const currentEventManager = eventManager.current;

//     const handleCallEvent = (event: CallEvent) => {
//       switch (event.type) {
//         case "incoming":
//           //immediate state update
//           dispatch({
//             type: "SET_STATE",
//             payload: {
//               callStatus: "incoming",
//               callType: event.data.type,
//               roomName: event.data.roomName,
//               isInCall: true,
//             },
//           });

//           // Fetching caller details in background
//           api
//             .get(`/api/user/${event.data.initiatorId}`)
//             .then((res) => {
//               dispatch({
//                 type: "SET_STATE",
//                 payload: { remoteUser: res.data.user },
//               });
//             })
//             .catch((error) => {
//               console.error("Failed to fetch caller:", error);
//               endCall();
//             });
//           break;

//         case "accepted":
//           acceptCall();
//           break;

//         case "ended":
//           endCall();
//           break;
//         case "rejected":
//           rejectCall();
//           break;
//       }
//     };

//     // eventManager?.current?.on("message", handleCallEvent);
//     // return () => {
//     //   eventManager?.current?.off("message", handleCallEvent);
//     // };
//     if (currentEventManager) {
//       currentEventManager.on("message", handleCallEvent);
//     }

//     return () => {
//       if (currentEventManager) {
//         currentEventManager.off("message", handleCallEvent);
//       }
//     };
//   }, [acceptCall, rejectCall, endCall, eventManager]);

//   useEffect(() => {
//     if (state.callStatus === "ended") {
//       sendMessage({
//         type: "status",
//         senderId: user?._id,
//         status: "online",
//         timestamp: Date.now(),
//       });
//     }
//   }, [state.callStatus, sendMessage, user?._id]);

//   const value: CallContextType = {
//     callState: state,
//     initiateCall,
//     acceptCall,
//     rejectCall,
//     endCall,
//     toggleAudio,
//     toggleVideo,
//     toggleScreenShare,
//     callQuality: state.callQuality,
//     isScreenSharing: state.isScreenSharing,
//   };

//   return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
// };

// export const useCall = () => {
//   const context = useContext(CallContext);
//   if (!context) {
//     throw new Error("useCall must be used within a CallProvider");
//   }
//   return context;
// };
