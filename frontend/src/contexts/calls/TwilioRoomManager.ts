// import { useState, useEffect } from "react";
// import { connect, Room, LocalTrack, RemoteParticipant } from "twilio-video";
// import { CallState } from "./CallStateManager";

// type TwilioRoomManager = {
//   room: Room | null;
//   connectToRoom: (token: string, roomName: string) => Promise<Room>;
//   disconnectFromRoom: () => void;
//   participants: RemoteParticipant[];
// };

// export function useTwilioRoomManager(
//   localTracks: LocalTrack[],
//   updateCallState: (update: Partial<CallState>) => void
// ): TwilioRoomManager {
//   const [room, setRoom] = useState<Room | null>(null);
//   const [participants, setParticipants] = useState<RemoteParticipant[]>([]);

//   const connectToRoom = async (token: string, roomName: string) => {
//     console.log("Attempting Twilio connection with:", { token, roomName });
//     try {
//       const newRoom = await connect(token, {
//         name: roomName,
//         tracks: localTracks,
//       });

//       console.log("Twilio connection success:", newRoom);

//       newRoom.on("participantConnected", (participant) => {
//         setParticipants((prev) => [...prev, participant]);
//         updateCallState({
//           currentCall: {
//             participants: [
//               ...participants.map((p) => p.identity),
//               participant.identity,
//             ],
//           },
//         } as CallState);
//       });

//       newRoom.on("participantDisconnected", (participant) => {
//         console.log("Disconnected from room:", room);
//         setParticipants((prev) => prev.filter((p) => p !== participant));
//         updateCallState({
//           currentCall: {
//             participants: participants
//               .filter((p) => p.identity !== participant.identity)
//               .map((p) => p.identity),
//           },
//         } as CallState);
//       });

//       setRoom(newRoom);
//       return newRoom;
//     } catch (error) {
//       console.error("Twilio connection failed:", error);
//       throw error;
//     }
//   };

//   const disconnectFromRoom = () => {
//     if (room) {
//       room.disconnect();
//       setRoom(null);
//       setParticipants([]);
//     }
//   };

//   useEffect(() => {
//     return () => {
//       if (room) room.disconnect();
//     };
//   }, [room]);

//   return { room, connectToRoom, disconnectFromRoom, participants };
// }

import { useState, useEffect, useCallback } from "react";
import * as TwilioVideo from "twilio-video";
import * as TwilioVoice from "@twilio/voice-sdk";
import { CallStatus, CallType, CallEvent } from "../../types";

interface TwilioCallState {
  callId?: string;
  type: CallType;
  activeCall: TwilioVideo.Room | TwilioVoice.Call | null;
  participants: string[];
  status: CallStatus;
}

