import { useState, useEffect } from "react";
import {
  // LocalTrack,
  LocalAudioTrack,
  LocalVideoTrack,
  createLocalTracks,
} from "twilio-video";

type MediaStreamManager = {
  localTracks: (LocalAudioTrack | LocalVideoTrack)[];
  getMediaPermissions: () => Promise<boolean>;
  toggleAudio: (enabled: boolean) => void;
  toggleVideo: (enabled: boolean) => void;
  toggleScreenShare: (enabled: boolean) => Promise<void>;
};

export function useMediaStreamManager(
  updateMediaState: (
    media: Partial<{ audioEnabled: boolean; videoEnabled: boolean }>
  ) => void
): MediaStreamManager {
  const [localTracks, setLocalTracks] = useState<
    (LocalAudioTrack | LocalVideoTrack)[]
  >([]);

  const getMediaPermissions = async () => {
    try {
      const tracks = await createLocalTracks({
        audio: true,
        video: { width: 1280, height: 720 },
      });

      const mediaTracks = tracks.filter(
        (track): track is LocalAudioTrack | LocalVideoTrack =>
          track.kind === "audio" || track.kind === "video"
      );
      setLocalTracks(mediaTracks);
      updateMediaState({ audioEnabled: true, videoEnabled: true });
      return true;
    } catch (error) {
      console.error("Media permission error:", error);
      return false;
    }
  };

  const toggleAudio = (enabled: boolean) => {
    localTracks
      .filter((track) => track.kind === "audio")
      .forEach((track) => (track.isEnabled = enabled));
    updateMediaState({ audioEnabled: enabled });
  };

  const toggleVideo = (enabled: boolean) => {
    localTracks
      .filter((track) => track.kind === "video")
      .forEach((track) => (track.isEnabled = enabled));
    updateMediaState({ videoEnabled: enabled });
  };

  const toggleScreenShare = async (enabled: boolean) => {
    if (enabled) {
      try {
        const screenTrack = await createLocalTracks({
          video: {
            deviceId: "screen",
            frameRate: 15,
            width: 1920,
            height: 1080,
          },
        });

        const videoTracks = screenTrack.filter(
          (track): track is LocalVideoTrack => track.kind === "video"
        );

        setLocalTracks((prev) => [...prev, ...videoTracks]);
      } catch (error) {
        console.error("Screen share failed:", error);
      }
    } else {
      setLocalTracks((prev) =>
        prev.filter(
          (track) => !(track.kind === "video" && track.name.includes("screen"))
        )
      );
    }
  };

  useEffect(() => {
    return () => {
      localTracks.forEach((track) => track.stop());
    };
  }, [localTracks]);

  return {
    localTracks,
    getMediaPermissions,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
  };
}

// import { CallType } from "../../types";

// export class MediaStreamManager {
//   private streams: {
//     local: MediaStream | null;
//     remote: MediaStream | null;
//   } = { local: null, remote: null };

//   async setupLocalStream(type: CallType): Promise<MediaStream> {
//     await this.cleanupLocalStream();

//     try {
//       const constraints = {
//         audio: {
//           echoCancellation: true,
//           noiseSuppression: true,
//           autoGainControl: true,
//         },
//         video:
//           type === "video"
//             ? {
//                 facingMode: "user",
//                 width: { ideal: 1280 },
//                 height: { ideal: 720 },
//               }
//             : false,
//       };

//       const stream = await navigator.mediaDevices.getUserMedia(constraints);
//       return stream;
//     } catch (error) {
//       console.error("Media access error:", error);
//       throw new Error("Permission denied for media access");
//     }
//   }

//   async cleanupLocalStream(): Promise<void> {
//     if (this.streams.local) {
//       this.streams.local.getTracks().forEach((track) => {
//         track.stop();
//         this.streams.local?.removeTrack(track);
//       });
//       this.streams.local = null;
//     }
//   }

//   async cleanupRemoteStream(): Promise<void> {
//     if (this.streams.remote) {
//       this.streams.remote.getTracks().forEach((track) => {
//         track.stop();
//         this.streams.remote?.removeTrack(track);
//       });
//       this.streams.remote = null;
//     }
//   }

//   updateRemoteStream(stream: MediaStream): void {
//     this.streams.remote = stream;
//   }

//   getStreams() {
//     return this.streams;
//   }
// }
