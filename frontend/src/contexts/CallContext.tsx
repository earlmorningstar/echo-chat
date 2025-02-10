import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWebSocket } from "./WebSocketContext";
import {
  CallState,
  CallType,
  CallStatus,
  Friend,
  CallContextType,
  TwilioRoom,
} from "../types";
import {
  RemoteParticipant,
  RemoteTrackPublication,
  RemoteTrack,
  LocalAudioTrack,
  LocalVideoTrack,
  LocalVideoTrackPublication,
} from "twilio-video";
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

interface CallEvent {
  type: "incoming" | "accepted" | "rejected" | "ended";
  data: {
    initiatorId?: string;
    type?: CallType;
    roomName?: string;
  };
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [callState, setCallState] = useState<CallState>(initialCallState);
  const { sendMessage } = useWebSocket();
  const queryClient = useQueryClient();
  const [callQuality, setCallQuality] = useState<CallQuality | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const roomRef = useRef<any>(null);
  const callStateRef = useRef<CallState>(callState);
  const mediaStreamsRef = useRef<{
    local: MediaStream | null;
    remote: MediaStream | null;
  }>({ local: null, remote: null });

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  const handleCallStateChange = useCallback(
    (newState: Partial<CallState>) => {
      console.log("Call State Transition:", {
        oldState: callState,
        newState,
      });

      setCallState((prev) => {
        const updatedState = { ...prev, ...newState };
        console.log("Final Updated State:", updatedState);
        return updatedState;
      });
    },
    [callState]
  );

  // const handleCallStateChange = useCallback((newState: Partial<CallState>) => {
  //   setCallState((prev) => ({ ...prev, ...newState }));
  // }, []);

