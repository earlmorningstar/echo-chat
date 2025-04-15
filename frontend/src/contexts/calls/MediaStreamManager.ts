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
    payload: Partial<{
      audioEnabled?: boolean;
      videoEnabled?: boolean;
      screenShareEnabled?: boolean;
    }>
  ) => void;
};

export function useMediaStreamManager(
  updateMediaState: (
    media: Partial<{
      audioEnabled: boolean;
      videoEnabled: boolean;
      screenShareEnabled?: boolean;
    }>
  ) => void,
  callType?: CallType,
  selectedAudioInput?: string,
  selectedVideoInput?: string
): MediaStreamManager {
  const [localTracks, setLocalTracks] = useState<LocalTrack[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const getMediaPermissions = useCallback(
    async (callType?: CallType) => {
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
    },
    [selectedAudioInput, selectedVideoInput, updateMediaState]
  );

  const startAudioTracks = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      //creating a local audio track
      const audioTrack = await createLocalAudioTrack({
        // resist from passing mediaStreamTrack directly
        deviceId: stream.getAudioTracks()[0].getSettings().deviceId,
      });

      setLocalTracks((prev) => [...prev, audioTrack]);
      updateMediaState({ audioEnabled: true });
    } catch (error) {
      console.error("Failed to start audio", error);
    }
  };

  const stopAllTracks = useCallback(() => {
    //using functional updates and track references
    setLocalTracks((prevTracks) => {
      //stop existing tracks
      prevTracks.forEach((track) => track.stop());

      //stop media stream tracks
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }

      updateMediaState({
        audioEnabled: false,
        videoEnabled: false,
        screenShareEnabled: false,
      });

      return []; //empty array to clear tracks
    });
  }, [updateMediaState]);

  const toggleAudio = useCallback(
    (enabled: boolean) => {
      //checking if the state is already what we want it to be
      const audioTracks = localTracks.filter(
        (track): track is LocalAudioTrack => track.kind === "audio"
      );

      //don't take any action if we already have the desired state
      if (audioTracks.length > 0 && audioTracks[0].isEnabled === enabled) {
        return; //preventing unnecessary updates
      }

      let audioTrackExists = false;

      //handling existing audio tracks
      localTracks
        .filter((track): track is LocalAudioTrack => track.kind === "audio")
        .forEach((track) => {
          audioTrackExists = true;
          if (enabled) {
            track.enable();
          } else {
            track.disable();
          }
        });

      //create audio tracks if there are no audio tracks and we want to enable audio,
      if (!audioTrackExists && enabled) {
        createLocalAudioTrack().then((newTrack) => {
          newTrack.enable();
          setLocalTracks((prev) => [...prev, newTrack]);
        });
      }

      updateMediaState({ audioEnabled: enabled });
    },
    [localTracks, updateMediaState]
  );

  const toggleVideo = useCallback(
    (enabled: boolean) => {
      const videoTracks = localTracks.filter(
        (track): track is LocalVideoTrack =>
          track.kind === "video" && track.name !== "screen-share"
      );

      //preventing unnecessary updates
      if (videoTracks.length > 0 && videoTracks[0].isEnabled === enabled) {
        return;
      }

      let videoTrackExists = false;

      //handling existing video tracks (excluding screen share)
      localTracks
        .filter(
          (track): track is LocalVideoTrack =>
            track.kind === "video" && track.name !== "screen-share"
        )
        .forEach((track) => {
          videoTrackExists = true;
          if (enabled) {
            track.enable();
          } else {
            track.disable();
          }
        });

      //create video tracks if there are no video tracks and we want to enable video,
      if (!videoTrackExists && enabled) {
        createLocalVideoTrack().then((newTrack) => {
          newTrack.enable();
          setLocalTracks((prev) => [...prev, newTrack]);
        });
      }

      updateMediaState({ videoEnabled: enabled });
    },
    [localTracks, updateMediaState]
  );

  const toggleScreenShare = useCallback(
    async (enabled: boolean): Promise<void> => {
      try {
        //remove any existing screen share tracks
        const existingScreenTracks = localTracks.filter(
          (track) => track.name === "screen-share"
        );

        if (existingScreenTracks.length > 0) {
          existingScreenTracks.forEach((track) => track.stop());
          setLocalTracks((prev) =>
            prev.filter((track) => track.name !== "screen-share")
          );
        }

        //addind a new screen share track if enabled
        if (enabled) {
          const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: false,
          });

          //adding event listener for when user stops sharing via browser UI
          screenStream.getVideoTracks()[0].addEventListener("ended", () => {
            //cleaning up screen share when user stops it via browser UI
            setLocalTracks((prev) =>
              prev.filter((track) => track.name !== "screen-share")
            );
            updateMediaState({ screenShareEnabled: false });
          });

          const screenTrack = new LocalVideoTrack(
            screenStream.getVideoTracks()[0],
            {
              name: "screen-share",
              logLevel: "error" as const,
            }
          );

          setLocalTracks((prev) => [...prev, screenTrack]);
          updateMediaState({ screenShareEnabled: true });
        } else {
          updateMediaState({ screenShareEnabled: false });
        }
      } catch (error) {
        console.error("Screen share toggle failed:", error);
        updateMediaState({ screenShareEnabled: false });
      }
    },
    [localTracks, updateMediaState]
  );

  useEffect(() => {
    return () => {
      // localTracks.forEach((track) => track.stop());
      stopAllTracks();
    };
  }, [stopAllTracks]);

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