export function useTwilioRoomManager(
  localTracks: TwilioVideo.LocalTrack[] = [],
  updateCallState: (update: Partial<TwilioCallState>) => void,
  onCallEvent?: (event: CallEvent) => void
) {
  const [callManager, setCallManager] = useState<{
    videoDevice?: TwilioVideo.Room;
    voiceDevice?: TwilioVoice.Device;
    currentCallId?: string;
    participants?: string[];
  }>({});

  const connectToVideoRoom = async (
    token: string,
    roomName: string,
    callId: string
  ) => {
    try {
      const room = await TwilioVideo.connect(token, {
        name: roomName,
        tracks: localTracks,
      });

      setCallManager((prev) => ({
        ...prev,
        videoDevice: room,
        currentCallId: callId,
        participants: Array.from(room.participants.keys()).map((p) => p),
      }));

      room.on("participantConnected", (participant) => {
        const participants = Array.from(room.participants.keys()).map((p) => p);

        updateCallState({
          callId,
          type: CallType.VIDEO,
          activeCall: room,
          participants,
          status: CallStatus.CONNECTED,
        });

        onCallEvent?.({
          type: "call_accept",
          callId,
          callerId: participant.identity,
          callType: CallType.VIDEO,
          timestamp: Date.now(),
        });
      });

      room.on("participantDisconnected", (participant) => {
        const participants = Array.from(room.participants.keys()).map((p) => p);

        updateCallState({
          callId,
          type: CallType.VIDEO,
          activeCall: room,
          participants,
          status:
            participants.length > 0
              ? CallStatus.CONNECTED
              : CallStatus.COMPLETED,
        });

        onCallEvent?.({
          type: "call_end",
          callId,
          callerId: participant.identity,
          callType: CallType.VIDEO,
          timestamp: Date.now(),
        });
      });
      return room;
    } catch (error) {
      console.error("Video connection failed:", error);

      updateCallState({
        callId,
        type: CallType.VIDEO,
        status: CallStatus.REJECTED,
        activeCall: null,
      });

      onCallEvent?.({
        type: "call_reject",
        callId,
        callerId: "",
        timestamp: Date.now(),
      });

      throw error;
    }
  };

  const initializeVoiceDevice = (token: string, currentCallId: string) => {
    try {
      const device = new TwilioVoice.Device(token, {
        // debug: true,
      });

      setCallManager((prev) => ({
        ...prev,
        voiceDevice: device,
        currentCallId: currentCallId,
      }));

      device.on("ready", () => {
        updateCallState({
          callId: currentCallId,
          type: CallType.VOICE,
          status: CallStatus.INITIATED,
        });
      });

      device.on("error", (error) => {
        console.error("Voice device error:", error);

        updateCallState({
          callId: currentCallId,
          type: CallType.VOICE,
          status: CallStatus.REJECTED,
          activeCall: null,
        });

        onCallEvent?.({
          type: "call_reject",
          callId: currentCallId,
          callerId: "",
          timestamp: Date.now(),
        });
      });

      device.register();
      return device;
    } catch (error) {
      console.error("Failed to initialize Voice device:", error);

      updateCallState({
        callId: currentCallId,
        type: CallType.VOICE,
        status: CallStatus.REJECTED,
        activeCall: null,
      });

      throw error;
    }
  };

  const makeVoiceCall = async (identity: string, currentCallId: string) => {
    const { voiceDevice } = callManager;
    if (!voiceDevice) {
      console.error("Voice device not initialized");
      return null;
    }

    try {
      const call = (await voiceDevice.connect({
        params: {
          To: `client:${identity}`,
        },
      })) as TwilioVoice.Call;

      call.on("connected", () => {
        updateCallState({
          callId: currentCallId,
          type: CallType.VOICE,
          activeCall: call,
          status: CallStatus.CONNECTED,
          participants: [identity],
        });

        onCallEvent?.({
          type: "call_accept",
          callId: currentCallId,
          callerId: identity,
          callType: CallType.VOICE,
          timestamp: Date.now(),
        });
      });

      call.on("disconnected", () => {
        updateCallState({
          callId: currentCallId,
          type: CallType.VOICE,
          activeCall: null,
          status: CallStatus.COMPLETED,
          participants: [],
        });

        onCallEvent?.({
          type: "call_end",
          callId: currentCallId,
          callerId: identity,
          callType: CallType.VOICE,
          timestamp: Date.now(),
        });
      });

      setCallManager((prev) => ({
        ...prev,
        activeCall: call,
      }));

      return call;
    } catch (error) {
      console.error("Failed to make voice call:", error);

      updateCallState({
        callId: currentCallId,
        type: CallType.VOICE,
        activeCall: null,
        status: CallStatus.REJECTED,
      });

      onCallEvent?.({
        type: "call_reject",
        callId: currentCallId,
        callerId: identity,
        timestamp: Date.now(),
      });

      return null;
    }
  };

  const disconnectCall = useCallback(() => {
    const { videoDevice, voiceDevice, currentCallId } = callManager;

    if (videoDevice) {
      videoDevice.disconnect();
      setCallManager((prev) => ({ ...prev, videoDevice: undefined }));
    }

    if (voiceDevice) {
      voiceDevice.destroy();
      setCallManager((prev) => ({ ...prev, voiceDevice: undefined }));
    }

    updateCallState({
      callId: currentCallId,
      activeCall: null,
      status: CallStatus.COMPLETED,
      participants: [],
    });

    onCallEvent?.({
      type: "call_end",
      callId: currentCallId || "",
      callerId: "",
      timestamp: Date.now(),
    });
  }, [onCallEvent, updateCallState, callManager]);

  useEffect(() => {
    return () => {
      disconnectCall();
    };
  }, [disconnectCall]);

  return {
    connectToVideoRoom,
    initializeVoiceDevice,
    makeVoiceCall,
    disconnectCall,
    callManager,
  };
}

