import { CallType } from "../../types";

export class MediaStreamManager {
  private streams: {
    local: MediaStream | null;
    remote: MediaStream | null;
  } = { local: null, remote: null };

  async setupLocalStream(type: CallType): Promise<MediaStream> {
    await this.cleanupLocalStream();
    
    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: type === "video" ? {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 }
      } : false
    };
  
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      console.error("Media access error:", error);
      throw new Error("Error accessing media devices");
    }
  }

  async cleanupLocalStream(): Promise<void> {
    if (this.streams.local) {
      this.streams.local.getTracks().forEach((track) => {
        track.stop();
        this.streams.local?.removeTrack(track);
      });
      this.streams.local = null;
    }
  }

  async cleanupRemoteStream(): Promise<void> {
    if (this.streams.remote) {
      this.streams.remote.getTracks().forEach((track) => {
        track.stop();
        this.streams.remote?.removeTrack(track);
      });
      this.streams.remote = null;
    }
  }

  updateRemoteStream(stream: MediaStream): void {
    this.streams.remote = stream;
  }

  getStreams() {
    return this.streams;
  }
}