  const updateCallStatus = useCallback(
    (status: CallStatus) => {
      queryClient.setQueryData(["callStatus"], status);
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
    [queryClient]
  );

  const cleanupMediaTracks = useCallback((stream: MediaStream | null) => {
    if (stream) {
      stream.getTracks().forEach((track) => {
        track.stop();
        stream.removeTrack(track);
      });
    }
  }, []);

  const cleanupCall = useCallback(() => {
    try {
      // cleaning up media tracks
      mediaStreamsRef.current.local
        ?.getTracks()
        .forEach((track) => track.stop());
      mediaStreamsRef.current.remote
        ?.getTracks()
        .forEach((track) => track.stop());
      // mediaStreamsRef.current = { local: null, remote: null };

      // disconnecting from Twilio room
      if (roomRef.current) {
        try {
          roomRef.current.disconnect();
        } catch (disconnectError) {
          console.warn("Error during room disconnection:", disconnectError);
        }
        roomRef.current?.removeAllListeners?.();
        roomRef.current = null;
      }

      // if (roomRef.current) {
      //   roomRef.current.disconnect();
      //   roomRef.current.removeAllListeners();
      //   roomRef.current = null;
      // }

      mediaStreamsRef.current = { local: null, remote: null };

      // reset state
      setCallState(initialCallState);
      setCallQuality(null);
      setIsScreenSharing(false);
    } catch (error) {
      console.error("Cleanup error:", error);
    }
  }, []);

  const handleTrackPublication = useCallback(
    (publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (!publication.track) return;

      const handleTrack = (track: RemoteTrack) => {
        if (track.kind === "data") return;

        // const mediaStreamTrack = track.mediaStreamTrack;

        setCallState((prev) => {
          const newRemoteStream = new MediaStream(
            prev.remoteStream?.getTracks() || []
          );

          const mediaTrack = track.mediaStreamTrack || track;

          newRemoteStream.addTrack(mediaTrack);
          mediaStreamsRef.current.remote = newRemoteStream;
          return { ...prev, remoteStream: newRemoteStream };
        });
      };

      if (publication.track) handleTrack(publication.track);

      publication.on("subscribed", handleTrack);
      publication.on("unsubscribed", () => {
        setCallState((prev) => {
          const newRemoteStream = new MediaStream(
            prev.remoteStream ? [...prev.remoteStream.getTracks()] : []
          );
          mediaStreamsRef.current.remote = newRemoteStream;
          return { ...prev, remoteStream: newRemoteStream };
        });
      });
    },
    []
  );
  const monitorCallQuality = useCallback(
    (room: TwilioRoom) => {
      if (!room) return;

      const interval = setInterval(async () => {
        try {
          const audioTrack = Array.from(
            room.localParticipant.audioTracks.values()
          )[0];
          if (!audioTrack?.track) return;

          // Access the RTCPeerConnection directly from the Room
          const peerConnection = room.config?.peerConnection;
          if (!peerConnection) return;

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
        } catch (error) {
          console.error("Error monitoring call quality:", error);
        }
      }, 1000);
      return () => clearInterval(interval);
    },
    [callState.callType]
  );

  const handleRoomConnect = useCallback(
    (room: TwilioRoom) => {
      roomRef.current = room;

      // Handle existing participants
      room.participants.forEach((participant) => {
        participant.tracks.forEach((publication) => {
          handleTrackPublication(
            publication as RemoteTrackPublication,
            participant
          );
        });
      });

      // Handle new participants
      room.on("participantConnected", (participant) => {
        participant.tracks.forEach((publication) => {
          handleTrackPublication(
            publication as RemoteTrackPublication,
            participant
          );
        });
      });

      // Handle disconnections
      room.on("disconnected", (room, error) => {
        if (error) console.error("Room disconnected with error:", error);
        cleanupCall();
      });

      room.on("participantDisconnected", (participant) => {
        if (room.participants.size === 0) cleanupCall();
      });

      // Monitor network quality
      room.localParticipant.on("networkQualityLevelChanged", (level) => {
        setCallQuality((prev) => ({
          audio: prev?.audio || {
            bitrate: 0,
            packetsLost: 0,
            roundTripTime: 0,
          },
          video: prev?.video,
          networkLevel: level,
          timestamp: Date.now(),
        }));
      });

      monitorCallQuality(room);

      handleCallStateChange({
        isInCall: true,
        callStatus: "connected",
      });
    },
    [
      handleCallStateChange,
      handleTrackPublication,
      cleanupCall,
      monitorCallQuality,
    ]
  );

  const handleIncomingCall = useCallback(
    async (data: any) => {
      const { initiatorId, type, roomName } = data;

      console.log("Handling incoming call:", {
        currentState: callStateRef.current,
        incomingCallData: data,
      });

      //using ref to get current state to avoid staleness
      // const currentState = callStateRef.current;
      if (
        callStateRef.current.callStatus === "connected" ||
        callStateRef.current.callStatus === "ended"
      ) {
        console.log("Preventing incoming call due to active call");
        return;
      }

      // Get caller details
      try {
        const response = await api.get(`/api/user/${initiatorId}`);
        const caller = response.data.user;

        setCallState({
          isInCall: false,
          callStatus: "incoming",
          callType: type,
          remoteUser: caller,
          roomName: roomName,
          localStream: null,
          remoteStream: null,
        });
      } catch (error) {
        console.error("Incoming call handling error:", error);
        cleanupCall();
      }
    },
    [cleanupCall]
  );

  const handleCallAccepted = useCallback(
    async (data: any) => {
      handleCallStateChange({
        callStatus: "connected",
      });
      updateCallStatus("connected");
    },
    [handleCallStateChange, updateCallStatus]
  );

  const handleCallRejected = useCallback(
    async (data: any) => {
      cleanupCall();
    },
    [cleanupCall]
  );

  const handleCallEnded = useCallback(
    async (data: any) => {
      console.log("Handling comprehensive call end:", {
        receivedData: data,
        currentCallState: callState,
      });

      // // validating room name to prevent unnecessary processing
      // if (!data.roomName || data.roomName !== callState.roomName) {
      //   console.warn("Mismatched room name in call end", {
      //     receivedRoomName: data.roomName,
      //     currentRoomName: callState.roomName,
      //   });
      //   return;
      // }

      try {
        // disconnecting Twilio room if active
        if (roomRef.current) {
          try {
            roomRef.current.disconnect();
          } catch (disconnectError) {
            console.error("Room disconnection error:", disconnectError);
          }
          roomRef.current = null;
        }

        // explicitly reseting the initial state
        setCallState({
          isInCall: false,
          callType: null,
          callStatus: "idle",
          remoteUser: null,
          roomName: null,
          localStream: null,
          remoteStream: null,
        });

        //clearing lingering call events
        queryClient.removeQueries({ queryKey: ["callEvent"] });
        queryClient.removeQueries({ queryKey: ["callStatus"] });

        queryClient.setQueryData(["callEvent"], null);
      } catch (error) {
        console.error("Comprehensive call end error:", error);
      } finally {
        cleanupCall();
      }
    },
    [callState, cleanupCall, queryClient]
  );

  const setupLocalStream = useCallback(
    async (type: CallType) => {
      try {
        cleanupMediaTracks(mediaStreamsRef.current.local);
        const constraints = {
          audio: true,
          video: type === "video" ? { facingMode: "user" } : false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        mediaStreamsRef.current.local = stream;
        handleCallStateChange({ localStream: stream });
        return stream;
      } catch (error) {
        console.error("Error accessing media devices:", error);
        throw error;
      }
    },
    [cleanupMediaTracks, handleCallStateChange]
  );

  const getTwilioToken = useCallback(async (roomName: string) => {
    const response = await api.post("/api/call/token", { roomName });
    return response.data.token;
  }, []);

  const connectToTwilioRoom = useCallback(
    async (roomName: string, token?: string) => {
      try {
        const currentToken = token || (await getTwilioToken(roomName));
        const { connect } = await import("twilio-video");
        const localStream = mediaStreamsRef.current.local;

        if (!localStream) {
          throw new Error("Local media stream not available");
        }

        //publishing local tracks explicitly
        const tracks = Array.from(localStream.getTracks()).map((track) =>
          track.kind === "audio"
            ? new LocalAudioTrack(track)
            : new LocalVideoTrack(track)
        );

        // const room = await connect(currentToken, {
        //   name: roomName,
        //   audio: true,
        //   video: callState.callType === "video",
        //   networkQuality: {
        //     local: 1,
        //     remote: 1,
        //   },
        // });

        const room = await connect(currentToken, {
          name: roomName,
          tracks: tracks,
          networkQuality: {
            local: 1,
            remote: 1,
          },
        });

        // const localStream = new MediaStream();

        // // handling audio tracks
        // room.localParticipant.audioTracks.forEach((publication) => {
        //   if (publication.track) {
        //     localStream.addTrack(publication.track.mediaStreamTrack);
        //   }
        // });

        // // handling video tracks
        // room.localParticipant.videoTracks.forEach((publication) => {
        //   if (publication.track) {
        //     localStream.addTrack(publication.track.mediaStreamTrack);
        //   }
        // });

        // //updating state with combined stream
        // handleCallStateChange({ localStream });

        handleRoomConnect(room);
        return room;
      } catch (error) {
        console.error("Error connecting to Twilio room:", error);
        cleanupCall();
        throw error;
      }
    },
    [
      // callState.callType,
      getTwilioToken,
      handleRoomConnect,
      cleanupCall,
      // handleCallStateChange,
    ]
  );

  const initiateCall = useCallback(
    async (friend: Friend, type: CallType) => {
      await setupLocalStream(type);

      const response = await api.post("/api/call/initiate", {
        receiverId: friend._id,
        type,
      });

      if (!response.data.roomName) {
        throw new Error("Room name not received from server");
      }
      setCallState((prev) => ({
        ...prev,
        isInCall: true,
        callType: type,
        callStatus: "outgoing",
        remoteUser: friend,
        roomName: response.data.roomName,
      }));

      await connectToTwilioRoom(response.data.roomName);
      sendMessage({
        type: "call_initiate",
        receiverId: friend._id,
        callType: type,
        roomName: response.data.roomName,
      });
    },
    [setupLocalStream, connectToTwilioRoom, sendMessage]
  );

  const acceptCall = useCallback(async () => {
    if (!callState.roomName || !callState.callType) return;

    try {
      setCallState((prev) => ({
        ...prev,
        isInCall: true,
        callStatus: "connecting",
      }));

      // const stream = await setupLocalStream(callState.callType);
      await setupLocalStream(callState.callType);
      await connectToTwilioRoom(callState.roomName);

      // setCallState((prev) => ({
      //   ...prev,
      //   isInCall: true,
      //   callStatus: "connecting",
      //   localStream: stream,
      // }));

      // await connectToTwilioRoom(callState.roomName);
      // notifying caller
      sendMessage({
        type: "call_accepted",
        receiverId: callState.remoteUser?._id,
        roomName: callState.roomName,
      });
    } catch (error) {
      console.error("Accept call failed:", error);
      cleanupCall();
    }
  }, [
    callState,
    setupLocalStream,
    connectToTwilioRoom,
    sendMessage,
    cleanupCall,
  ]);

  const rejectCall = useCallback(async () => {
    if (!callState.roomName || !callState.remoteUser?._id) return;

    try {
      await api.post("/api/call/status", {
        roomName: callState.roomName,
        status: "rejected",
      });

      sendMessage({
        type: "call_rejected",
        receiverId: callState.remoteUser._id,
        roomName: callState.roomName,
      });
    } catch (error) {
      console.error("Reject call error:", error);
    } finally {
      cleanupCall();
    }
  }, [callState, sendMessage, cleanupCall]);

  const endCall = useCallback(async () => {
    if (!callState.roomName || !callState.remoteUser?._id) {
      console.warn("No active call to end");
      return;
    }

    try {
      await api.post("/api/call/status", {
        roomName: callState.roomName,
        status: "completed",
        endTime: new Date().toISOString(),
      });

      //notifying remote user
      sendMessage({
        type: "call_ended",
        receiverId: callState.remoteUser._id,
        roomName: callState.roomName,
        senderId: callState.remoteUser._id,
        forceReset: true,
      });

      cleanupCall();

      setCallState({
        isInCall: false,
        callType: null,
        callStatus: "idle",
        remoteUser: null,
        roomName: null,
        localStream: null,
        remoteStream: null,
      });

      queryClient.removeQueries({ queryKey: ["callEvent"] });
      queryClient.removeQueries({ queryKey: ["callStatus"] });
      queryClient.setQueryData(["callEvent"], null);
    } catch (error) {
      console.error("End call error:", error);
      cleanupCall();
    }
  }, [callState, sendMessage, cleanupCall, queryClient]);

  const toggleAudio = useCallback(() => {
    const room = roomRef.current;
    if (room && mediaStreamsRef.current.local) {
      const audioTrack = [...room.localParticipant.audioTracks.values()][0];
      if (audioTrack) {
        audioTrack.track.enable(!audioTrack.isEnabled);
        setCallState((prev) => ({ ...prev }));
      }
    }
  }, []);

  const toggleVideo = useCallback(() => {
    const room = roomRef.current;
    if (room && mediaStreamsRef.current.local) {
      const videoTrack = [...room.localParticipant.videoTracks.values()][0];
      if (videoTrack) {
        videoTrack.track.enable(!videoTrack.isEnabled);
        setCallState((prev) => ({ ...prev }));
      }
    }
  }, []);

  // const toggleScreenShare = useCallback(async () => {
  //   const room = roomRef.current;
  //   if (!room) throw new Error("No active room connection");

  //   const localParticipant = room.localParticipant;
  //   let screenTrack: MediaStreamTrack | undefined;

  //   if (!isScreenSharing) {
  //     const screenStream = await navigator.mediaDevices.getDisplayMedia({
  //       video: { frameRate: 15, width: 1280, height: 720 },
  //     });
  //     [screenTrack] = screenStream.getVideoTracks();
  //     screenTrack.onended = () => toggleScreenShare();

  //     const currentVideoTrack = [...localParticipant.videoTracks.values()][0];
  //     if (currentVideoTrack?.track) {
  //       await localParticipant.unpublishTrack(currentVideoTrack.track);
  //       currentVideoTrack.track.stop();
  //     }

  //     await localParticipant.publishTrack(screenTrack);
  //   } else {
  //     const cameraStream = await navigator.mediaDevices.getUserMedia({
  //       video: callState.callType === "video",
  //     });
  //     const [cameraTrack] = cameraStream.getVideoTracks();

  //     const currentScreenTrack = [...localParticipant.videoTracks.values()][0];
  //     if (currentScreenTrack?.track) {
  //       await localParticipant.unpublishTrack(currentScreenTrack.track);
  //       currentScreenTrack.track.stop();
  //     }

  //     await localParticipant.publishTrack(cameraTrack);
  //   }

  //   setIsScreenSharing((prev) => !prev);
  // }, [isScreenSharing, callState.callType]);

  // const toggleScreenShare = useCallback(async () => {
  //   const room = roomRef.current;
  //   if (!room) throw new Error("No active room connection");

  //   try {
  //     if (!isScreenSharing) {
  //       const screenStream = await navigator.mediaDevices.getDisplayMedia({
  //         video: { frameRate: 15, width: 1280, height: 720 },
  //       });
  //       const [screenTrack] = screenStream.getVideoTracks();
  //       screenTrack.onended = () => toggleScreenShare();

  //       // Create new local stream with screen track
  //       const newLocalStream = new MediaStream([
  //         ...(mediaStreamsRef.current.local?.getAudioTracks() || []),
  //         screenTrack,
  //       ]);

  //       mediaStreamsRef.current.local = newLocalStream;
  //       handleCallStateChange({ localStream: newLocalStream });

  //       // Replace existing video track
  //       const localParticipant = room.localParticipant;
  //       localParticipant.videoTracks.forEach((track) => track.track?.stop());
  //       await localParticipant.publishTrack(screenTrack);
  //     } else {
  //       const cameraStream = await navigator.mediaDevices.getUserMedia({
  //         video: true,
  //       });
  //       const [cameraTrack] = cameraStream.getVideoTracks();

  //       // Create new local stream with camera track
  //       const newLocalStream = new MediaStream([
  //         ...(mediaStreamsRef.current.local?.getAudioTracks() || []),
  //         cameraTrack,
  //       ]);

  //       mediaStreamsRef.current.local = newLocalStream;
  //       handleCallStateChange({ localStream: newLocalStream });

  //       // Replace existing video track
  //       const localParticipant = room.localParticipant;
  //       localParticipant.videoTracks.forEach((track) => track.track?.stop());
  //       await localParticipant.publishTrack(cameraTrack);
  //     }

  //     setIsScreenSharing((prev) => !prev);
  //   } catch (error) {
  //     console.error("Screen sharing failed:", error);
  //   }
  // }, [isScreenSharing, handleCallStateChange]);

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) throw new Error("No active room connection");

    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: 15, width: 1280, height: 720 },
        });
        const [screenTrack] = screenStream.getVideoTracks();
        screenTrack.onended = () => toggleScreenShare();

        // Create new local stream with screen track
        const newLocalStream = new MediaStream([
          ...(mediaStreamsRef.current.local?.getAudioTracks() || []),
          screenTrack,
        ]);

        mediaStreamsRef.current.local = newLocalStream;
        handleCallStateChange({ localStream: newLocalStream });

        // Replace existing video track with explicit type annotation
        const localParticipant = room.localParticipant;
        localParticipant.videoTracks.forEach(
          (track: LocalVideoTrackPublication) => track.track?.stop()
        );
        await localParticipant.publishTrack(screenTrack);
      } else {
        const cameraStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        const [cameraTrack] = cameraStream.getVideoTracks();

        // Create new local stream with camera track
        const newLocalStream = new MediaStream([
          ...(mediaStreamsRef.current.local?.getAudioTracks() || []),
          cameraTrack,
        ]);

        mediaStreamsRef.current.local = newLocalStream;
        handleCallStateChange({ localStream: newLocalStream });

        // Replace existing video track with explicit type annotation
        const localParticipant = room.localParticipant;
        localParticipant.videoTracks.forEach(
          (track: LocalVideoTrackPublication) => track.track?.stop()
        );
        await localParticipant.publishTrack(cameraTrack);
      }

      setIsScreenSharing((prev) => !prev);
    } catch (error) {
      console.error("Screen sharing failed:", error);
    }
  }, [isScreenSharing, handleCallStateChange]);

  useEffect(() => {
    const subscription = queryClient.getQueryCache().subscribe(() => {
      const callEvent = queryClient.getQueryData<CallEvent>(["callEvent"]);
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
  }, [
    queryClient,
    handleIncomingCall,
    handleCallAccepted,
    handleCallRejected,
    handleCallEnded,
  ]);

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
