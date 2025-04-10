import { useState, useEffect, useCallback, useRef } from "react";
import { CallType } from "../../types";
import {
  LocalAudioTrack,
  LocalVideoTrack,
  LocalTrack,
  createLocalTracks,
  createLocalAudioTrack,
  createLocalVideoTrack,
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
        .filter((track): track is LocalAudioTrack => track.kind === "audio")
        .forEach((track) => {
          if (enabled) {
            createLocalAudioTrack().then((newTrack) => {
              track.stop();
              setLocalTracks((prev) => [
                ...prev.filter((t) => t !== track),
                newTrack,
              ]);
            });
          } else {
            track.stop();
          }
        });
      updateMediaState({ audioEnabled: enabled });
    },
    [localTracks, updateMediaState]
  );

  const toggleVideo = useCallback(
    (enabled: boolean) => {
      localTracks
        .filter((track): track is LocalVideoTrack => track.kind === "video")
        .forEach((track) => {
          if (enabled) {
            createLocalVideoTrack().then((newTrack) => {
              track.stop();
              setLocalTracks((prev) => [
                ...prev.filter((t) => t !== track),
                newTrack,
              ]);
            });
          } else {
            track.stop();
          }
        });
      updateMediaState({ videoEnabled: enabled });
    },
    [localTracks, updateMediaState]
  );

  const toggleScreenShare = useCallback(
    async (enabled: boolean): Promise<void> => {
      if (enabled) {
        try {
          const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          });

          const screenTrack = new LocalVideoTrack(
            screenStream.getVideoTracks()[0],
            {
              name: "screen-share",
              logLevel: "error" as const,
            }
          );

          setLocalTracks((prev) => [...prev, screenTrack]);
        } catch (error) {
          console.error("Screen share failed:", error);
        }
      } else {
        setLocalTracks((prev) =>
          prev.filter((track) => {
            const remove = track.name === "screen-share";
            if (remove) track.stop();
            return !remove;
          })
        );
      }
    },
    []
  );

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
