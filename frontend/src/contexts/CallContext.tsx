import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useMemo,
} from "react";
import { useWebSocket } from "./WebSocketContext";
import { useQueryClient } from "@tanstack/react-query";
import {
  CallContextType,
  CallState,
  Friend,
  CallType,
  CallEvent,
} from "../types";
import { useAuth } from "./AuthContext";
import { CallStateManager } from "./calls/CallStateManager";
import { MediaStreamManager } from "./calls/MediaStreamManager";
import { TwilioRoomManager } from "./calls/TwilioRoomManager";
import { CallEventHandler } from "./calls/CallEventHandler";
import api from "../utils/api";

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const { sendMessage } = useWebSocket();
  const queryClient = useQueryClient();
  const [callState, setCallState] = useState<CallState>({
    isInCall: false,
    callType: null,
    callStatus: "idle",
    remoteUser: null,
    roomName: null,
    localStream: null,
    remoteStream: null,
  });
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callQuality, setCallQuality] = useState(null);

  const stateManager = useMemo(() => new CallStateManager(), []);
  const mediaManager = useMemo(() => new MediaStreamManager(), []);
  const roomManager = useMemo(() => new TwilioRoomManager(), []);
  const eventHandler = useMemo(
    () =>
      new CallEventHandler(
        stateManager,
        mediaManager,
        roomManager,
        sendMessage
      ),
    [stateManager, mediaManager, roomManager, sendMessage]
  );

  useEffect(() => {
    const unsubscribe = stateManager.subscribe(setCallState);
    return () => unsubscribe();
  }, [stateManager]);

  const handleCallEvent = useCallback(
    async (event: CallEvent) => {
      try {
        switch (event.type) {
          case "incoming":
            await eventHandler.handleIncomingCall(event);
            break;
          case "accepted":
            await eventHandler.handleCallAccepted(event);
            break;
          case "rejected":
            await eventHandler.handleCallRejected();
            break;
          case "ended":
            await eventHandler.handleCallEnded();
            break;
        }
      } catch (error) {
        console.error("Error handling call event:", error);
        await eventHandler.handleCallEnded();
      }
    },
    [eventHandler]
  );

  useEffect(() => {
    const subscription = queryClient.getQueryCache().subscribe(() => {
      const callEvent = queryClient.getQueryData<CallEvent>(["callEvent"]);
      if (callEvent) {
        handleCallEvent(callEvent);
      }
    });
    return () => subscription();
  }, [queryClient, handleCallEvent]);

  const initiateCall = async (friend: Friend, type: CallType) => {
    try {
      if (!user?._id) {
        throw new Error("User not authenticated");
      }
      // setup local media stream
      const localStream = await mediaManager.setupLocalStream(type);
      // requesting room name from server
      const response = await api.post("/api/call/initiate", {
        receiverId: friend._id,
        type,
      });

      if (!response.data?.roomName) {
        throw new Error("Invalid server response");
      }

      // Send WebSocket message
    await sendMessage({
        type: "call_initiate",
        data: {
          receiverId: friend._id,
          callType: type,
          roomName: response.data.roomName,
          senderId: user?._id,
        },
        requireAck: true,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      });

      // updating call state
      await stateManager.transition({
        isInCall: true,
        callType: type,
        callStatus: "outgoing",
        remoteUser: friend,
        roomName: response.data.roomName,
        localStream,
      });
    } catch (error) {
      console.error("Error initiating call:", error);
      await eventHandler.handleCallEnded();
    }
  };

  const acceptCall = async () => {
    try {
      const currentState = stateManager.getState();

      if (
        !currentState.roomName ||
        !currentState.callType ||
        !currentState.remoteUser?._id
      ) {
        throw new Error("Invalid call state for acceptance");
      }

      // first transitioning to connecting state
      await stateManager.transition({
        callStatus: "connecting",
        isInCall: true,
      });

      //...after which media stream is being setup
      const localStream = await mediaManager.setupLocalStream(
        currentState.callType
      );

      //connecting to twlio room
      try {
        await roomManager.connectToRoom(
          currentState.roomName,
          localStream.getTracks()
        );
      } catch (error) {
        console.error("Failed to connect to Twilio room:", error);
        throw error;
      }

      //updating state after successful connection
      await stateManager.transition({
        callStatus: "connected",
        localStream,
      });

      try {
        sendMessage({
          type: "call_accepted",
          receiverId: currentState.remoteUser._id,
          roomName: currentState.roomName,
        });
      } catch (wsError) {
        console.warn(
          "WebSocket message failed, but call is connected:",
          wsError
        );
        //no throwing - call is still connected even if WS message fails
      }

      // Start monitoring call quality
      roomManager.startQualityMonitoring(setCallQuality);
    } catch (error) {
      console.error("Error accepting call:", error);
      await eventHandler.handleCallEnded();
    }
  };

  const rejectCall = async () => {
    try {
      const currentState = stateManager.getState();

      if (!currentState.roomName || !currentState.remoteUser?._id) {
        throw new Error("Invalid call state for rejection");
      }

      await api.post("/api/call/status", {
        roomName: currentState.roomName,
        status: "rejected",
      });

      sendMessage({
        type: "call_rejected",
        receiverId: currentState.remoteUser._id,
        roomName: currentState.roomName,
      });

      await eventHandler.handleCallRejected();
    } catch (error) {
      console.error("Error rejecting call:", error);
      await eventHandler.handleCallEnded();
    }
  };

  const endCall = async () => {
    try {
      const currentState = stateManager.getState();

      if (!currentState.isInCall || !currentState.roomName) {
        console.warn("Attempted to end call when not in call or no room name");
        return;
      }

      // if (!currentState.roomName || !currentState.remoteUser?._id) {
      //   return;
      // }

      if (currentState.remoteUser?._id) {
        try {
          await api.post("/api/call/status", {
            roomName: currentState.roomName,
            status: "completed",
            endTime: new Date().toISOString(),
          });
        } catch (apiError) {
          console.warn("Failed to update call status on server:", apiError);
        }

        // try {
          sendMessage({
            type: "call_ended",
            data: {
             receiverId: currentState.remoteUser._id,
            roomName: currentState.roomName,
            forceCleanup: true,
            }
          });
        // } catch (wsError) {
        //   console.warn("Failed to send call_ended websocket message:", wsError);
        //   // continue with call termination even if WS message fails
        // }
      }
      // attempt to clean up, even when failure occures
      await eventHandler.handleCallEnded();
    } catch (error) {
      console.error("Error ending call:", error);
      //forcing cleanup as last resort
      await eventHandler.handleCallEnded();
    }
  };

  const toggleAudio = () => {
    try {
      roomManager.toggleAudio();
      const currentState = stateManager.getState();
      stateManager.transition({ ...currentState }); // Trigger update
    } catch (error) {
      console.error("Error toggling audio:", error);
    }
  };

  const toggleVideo = () => {
    try {
      roomManager.toggleVideo();
      const currentState = stateManager.getState();
      stateManager.transition({ ...currentState }); // Trigger update
    } catch (error) {
      console.error("Error toggling video:", error);
    }
  };

  const toggleScreenShare = async () => {
    try {
      const newIsScreenSharing = await roomManager.toggleScreenShare(
        !isScreenSharing
      );
      setIsScreenSharing(newIsScreenSharing);
    } catch (error) {
      console.error("Error toggling screen share:", error);
    }
  };

  useEffect(() => {
    const checkIncompleteTransitions = async () => {
      const currentState = stateManager.getState();
      if (currentState.callStatus === "connecting") {
        await stateManager.handleIncompleteTransition("connecting");
      }
    };

    const interval = setInterval(checkIncompleteTransitions, 5000);
    return () => clearInterval(interval);
  }, [stateManager]);

  // useEffect(() => {
  //   if (callState.callStatus === "connected") {
  //     roomManager.startQualityMonitoring(setCallQuality);
  //   }
  // }, [callState.callStatus, roomManager]);

  const value: CallContextType = {
    callState,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    callQuality,
    isScreenSharing,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (context === undefined) {
    throw new Error("useCall must be used within a CallProvider");
  }
  return context;
};
