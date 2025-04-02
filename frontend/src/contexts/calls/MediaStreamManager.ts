import { useState, useEffect, useCallback, useRef } from "react";
import { CallType } from "../../types";
import {
  LocalAudioTrack,
  LocalVideoTrack,
  LocalTrack,
  createLocalTracks,
} from "twilio-video";

type MediaStreamManager = {
  localTracks: LocalTrack[];
  getMediaPermissions: (callType?: CallType) => Promise<{
    success: boolean;
    tracks: (LocalAudioTrack | LocalVideoTrack)[];
  }>;
  toggleAudio: (enabled: boolean) => void;
  toggleVideo: (enabled: boolean) => void;
  toggleScreenShare: (enabled: boolean) => Promise<void>;
  startAudioTracks: () => Promise<void>;
  stopAllTracks: () => void;
  updateMediaState: (
    payload: Partial<{ audioEnabled?: boolean; videoEnabled?: boolean }>
  ) => void;
};

export function useMediaStreamManager(
  updateMediaState: (
    media: Partial<{ audioEnabled: boolean; videoEnabled: boolean }>
  ) => void,
  callType?: CallType,
  selectedAudioInput?: string,
  selectedVideoInput?: string
): MediaStreamManager {
  const [localTracks, setLocalTracks] = useState<LocalTrack[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const getMediaPermissions = async (callType?: CallType) => {
    try {
      await navigator.mediaDevices.enumerateDevices();

      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: selectedAudioInput
            ? { exact: selectedAudioInput }
            : undefined,
          echoCancellation: true,
          noiseSuppression: true,
        },
        video:
          callType === CallType.VIDEO
            ? {
                deviceId: selectedVideoInput
                  ? { exact: selectedVideoInput }
                  : undefined,
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 24 },
              }
            : false,
      };

      let tracks;
      try {
        tracks = await createLocalTracks(constraints);
        tracks.forEach((track) => track.enable());
      } catch (error) {
        console.error("Initial track creation failed, trying fallback");
        //fallback to default devices
        tracks = await createLocalTracks({
          audio: true,
          video: callType === CallType.VIDEO,
        });
      }

      //validating tracks were created and are functional
      // const isLocalAudioTrack = (track: LocalTrack): track is LocalAudioTrack =>
      //   track.kind === "audio";

      // const isLocalVideoTrack = (track: LocalTrack): track is LocalVideoTrack =>
      //   track.kind === "video";

      // const audioTrack = tracks.find(isLocalAudioTrack);
      // const videoTrack = tracks.find(isLocalVideoTrack);

      //testing audio track by checking readyState
      // if (audioTrack) {
      //   console.log(
      //     "Audio track created successfully:",
      //     audioTrack.isEnabled,
      //     audioTrack.mediaStreamTrack?.readyState
      //   );
      // } else {
      //   console.warn("No audio track was created");
      // }

      //testing video track by checking dimensions
      // if (videoTrack && videoTrack.dimensions) {
      //   console.log(
      //     "Video track created successfully:",
      //     videoTrack.isEnabled,
      //     videoTrack.dimensions,
      //     videoTrack.mediaStreamTrack?.readyState
      //   );
      // } else if (callType === CallType.VIDEO) {
      //   console.warn("Video track missing or has no dimensions");
      // }

      //updating state based on track availability
      
      updateMediaState({
        audioEnabled: tracks.some(
          (track) => track.kind === "audio" && track.isEnabled
        ),
        videoEnabled: tracks.some(
          (track) => track.kind === "video" && track.isEnabled
        ),
      });

      //filteringg to only media tracks and store them
      const mediaTracks = tracks.filter(
        (track): track is LocalAudioTrack | LocalVideoTrack =>
          ["audio", "video"].includes(track.kind)
      );

      setLocalTracks(mediaTracks);
      return { success: true, tracks: mediaTracks };
    } catch (error) {
      console.error("Media permissions failed");
      return { success: false, tracks: [] };
    }
  };

  const startAudioTracks = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      updateMediaState({ audioEnabled: true });
    } catch (error) {
      console.error("Failed to start audio");
    }
  };

  const stopAllTracks = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((track: MediaStreamTrack) => {
      track.stop();
    });
    mediaStreamRef.current = null;
    updateMediaState({ audioEnabled: false, videoEnabled: false });
  }, [updateMediaState]);

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
        console.error("Screen share failed");
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
      stopAllTracks();
    };
  }, [localTracks, stopAllTracks]);

  return {
    localTracks,
    getMediaPermissions: (callType?: CallType) => getMediaPermissions(callType),
    startAudioTracks,
    stopAllTracks,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    updateMediaState,
  };
}