// import {
//   Room,
//   connect,
//   LocalTrack,
//   LocalAudioTrack,
//   LocalVideoTrack,
//   RemoteParticipant,
//   RemoteAudioTrack,
//   RemoteVideoTrack,
//   RemoteTrack,
//   StatsReport,
// } from "twilio-video";
// import { CallQuality, CallState, CallType } from "../../types";

// interface ExtendedStatsReport extends StatsReport {
//   type: string;
//   bitrate?: number;
//   packetsLost?: number;
//   roundTripTime?: number;
//   kind?: string;
//   framesPerSecond?: number;
//   frameWidth?: number;
//   frameHeight?: number;
// }

// export class TwilioRoomManager {
//   private currentRoom: Room | null = null;
//   private activeScreenShare: LocalVideoTrack | null = null;
//   private qualityMonitorInterval: NodeJS.Timeout | null = null;
//   private localStream: MediaStream | null = null;

//   constructor(private updateState: (state: Partial<CallState>) => void) {
//     this.handleParticipantConnected =
//       this.handleParticipantConnected.bind(this);
//     this.handleParticipantDisconnected =
//       this.handleParticipantDisconnected.bind(this);
//     this.handleDisconnect = this.handleDisconnect.bind(this);
//     this.handleTrackSubscribed = this.handleTrackSubscribed.bind(this);
//   }

//   private validateRoomState() {
//     if (!this.currentRoom) {
//       throw new Error("No active room connection");
//     }

//     if (this.currentRoom.state === "disconnected") {
//       throw new Error("Room connection lost");
//     }
//   }

//   async connectToRoom(
//     roomName: string,
//     token: string,
//     type: CallType
//     // localStream: MediaStream
//   ): Promise<Room> {
//     // const localTracks = await this.createLocalTracks(localStream.getTracks());

//     try {
//       const tracks = await this.getMediaTracks(type);
//       this.localStream = new MediaStream(
//         tracks
//     .filter((track) => track.kind === "audio" || track.kind === "video")
//     .map((t) => {
//       //casting to the appropriate type that has mediaStreamTrack
//       if (t.kind === "audio" || t.kind === "video") {
//         return (t as LocalAudioTrack | LocalVideoTrack).mediaStreamTrack;
//       }
//       throw new Error("Unexpected track type");
//     })
//       );

//       await this.validateMediaPermissions();

//       this.currentRoom = await connect(token, {
//         name: roomName,
//         tracks,
//         dominantSpeaker: true,
//         bandwidthProfile: {
//           video: {
//             mode: "grid",
//             maxTracks: 5,
//             dominantSpeakerPriority: "high",
//           },
//         },
//         preferredVideoCodecs: [{ codec: "VP8", simulcast: true }],
//         networkQuality: { local: 1, remote: 1 },
//       });

//       this.setupEventHandlers();
//       return this.currentRoom;
//     } catch (error) {
//       console.error("Room connection failed:", error);
//       this.handleDisconnect();
//       throw error;
//     }
//   }

//   async getMediaTracks(type: CallType): Promise<LocalTrack[]> {
//     await this.validateMediaPermissions();
//     const constraints = this.getConstraints(type);
//     const stream = await navigator.mediaDevices.getUserMedia(constraints);
//     return this.createLocalTracks(stream);
//   }

//   async validateMediaPermissions(): Promise<void> {
//     try {
//       //requesting permission if not already granted
//       await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
//     } catch (error) {
//       console.error("Media permissions denied:", error);
//       throw new Error("Media permissions required for call");
//     }
//   }

//   getConstraints(type: CallType): MediaStreamConstraints {
//     return {
//       audio: true,
//       video:
//         type === "video"
//           ? {
//               width: { ideal: 1280 },
//               height: { ideal: 720 },
//               frameRate: { ideal: 24 },
//             }
//           : false,
//     };
//   }

//   async createLocalTracks(stream: MediaStream): Promise<LocalTrack[]> {
//     const tracks: LocalTrack[] = [];

