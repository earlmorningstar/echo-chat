import React, { useEffect, useRef, useState } from "react";
import { useCall } from "../contexts/CallContext";
import { useAuth } from "../contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import api from "../utils/api";
import { AuthUser } from "../types";
import * as TwilioVideo from "twilio-video";
import { LocalTrack } from "../types/twilio";
// import { TwilioVoice } from "../types/calls";
import {
  Mic,
  MicOff,
  Videocam,
  VideocamOff,
  CallEnd,
  ScreenShare,
  StopScreenShare,
} from "@mui/icons-material";
import { Snackbar, Alert } from "@mui/material";

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
  const [audioNotification, setAudioNotification] = useState<{
    open: boolean;
    muted: boolean;
    userId: string | null;
  }>({
    open: false,
    muted: false,
    userId: null,
  });

  const [videoNotification, setVideoNotification] = useState<{
    open: boolean;
    paused: boolean;
    userId: string | null;
  }>({
    open: false,
    paused: false,
    userId: null,
  });

  const isInitiator = callState.currentCall.initiator === user?._id;
  const remoteUserId = isInitiator
    ? callState.currentCall.recipientId
    : callState.currentCall.initiator || callState.incomingCall.callerId;

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

  //monitor when remote participant's audio track changes
  useEffect(() => {
    if (!participants.length) return;

    const handleAudioEnabled = (track: TwilioVideo.RemoteAudioTrack) => {
      const participant = participants.find((p) =>
        Array.from(p.audioTracks.values()).some((pub) => pub.track === track)
      );

      if (participant) {
        setAudioNotification({
          open: true,
          muted: false,
          userId: participant.identity,
        });

        setTimeout(() => {
          setAudioNotification((prev) => ({ ...prev, open: false }));
        }, 5000);
      }
    };

    const handleAudioDisabled = (track: TwilioVideo.RemoteAudioTrack) => {
      const participant = participants.find((p) =>
        Array.from(p.audioTracks.values()).some((pub) => pub.track === track)
      );

      if (participant) {
        setAudioNotification({
          open: true,
          muted: true,
          userId: participant.identity,
        });

        setTimeout(() => {
          setAudioNotification((prev) => ({ ...prev, open: false }));
        }, 5000);
      }
    };

    //monitor when video track changes
    const handleVideoEnabled = (track: TwilioVideo.RemoteVideoTrack) => {
      const participant = participants.find((p) =>
        Array.from(p.videoTracks.values()).some((pub) => pub.track === track)
      );

      if (participant) {
        setVideoNotification({
          open: true,
          paused: false,
          userId: participant.identity,
        });

        setTimeout(() => {
          setVideoNotification((prev) => ({ ...prev, open: false }));
        }, 5000);
      }
    };

    const handleVideoDisabled = (track: TwilioVideo.RemoteVideoTrack) => {
      const participant = participants.find((p) =>
        Array.from(p.videoTracks.values()).some((pub) => pub.track === track)
      );

      if (participant) {
        setVideoNotification({
          open: true,
          paused: true,
          userId: participant.identity,
        });

        setTimeout(() => {
          setVideoNotification((prev) => ({ ...prev, open: false }));
        }, 5000);
      }
    };

    //listeners to all participants' tracks
    participants.forEach((participant) => {
      participant.audioTracks.forEach((publication) => {
        if (publication.track) {
          publication.track.on("enabled", handleAudioEnabled);
          publication.track.on("disabled", handleAudioDisabled);
        }
      });

      participant.videoTracks.forEach((publication) => {
        if (publication.track) {
          publication.track.on("enabled", handleVideoEnabled);
          publication.track.on("disabled", handleVideoDisabled);
        }
      });
    });

    //to clean up listeners when component unmounts or participants change
    return () => {
      participants.forEach((participant) => {
        participant.audioTracks.forEach((publication) => {
          if (publication.track) {
            publication.track.off("enabled", handleAudioEnabled);
            publication.track.off("disabled", handleAudioDisabled);
          }
        });

        participant.videoTracks.forEach((publication) => {
          if (publication.track) {
            publication.track.off("enabled", handleVideoEnabled);
            publication.track.off("disabled", handleVideoDisabled);
          }
        });
      });
    };
  }, [participants]);

  //to monitor voice call event
  useEffect(() => {
    if (!callManager.voiceDevice) return;

    const voiceDevice = callManager.voiceDevice;
    let activeConnection = voiceDevice.activeConnection?.();

    if (!activeConnection) return;

    const handleDisconnect = () => {
      endCall();
    };

    const handleMute = () => {
      setAudioNotification({
        open: true,
        muted: true,
        userId: remoteUserId,
      });

      setTimeout(() => {
        setAudioNotification((prev) => ({ ...prev, open: false }));
      }, 5000);
    };

    const handleUnmute = () => {
      setAudioNotification({
        open: true,
        muted: false,
        userId: remoteUserId,
      });

      setTimeout(() => {
        setAudioNotification((prev) => ({ ...prev, open: false }));
      }, 5000);
    };

    //type assertions to ensure TypeScript recognizes these event
    (activeConnection as any).on("disconnect", handleDisconnect);
    (activeConnection as any).on("mute", handleMute);
    (activeConnection as any).on("unmute", handleUnmute);

    return () => {
      if (activeConnection) {
        (activeConnection as any).off("disconnect", handleDisconnect);
        (activeConnection as any).off("mute", handleMute);
        (activeConnection as any).off("unmute", handleUnmute);
      }
    };
  }, [callManager.voiceDevice, endCall, remoteUserId]);

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

  //handling audio toggle for both video and voice calls
  const handleAudioToggle = () => {
    toggleAudio(!callState.localMedia.audioEnabled);

    //for voice calls, the active connection needs to mute and unmute
    if (callState.currentCall.type === "voice" && callManager.voiceDevice) {
      const activeConnection = callManager.voiceDevice.activeConnection?.();
      if (activeConnection) {
        if (callState.localMedia.audioEnabled) {
          (activeConnection as any).mute();
        } else {
          (activeConnection as any).unmute();
        }
      }
    }
  };

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
                      track.kind === "video" && track.name !== "screen-share"
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
            onClick={handleAudioToggle}
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

      {/*snackbar for audio notification*/}
      <Snackbar
        open={audioNotification.open}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        autoHideDuration={5000}
        onClose={() =>
          setAudioNotification((prev) => ({ ...prev, open: false }))
        }
      >
        <Alert
          severity={audioNotification.muted ? "info" : "success"}
          sx={{ width: "100%" }}
        >
          {remoteUser && audioNotification.muted
            ? `${remoteUser.firstName}'s microphone is muted`
            : `${remoteUser?.firstName}'s microphone is unmuted`}
        </Alert>
      </Snackbar>

      {/*snackbar for video */}
      <Snackbar
        open={videoNotification.open}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        autoHideDuration={5000}
        onClose={() =>
          setVideoNotification((prev) => ({ ...prev, open: false }))
        }
      >
        <Alert
          severity={videoNotification.paused ? "info" : "success"}
          sx={{ width: "100%" }}
        >
          {remoteUser && videoNotification.paused
            ? `${remoteUser.firstName}'s camera is paused`
            : `${remoteUser?.firstName}'s camera is active`}
        </Alert>
      </Snackbar>
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
