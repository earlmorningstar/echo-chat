import React, { useEffect, useRef } from "react";
import { useCall } from "../contexts/CallContext";
import { useAuth } from "../contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import api from "../utils/api";
import { AuthUser } from "../types";
import * as TwilioVideo from "twilio-video";
import { LocalTrack } from "../types/twilio";
import { TwilioVoice } from "../types/calls";
import {
  Mic,
  MicOff,
  Videocam,
  VideocamOff,
  CallEnd,
  ScreenShare,
  StopScreenShare,
} from "@mui/icons-material";

const CallInterface: React.FC = () => {
  const {
    callState,
    endCall,
    callManager,
    participants,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    mediaControls,
  } = useCall();
  const { user } = useAuth();

  const isInitiator = callState.currentCall.initiator === user?._id;
  const remoteUserId = isInitiator
    ? callState.currentCall.recipientId
    : callState.currentCall.initiator;

  const { data: remoteUser } = useQuery({
    queryKey: ["user", remoteUserId],
    queryFn: async () => {
      if (!remoteUserId) throw new Error("No user ID available");

      const response = await api.get(`/api/user/${remoteUserId}`);
      return response.data.user as AuthUser;
    },
    enabled: !!remoteUserId,
    staleTime: 60000,
  });

  useEffect(() => {
    const tracks = mediaControls?.localTracks || [];
    return () => {
      //cleaning up media tracks on unmount
      tracks.forEach((track: LocalTrack) => {
        if (track.kind === "audio" || track.kind === "video") {
          track.stop();
          track.detach().forEach((element) => element.remove());
        }
      });
    };
  }, [mediaControls?.localTracks]);

  useEffect(() => {
    if (!callManager.voiceDevice) return;

    const voiceDevice = callManager.voiceDevice;
    let activeConnection: TwilioVoice.Connection | undefined;

    const handleDisconnect = () => {
      endCall();
    };

    // Get active connection properly
    if (voiceDevice.activeConnection) {
      activeConnection = voiceDevice.activeConnection();
    }

    if (activeConnection) {
      activeConnection.on("disconnect", handleDisconnect);
    }

    return () => {
      activeConnection?.off("disconnect", handleDisconnect);
    };
  }, [callManager.voiceDevice, endCall]);

  useEffect(() => {
    if (callManager.videoDevice) {
      const handleDisconnect = () => {
        if (callManager.videoDevice?.state !== "disconnected") {
          endCall();
        }
      };

      callManager.videoDevice.on("disconnected", handleDisconnect);
      return () => {
        callManager.videoDevice?.off("disconnected", handleDisconnect);
      };
    }
  }, [callManager.videoDevice, endCall]);

  if (
    !callState.currentCall.id ||
    callState.currentCall.status === "rejected"
  ) {
    return null;
  }

  return (
    <div className="call-interface">
      <div className="call-header">
        <div className="caller-info">
          {remoteUser && (
            <div className="remote-user-info">
              <div className="avatar-container">
                {remoteUser.avatarUrl ? (
                  <img
                    src={remoteUser.avatarUrl}
                    alt={`${remoteUser.firstName} ${remoteUser.lastName}`}
                    className="avatar"
                  />
                ) : (
                  <div className="avatar-fallback">
                    <span>
                      {remoteUser.firstName?.[0]}
                      {remoteUser.lastName?.[0]}
                    </span>
                  </div>
                )}
              </div>
              <h3 className="caller-name">
                {remoteUser.firstName} {remoteUser.lastName}
              </h3>
            </div>
          )}
          <span id="call-status" className="call-type">
            {callState.currentCall.status === "connected"
              ? "Connected"
              : "Connecting..."}
          </span>
        </div>
      </div>
      <div className="vid-container-and-controls-flex">
        <div className="video-container">
          {callState.currentCall.type === "video" && (
            <>
              <div id="remote-media-container" className="remote-video-wrapper">
                {participants.map((participant) =>
                  Array.from(participant.videoTracks.values()).map(
                    (publication) =>
                      publication.track && (
                        <MediaTrack
                          key={publication.trackSid}
                          track={publication.track}
                        />
                      )
                  )
                )}
              </div>

              <div id="local-media-container" className="local-video-wrapper">
                {mediaControls.localTracks
                  .filter(
                    (track): track is TwilioVideo.LocalVideoTrack =>
                      track.kind === "video" && "dimensions" in track
                  )
                  .slice(0, 1)
                  .map((track) => (
                    <MediaTrack key={track.name} track={track} isLocal />
                  ))}
              </div>
            </>
          )}
        </div>

        <div className="call-controls">
          <button
            onClick={() => toggleAudio(!callState.localMedia.audioEnabled)}
            className={`control-button ${
              callState.localMedia.audioEnabled ? "active" : "inactive"
            }`}
          >
            {callState.localMedia.audioEnabled ? <Mic /> : <MicOff />}
          </button>

          {callState.currentCall.type === "video" && (
            <>
              <button
                onClick={() => toggleVideo(!callState.localMedia.videoEnabled)}
                className={`control-button ${
                  callState.localMedia.videoEnabled ? "active" : "inactive"
                }`}
              >
                {callState.localMedia.videoEnabled ? (
                  <Videocam />
                ) : (
                  <VideocamOff />
                )}
              </button>

              <button
                onClick={() => toggleScreenShare(!callState.isScreenSharing)}
                // disabled={!callState.localMedia.videoEnabled}
                className={`control-button ${
                  callState.isScreenSharing ? "active" : "inactive"
                }`}
              >
                {callState.isScreenSharing ? (
                  <StopScreenShare />
                ) : (
                  <ScreenShare />
                )}
              </button>
            </>
          )}

          <button onClick={endCall} className="control-button end-call">
            <CallEnd />
          </button>
        </div>
      </div>
    </div>
  );
};

type MediaTrackProps = {
  track:
    | TwilioVideo.LocalVideoTrack
    | TwilioVideo.RemoteVideoTrack
    | TwilioVideo.LocalAudioTrack
    | TwilioVideo.RemoteAudioTrack;
  isLocal?: boolean;
};

const MediaTrack: React.FC<MediaTrackProps> = ({ track, isLocal }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    while (ref.current.firstChild) {
      ref.current.removeChild(ref.current.firstChild);
    }

    try {
      const element = track.attach();

      //configuration of element
      if (isLocal && element.tagName.toLowerCase() === "audio") {
        element.muted = true;
      }

      element.classList.add("media-element");
      //adding element to the DOM
      ref.current?.appendChild(element);

      //verifying dimensions after it starts playing (for video elements)
      // if (element.tagName.toLowerCase() === "video") {
      //   const videoElement = element as HTMLVideoElement;
      //   videoElement.addEventListener("playing", () => {
      //     console.log("Video element is playing:", {
      //       width: videoElement.videoWidth,
      //       height: videoElement.videoHeight,
      //       readyState: videoElement.readyState,
      //     });
      //   });
      // }

      return () => {
        const detached = track.detach();
        detached.forEach((el) => el.remove());
      };
    } catch (error) {
      console.error(`MediaTrack failed to attach ${track.kind} track`);
    }
  }, [track, isLocal]);

  return (
    <div ref={ref} className={`media-track ${isLocal ? "local" : "remote"}`} />
  );
};

export default CallInterface;