//     const audioTracks = stream.getAudioTracks();
//     if (audioTracks.length > 0) {
//       const audioTrack = new LocalAudioTrack(audioTracks[0]);
//       tracks.push(audioTrack);
//     }

//     const videoTracks = stream.getVideoTracks();
//     if (videoTracks.length > 0) {
//       const videoTrack = new LocalVideoTrack(videoTracks[0]);
//       tracks.push(videoTrack);
//     }

//     return tracks;
//   }

//   getLocalStream(): MediaStream | null {
//     return this.localStream;
//   }

//   setupEventHandlers(): void {
//     if (!this.currentRoom) return;

//     this.currentRoom.on(
//       "participantConnected",
//       this.handleParticipantConnected
//     );
//     this.currentRoom.on(
//       "participantDisconnected",
//       this.handleParticipantDisconnected
//     );
//     this.currentRoom.on("disconnected", this.handleDisconnect);

//     //handling participants that are already connected
//     this.currentRoom.participants.forEach(this.handleParticipantConnected);
//   }

//   handleTrackSubscribed(track: RemoteTrack): void {
//     //only handle audio/video tracks
//     if (track.kind === "audio" && track instanceof RemoteAudioTrack) {
//       this.updateState({
//         remoteStream: new MediaStream([track.mediaStreamTrack]),
//       });
//     } else if (track.kind === "video" && track instanceof RemoteVideoTrack) {
//       this.updateState({
//         remoteStream: new MediaStream([track.mediaStreamTrack]),
//       });
//     }
//     // if (track.kind === "audio" || track.kind === "video") {
//     //   const mediaTrack = track as RemoteAudioTrack | RemoteVideoTrack;

//     //   mediaTrack.on("subscribed", () => {
//     //     this.updateState({
//     //       remoteStream: new MediaStream([mediaTrack.mediaStreamTrack]),
//     //     });
//     //   });
//     // }
//   }

//   private handleParticipantConnected = (participant: RemoteParticipant) => {
//     participant.tracks.forEach((publication) => {
//       if (publication.track) {
//         this.handleTrackSubscribed(publication.track);
//       }
//     });

//     participant.on("trackSubscribed", this.handleTrackSubscribed);
//   };

//   private handleParticipantDisconnected = (participant: RemoteParticipant) => {
//     this.updateState({ remoteStream: null });
//   };

//   // private async createLocalTracks(
//   //   mediaStreamTracks: MediaStreamTrack[]
//   // ): Promise<LocalTrack[]> {
//   //   const localTracks: LocalTrack[] = [];

//   //   for (const track of mediaStreamTracks) {
//   //     if (track.kind === "audio") {
//   //       localTracks.push(new LocalAudioTrack(track));
//   //     } else if (track.kind === "video") {
//   //       localTracks.push(new LocalVideoTrack(track));
//   //     }
//   //   }

//   //   return localTracks;
//   // }

//   async toggleAudio(): Promise<void> {
//     if (!this.currentRoom) return;

//     this.currentRoom.localParticipant.audioTracks.forEach((publication) => {
//       if (publication.track) {
//         if (publication.track.isEnabled) {
//           publication.track.disable();
//         } else {
//           publication.track.enable();
//         }
//       }
//     });
//   }

//   // toggleAudio(): void {
//   //   if (!this.currentRoom) return;

//   //   const audioTrack = Array.from(
//   //     this.currentRoom.localParticipant.audioTracks.values()
//   //   )[0];
//   //   if (audioTrack?.track) {
//   //     const isEnabled = audioTrack.track.isEnabled;
//   //     audioTrack.track.enable(!isEnabled);
//   //   }
//   // }

//   async toggleVideo(): Promise<void> {
//     if (!this.currentRoom) return;

//     this.currentRoom.localParticipant.videoTracks.forEach((publication) => {
//       if (publication.track) {
//         if (publication.track.isEnabled) {
//           publication.track.disable();
//         } else {
//           publication.track.enable();
//         }
//       }
//     });
//   }

//   // toggleVideo(): void {
//   //   if (!this.currentRoom) return;

