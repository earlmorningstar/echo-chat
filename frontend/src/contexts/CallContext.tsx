import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWebSocket } from "./WebSocketContext";
// import { useAuth } from "./AuthContext";
import {
  CallState,
  CallType,
  CallStatus,
  Friend,
  CallContextType,
} from "../types";
import api from "../utils/api";

const initialCallState: CallState = {
  isInCall: false,
  callType: null,
  callStatus: "idle",
  remoteUser: null,
  roomName: null,
  localStream: null,
  remoteStream: null,
};

interface CallQuality {
  audio: {
    bitrate: number;
    packetsLost: number;
    roundTripTime: number;
  };
  video?: {
    bitrate: number;
    packetsLost: number;
    frameRate: number;
    resolution: { width: number; height: number };
  };
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [callState, setCallState] = useState<CallState>(initialCallState);
  //   const { user } = useAuth();
  const { sendMessage } = useWebSocket();
  const queryClient = useQueryClient();
  const [twilioToken, setTwilioToken] = useState<string | null>(null);
  const [callQuality, setCallQuality] = useState<CallQuality | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const handleCallStateChange = useCallback((newState: Partial<CallState>) => {
    setCallState((prev) => ({ ...prev, ...newState }));
  }, []);

  const updateCallStatus = useCallback(
    (status: CallStatus) => {
      queryClient.setQueryData(["callStatus"], status);
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
    [queryClient]
  );

  //incoming websocket call evt
  //   useEffect(() => {
  //     const handleIncomingCall = async (data: any) => {
  //       const { initiatorId, type, roomName } = data;
  //       //caller details
  //       const response = await api.get(`/api/user/${initiatorId}`);
  //       const caller = response.data.user;

  //       setCallState({
  //         ...initialCallState,
  //         callStatus: "incoming",
  //         callType: type,
  //         remoteUser: caller,
  //         roomName,
  //       });
  //     };

  //     window.addEventListener("incomingCall", (e: any) =>
  //       handleIncomingCall(e.detail)
  //     );
  //     return () => {
  //       window.removeEventListener("incomingCall", (e: any) =>
  //         handleIncomingCall(e.detail)
  //       );
  //     };
  //   }, []);

  const handleIncomingCall = async (data: any) => {
    const { initiatorId, type, roomName } = data;

    // Get caller details
    const response = await api.get(`/api/user/${initiatorId}`);
    const caller = response.data.user;

    handleCallStateChange({
      callStatus: "incoming",
      callType: type,
      remoteUser: caller,
      roomName,
    });
  };

  const handleCallAccepted = async (data: any) => {
    handleCallStateChange({
      callStatus: "connected",
    });
  };

  const handleCallRejected = async (data: any) => {
    cleanupCall();
  };

  const handleCallEnded = async (data: any) => {
    cleanupCall();
  };

  useEffect(() => {
    const subscription = queryClient.getQueryCache().subscribe(() => {
      const callEvent = queryClient.getQueryData(["callEvent"]);
      if (callEvent) {
        switch (callEvent.type) {
          case "incoming":
            handleIncomingCall(callEvent.data);
            break;
          case "accepted":
            handleCallAccepted(callEvent.data);
            break;
          case "rejected":
            handleCallRejected(callEvent.data);
            break;
          case "ended":
            handleCallEnded(callEvent.data);
            break;
        }
      }
    });
    return () => subscription();
  }, [queryClient]);

  const setupLocalStream = async (type: CallType) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === "video",
      });
      setCallState((prev) => ({ ...prev, localStream: stream }));
      return stream;
    } catch (error) {
      console.error("Error accessing media devices:", error);
      throw error;
    }
  };

  const getTwilioToken = async (roomName: string) => {
    const response = await api.post("/api/call/token", { roomName });
    return response.data.token;
  };

  const initiateCall = async (friend: Friend, type: CallType) => {
    try {
      //requesting media permits
      await setupLocalStream(type);

      //initiating call from backend
      const response = await api.post("/api/call/initiate", {
        receiverId: friend._id,
        type,
      });

      const { roomName } = response.data.data;

      //twilio token
      const token = await getTwilioToken(roomName);
      setTwilioToken(token);

      //updating call state
      setCallState((prev) => ({
        ...prev,
        isInCall: true,
        callType: type,
        callStatus: "outgoing",
        remoteUser: friend,
        roomName,
      }));

      //notifying via ws
      sendMessage({
        type: "call_initiate",
        receiverId: friend._id,
        callType: type,
        roomName,
      });
    } catch (error) {
      console.error("Error initiating call:", error);
      endCall();
    }
  };

  const acceptCall = async () => {
    try {
      if (!callState.roomName || !callState.callType) return;

      //setting local stream
      await setupLocalStream(callState.callType);

      //getting twilio token
      const token = await getTwilioToken(callState.roomName);
      setTwilioToken(token);

      setCallState((prev) => ({
        ...prev,
        isInCall: true,
        callStatus: "connected",
      }));

      //notifying caller via ws
      sendMessage({
        type: "call_accepted",
        receiverId: callState.remoteUser?._id,
        roomName: callState.roomName,
      });
    } catch (error) {
      console.error("Error accepting call:", error);
      endCall();
    }
  };

  const rejectCall = async () => {
    if (callState.remoteUser?._id) {
      sendMessage({
        type: "call_rejected",
        receiverId: callState.remoteUser._id,
        roomName: callState.roomName,
      });
    }

    //updating status on backend
    if (callState.roomName) {
      await api.post("/api/call/status", {
        roomName: callState.roomName,
        status: "rejected",
      });
    }
    cleanupCall();
  };

  const endCall = async () => {
    if (callState.remoteUser?._id) {
      sendMessage({
        type: "call_ended",
        receiverId: callState.remoteUser._id,
        roomName: callState.roomName,
      });
    }
    //updating statusd on backend
    if (callState.roomName) {
      await api.post("/api/call/status", {
        roomName: callState.roomName,
        status: "completed",
        endTime: new Date(),
      });
    }
    cleanupCall();
  };

  const cleanupCall = () => {
    //halt entire tracks in local stream
    callState.localStream?.getTracks().forEach((track) => track.stop());
    //reset state
    setCallState(initialCallState);
    setTwilioToken(null);
  };

  const toggleAudio = () => {
    if (callState.localStream) {
      const audioTrack = callState.localStream.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      setCallState((prev) => ({ ...prev }));
    }
  };

  const toggleVideo = () => {
    if (callState.localStream && callState.callType === "video") {
      const videoTrack = callState.localStream.getVideoTracks()[0];
      videoTrack.enabled = !videoTrack.enabled;
      setCallState((prev) => ({ ...prev }));
    }
  };

  const monitorCallQuality = useCallback(
    (peerConnection: RTCPeerConnection) => {
      setInterval(async () => {
        const stats = await peerConnection.getStats();

        let audioStats = {
          bitrate: 0,
          packetsLost: 0,
          roundTripTime: 0,
        };

        let videoStats = {
          bitrate: 0,
          packetsLost: 0,
          frameRate: 0,
          resolution: { width: 0, height: 0 },
        };

        stats.forEach((stat) => {
          if (stat.type === "inbound-rtp") {
            if (stat.kind === "audio") {
              audioStats = {
                bitrate: stat.bitrate || 0,
                packetsLost: stat.packetsLost || 0,
                roundTripTime: stat.roundTripTime || 0,
              };
            } else if (stat.kind === "video") {
              videoStats = {
                bitrate: stat.bitrate || 0,
                packetsLost: stat.packetsLost || 0,
                frameRate: stat.framesPerSecond || 0,
                resolution: {
                  width: stat.frameWidth || 0,
                  height: stat.frameHeight || 0,
                },
              };
            }
          }
        });

        setCallQuality({
          audio: audioStats,
          video: callState.callType === "video" ? videoStats : undefined,
        });
      }, 1000);
    },
    [callState.callType]
  );

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });

        //replacing video track
        if (callState.localStream) {
          const videoTrack = callState.localStream.getVideoTracks()[0];
          if (videoTrack) {
            callState.localStream.removeTrack(videoTrack);
            videoTrack.stop();
          }

          const screenTrack = screenStream.getVideoTracks()[0];
          callState.localStream.addTrack(screenTrack);

          //handling when user stop sharing
          screenTrack.onended = () => {
            toggleScreenShare();
          };
        }
        setIsScreenSharing(true);
      } else {
        //switching back to camera
        const cameraStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });

        if (callState.localStream) {
          const screenTrack = callState.localStream.getVideoTracks()[0];
          if (screenTrack) {
            callState.localStream.removeTrack(screenTrack);
            screenTrack.stop();
          }

          const cameraTrack = cameraStream.getVideoTracks()[0];
          callState.localStream.addTrack(cameraTrack);
        }
        setIsScreenSharing(false);
      }
    } catch (error) {
      console.error("Error toggling screen share:", error);
    }
  };

  const value: CallContextType = {
    callState,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleAudio,
    toggleVideo,
    callQuality,
    isScreenSharing,
    toggleScreenShare,
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
