import { CallType } from "../../types";

export class MediaStreamManager {
  private streams: {
    local: MediaStream | null;
    remote: MediaStream | null;
  } = { local: null, remote: null };

  async setupLocalStream(type: CallType): Promise<MediaStream> {
    try {
      await this.cleanupLocalStream();
      const constraints = {
        audio: true,
        video: type === "video" ? { facingMode: "user" } : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.streams.local = stream;
      return stream;
    } catch (error) {
      console.error("Error accessing media devices:", error);
      throw error;
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