//   //   const videoTrack = Array.from(
//   //     this.currentRoom.localParticipant.videoTracks.values()
//   //   )[0];
//   //   if (videoTrack?.track) {
//   //     const isEnabled = videoTrack.track.isEnabled;
//   //     videoTrack.track.enable(!isEnabled);
//   //   }
//   // }

//   async toggleScreenShare(enable: boolean): Promise<boolean> {
//     if (!this.currentRoom) return false;

//     try {
//       if (enable) {
//         if (this.activeScreenShare) {
//           this.activeScreenShare.stop();
//         }

//         const stream = await navigator.mediaDevices.getDisplayMedia({
//           video: true,
//         });

//         const screenTrack = new LocalVideoTrack(stream.getVideoTracks()[0]);
//         this.activeScreenShare = screenTrack;

//         await this.currentRoom.localParticipant.publishTrack(screenTrack);
//         return true;
//       } else if (this.activeScreenShare) {
//         await this.currentRoom.localParticipant.unpublishTrack(
//           this.activeScreenShare
//         );
//         this.activeScreenShare.stop();
//         this.activeScreenShare = null;
//         return false;
//       }

//       return false;
//     } catch (error) {
//       console.error("Screen sharing failed:", error);
//       return false;
//     }
//   }

//   // async toggleScreenShare(enable: boolean): Promise<boolean> {
//   //   if (enable) {
//   //     const screenTrack = await this.startScreenShare();
//   //     this.currentRoom?.localParticipant.publishTrack(screenTrack);
//   //     return true;
//   //   } else {
//   //     await this.stopScreenShare();
//   //     return false;
//   //   }
//   // }

//   private async startScreenShare(): Promise<LocalVideoTrack> {
//     const stream = await navigator.mediaDevices.getDisplayMedia({
//       video: { frameRate: 15, width: 1280, height: 720 },
//     });
//     return new LocalVideoTrack(stream.getVideoTracks()[0]);
//   }

//   private async stopScreenShare() {
//     this.activeScreenShare?.stop();
//     this.activeScreenShare = null;
//   }

//   startQualityMonitoring(
//     onQualityUpdate: (quality: CallQuality) => void
//   ): void {
//     this.stopQualityMonitoring();
//     this.qualityMonitorInterval = setInterval(async () => {
//       if (!this.currentRoom) return;

//       try {
//         const stats = await this.currentRoom!.getStats();
//         // const quality = this.processStats(stats);
//         const quality = this.processStats(
//           stats as unknown as ExtendedStatsReport[]
//         );
//         onQualityUpdate(quality);
//       } catch (error) {
//         console.error("Error monitoring call quality:", error);
//       }
//     }, 1000);
//   }

//   private processStats(stats: StatsReport[]): CallQuality {
//     const quality: CallQuality = {
//       audio: { bitrate: 0, packetsLost: 0, roundTripTime: 0 },
//       timestamp: Date.now(),
//     };

//     stats.forEach((report) => {
//       const r = report as unknown as ExtendedStatsReport;
//       if (r.type === "remote-inbound-rtp") {
//         quality.audio.bitrate = r.bitrate || 0;
//         quality.audio.packetsLost = r.packetsLost || 0;
//         quality.audio.roundTripTime = r.roundTripTime || 0;

//         if (r.kind === "video") {
//           quality.video = {
//             bitrate: r.bitrate || 0,
//             packetsLost: r.packetsLost || 0,
//             frameRate: r.framesPerSecond || 0,
//             resolution: {
//               width: r.frameWidth || 0,
//               height: r.frameHeight || 0,
//             },
//           };
//         }
//       }
//     });

//     return quality;
//   }

//   private stopQualityMonitoring() {
//     if (this.qualityMonitorInterval) {
//       clearInterval(this.qualityMonitorInterval);
//       this.qualityMonitorInterval = null;
//     }
//   }

//   handleDisconnect(): void {
//     this.stopQualityMonitoring();
//     if (this.currentRoom) {
//       this.currentRoom.disconnect();
//       this.currentRoom = null;
//     }

//     if (this.qualityMonitorInterval) {
//       clearInterval(this.qualityMonitorInterval);
//       this.qualityMonitorInterval = null;
//     }

//     if (this.activeScreenShare) {
//       this.activeScreenShare.stop();
//       this.activeScreenShare = null;
//     }
//   }
// }
