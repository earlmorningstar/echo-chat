import { useState, useEffect, useCallback } from "react";
import {
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

  const toggleAudio = useCallback(
    (enabled: boolean) => {
      localTracks
        .filter((track) => track.kind === "audio")
        .forEach((track) => (track.isEnabled = enabled));
      updateMediaState({ audioEnabled: enabled });
    },
    [localTracks, updateMediaState]
  );

  const toggleVideo = useCallback(
    (enabled: boolean) => {
      localTracks
        .filter((track) => track.kind === "video")
        .forEach((track) => (track.isEnabled = enabled));
      updateMediaState({ videoEnabled: enabled });
    },
    [localTracks, updateMediaState]
  );

  const toggleScreenShare = useCallback(async (enabled: boolean) => {
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
  }, []);

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
