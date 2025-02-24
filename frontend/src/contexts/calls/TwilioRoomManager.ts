import {
  Room,
  connect,
  LocalTrack,
  LocalAudioTrack,
  LocalVideoTrack,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  StatsReport,
} from "twilio-video";
import api from "../../utils/api";
import { CallQuality } from "../../types";
import { CallStateManager } from "./CallStateManager";

interface ExtendedStatsReport extends StatsReport {
  type: string;
  bitrate?: number;
  packetsLost?: number;
  roundTripTime?: number;
  kind?: string;
  framesPerSecond?: number;
  frameWidth?: number;
  frameHeight?: number;
}

export class TwilioRoomManager {
  private currentRoom: Room | null = null;
  private qualityMonitorInterval: NodeJS.Timeout | null = null;
  private stateManager: CallStateManager;

  constructor(stateManager: CallStateManager) {
    this.stateManager = stateManager;
  }

  async connectToRoom(
    roomName: string,
    mediaStreamTracks: MediaStreamTrack[]
  ): Promise<Room> {
    if (mediaStreamTracks.length === 0) {
      throw new EvalError("No media track available");
    }

    const token = await this.getTwilioToken(roomName);

    // Convert MediaStreamTracks to Twilio LocalTracks
    const localTracks = await this.createLocalTracks(mediaStreamTracks);

    const room = await connect(token, {
      name: roomName,
      tracks: localTracks,
      networkQuality: { local: 1, remote: 1 },
    });

    this.setupRoomEventHandlers(room);
    this.currentRoom = room;
    return room;
  }

  private setupRoomEventHandlers(room: Room) {
    room.on("disconnected", () => {
      this.handleRoomDisconnect();
    });

    room.on("participantConnected", (participant) => {
      this.handleParticipantConnected(participant);
    });
  }

  private handleTrackSubscribed(track: RemoteTrack) {
    const remoteStream = new MediaStream();

    if (track.kind === "audio" || track.kind === "video") {
      remoteStream.addTrack(track.mediaStreamTrack);
      this.stateManager.transition({
        remoteStream,
      });
    }
  }

  private handleParticipantConnected(participant: RemoteParticipant) {
    participant.tracks.forEach((publication: RemoteTrackPublication) => {
      if (publication.track && publication.isSubscribed) {
        this.handleTrackSubscribed(publication.track);
      }
    });

    participant.on("trackSubscribed", (track: RemoteTrack) => {
      this.handleTrackSubscribed(track);
    });
  }

  private handleRoomDisconnect() {
    this.stopQualityMonitoring();
    this.currentRoom = null;
  }

  private async createLocalTracks(
    mediaStreamTracks: MediaStreamTrack[]
  ): Promise<LocalTrack[]> {
    const localTracks: LocalTrack[] = [];

    for (const track of mediaStreamTracks) {
      if (track.kind === "audio") {
        localTracks.push(new LocalAudioTrack(track));
      } else if (track.kind === "video") {
        localTracks.push(new LocalVideoTrack(track));
      }
    }

    return localTracks;
  }

  toggleAudio(): void {
    if (!this.currentRoom) return;

    const audioTrack = Array.from(
      this.currentRoom.localParticipant.audioTracks.values()
    )[0];
    if (audioTrack?.track) {
      const isEnabled = audioTrack.track.isEnabled;
      audioTrack.track.enable(!isEnabled);
    }
  }

  toggleVideo(): void {
    if (!this.currentRoom) return;

    const videoTrack = Array.from(
      this.currentRoom.localParticipant.videoTracks.values()
    )[0];
    if (videoTrack?.track) {
      const isEnabled = videoTrack.track.isEnabled;
      videoTrack.track.enable(!isEnabled);
    }
  }

  async toggleScreenShare(enable: boolean): Promise<boolean> {
    if (!this.currentRoom) return false;

    try {
      if (enable) {
        const screenTrack = await this.createScreenShareTrack();
        await this.currentRoom.localParticipant.publishTrack(screenTrack);
        return true;
      } else {
        this.currentRoom.localParticipant.videoTracks.forEach((publication) => {
          if (publication.track.name.includes("screen")) {
            publication.track.stop();
            this.currentRoom?.localParticipant.unpublishTrack(
              publication.track
            );
          }
        });
        return false;
      }
    } catch (error) {
      console.error("Error toggling screen share:", error);
      return false;
    }
  }

  private async createScreenShareTrack(): Promise<LocalVideoTrack> {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 15, width: 1280, height: 720 },
    });
    const [screenTrack] = stream.getVideoTracks();
    return new LocalVideoTrack(screenTrack, { name: "screen-share" });
  }

  private async getTwilioToken(roomName: string): Promise<string> {
    const response = await api.post("/api/call/token", { roomName });
    return response.data.token;
  }

  disconnectFromRoom(): void {
    if (this.currentRoom) {
      this.currentRoom.disconnect();
      this.currentRoom = null;
    }
    this.stopQualityMonitoring();
  }

  // startQualityMonitoring(onQualityUpdate: (quality: any) => void): void {
  //   if (!this.currentRoom) return;

  //   this.qualityMonitorInterval = setInterval(async () => {
  //     try {
  //       const stats = await this.currentRoom?.getStats();
  //       onQualityUpdate(stats);
  //     } catch (error) {
  //       console.error("Error monitoring call quality:", error);
  //     }
  //   }, 1000);
  // }

  startQualityMonitoring(
    onQualityUpdate: (quality: CallQuality) => void
  ): void {
    if (!this.currentRoom) return;

    this.qualityMonitorInterval = setInterval(async () => {
      try {
        const stats = await this.currentRoom!.getStats();
        // const quality = this.processStats(stats);
        const quality = this.processStats(
          stats as unknown as ExtendedStatsReport[]
        );
        onQualityUpdate(quality);
      } catch (error) {
        console.error("Error monitoring call quality:", error);
      }
    }, 1000);
  }

  private processStats(stats: StatsReport[]): CallQuality {
    const quality: CallQuality = {
      audio: { bitrate: 0, packetsLost: 0, roundTripTime: 0 },
      timestamp: Date.now(),
    };

    stats.forEach((report) => {
      const r = report as unknown as ExtendedStatsReport;
      if (r.type === "remote-inbound-rtp") {
        quality.audio.bitrate = r.bitrate || 0;
        quality.audio.packetsLost = r.packetsLost || 0;
        quality.audio.roundTripTime = r.roundTripTime || 0;

        if (r.kind === "video") {
          quality.video = {
            bitrate: r.bitrate || 0,
            packetsLost: r.packetsLost || 0,
            frameRate: r.framesPerSecond || 0,
            resolution: {
              width: r.frameWidth || 0,
              height: r.frameHeight || 0,
            },
          };
        }
      }
    });

    return quality;
  }

  private stopQualityMonitoring(): void {
    if (this.qualityMonitorInterval) {
      clearInterval(this.qualityMonitorInterval);
      this.qualityMonitorInterval = null;
    }
  }
}
