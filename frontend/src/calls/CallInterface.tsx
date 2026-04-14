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
  FlipCameraIos,
  VolumeUp,
  VolumeOff,
  SwapHoriz,
} from "@mui/icons-material";
import { Snackbar } from "@mui/material";

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
    flipCamera,
    setSpeakerEnabled,
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

  // PIP swap state
  const [isSwapped, setIsSwapped] = useState(false);
  const handleSwapPIP = () => setIsSwapped((prev) => !prev);

  const isInitiator = callState.currentCall.initiator === user?._id;
  const remoteUserId = isInitiator
    ? callState.currentCall.recipientId
    : callState.currentCall.initiator;

  // DIAGNOSTIC: Log participant count on every render
  // console.log(
  //   "[CallInterface] Rendering. Active Participants:",
  //   participants.length,
  //   "Call type:",
  //   callState.currentCall.type,
  //   "Call status:",
  //   callState.currentCall.status,
  //   "Local tracks:",
  //   mediaControls.localTracks.length,
  // );

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
        Array.from(p.audioTracks.values()).some((pub) => pub.track === track),
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
        Array.from(p.audioTracks.values()).some((pub) => pub.track === track),
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
        Array.from(p.videoTracks.values()).some((pub) => pub.track === track),
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
        Array.from(p.videoTracks.values()).some((pub) => pub.track === track),
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

  //handling video toggle
  const handleVideoToggle = () => {
    toggleVideo(!callState.localMedia.videoEnabled);
  };

  //handling screen share toggle
  const handleScreenShareToggle = () => {
    toggleScreenShare(!callState.isScreenSharing);
  };

  //handling camera flip
  const handleFlipCamera = async () => {
    try {
      await flipCamera();
    } catch (error) {
      console.error("Camera flip failed:", error);
    }
  };

  //handling speaker toggle
  const handleSpeakerToggle = async () => {
    try {
      await setSpeakerEnabled(!callState.localMedia.speakerEnabled);
    } catch (error) {
      console.error("Speaker toggle failed:", error);
    }
  };

  return (
    <div className="call-interface">
      {/* Full-screen remote video (The Canvas) */}
      <div className="video-canvas">
        {callState.currentCall.type === "video" && (
          <div id="remote-media-container" className="remote-video-canvas">
            {participants.map((participant) => (
              <React.Fragment key={participant.sid}>
                {/* Remote video tracks */}
                {Array.from(participant.videoTracks.values()).map(
                  (publication) =>
                    publication.track && (
                      <MediaTrack
                        key={publication.trackSid}
                        track={publication.track}
                      />
                    ),
                )}
                {/* Remote audio tracks — rendered but invisible, ensures
                    the remote participant's audio plays through speakers */}
                {Array.from(participant.audioTracks.values()).map(
                  (publication) =>
                    publication.track && (
                      <MediaTrack
                        key={publication.trackSid}
                        track={publication.track}
                      />
                    ),
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Voice Call Live State - Center Avatar with Breathing Animation */}
      {callState.currentCall.type === "voice" && remoteUser && (
        <div className="voice-call-live-avatar">
          <div className="avatar-wrapper">
            {remoteUser.avatarUrl ? (
              <img
                src={remoteUser.avatarUrl}
                alt={`${remoteUser.firstName} ${remoteUser.lastName}`}
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
          <div className="voice-call-status">
            {callState.currentCall.status === "connected"
              ? "Connected"
              : "Connecting..."}
          </div>
        </div>
      )}

      {/* Semi-transparent participant overlay (top-left) */}
      <div className="participant-overlay">
        {remoteUser && (
          <div className="participant-badge">
            <div className="participant-avatar">
              {remoteUser.avatarUrl ? (
                <img
                  src={remoteUser.avatarUrl}
                  alt={`${remoteUser.firstName} ${remoteUser.lastName}`}
                  className="avatar-img"
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
            <div className="participant-info">
              <h3 className="participant-name">
                {remoteUser.firstName} {remoteUser.lastName}
              </h3>
              <span className="call-status-badge">
                {callState.currentCall.status === "connected"
                  ? "Connected"
                  : "Connecting..."}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Local video PIP (bottom-right or swapped to full-screen) */}
      {callState.currentCall.type === "video" && (
        <div
          className={`local-video-pip ${isSwapped ? "pip-swapped" : ""}`}
          onClick={handleSwapPIP}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleSwapPIP();
            }
          }}
          aria-label={
            isSwapped ? "Switch to remote view" : "Switch to your view"
          }
        >
          {!isSwapped ? (
            // Default: Local video in PIP
            mediaControls.localTracks
              .filter(
                (track): track is TwilioVideo.LocalVideoTrack =>
                  track.kind === "video" && track.name !== "screen-share",
              )
              .slice(0, 1)
              .map((track) => (
                <MediaTrack key={track.name} track={track} isLocal />
              ))
          ) : (
            // Swapped: Local video becomes full-screen, remote becomes PIP
            <>
              <div className="swapped-local-video-canvas">
                {mediaControls.localTracks
                  .filter(
                    (track): track is TwilioVideo.LocalVideoTrack =>
                      track.kind === "video" && track.name !== "screen-share",
                  )
                  .slice(0, 1)
                  .map((track) => (
                    <MediaTrack key={track.name} track={track} isLocal />
                  ))}
              </div>
              <div className="swapped-remote-pip">
                {participants.map((participant) => (
                  <React.Fragment key={participant.sid}>
                    {Array.from(participant.videoTracks.values()).map(
                      (publication) =>
                        publication.track && (
                          <MediaTrack
                            key={publication.trackSid}
                            track={publication.track}
                          />
                        ),
                    )}
                  </React.Fragment>
                ))}
              </div>
            </>
          )}

          {/* Swap indicator icon */}
          <div className="swap-indicator">
            <SwapHoriz fontSize="small" />
          </div>
        </div>
      )}

      {/* Floating Action Bar (bottom pill-shaped controls) */}
      <div className="action-bar">
        {/* Mute/Unmute */}
        <button
          onClick={handleAudioToggle}
          className={`action-button ${
            callState.localMedia.audioEnabled ? "active" : "inactive"
          }`}
          aria-label={
            callState.localMedia.audioEnabled
              ? "Mute microphone"
              : "Unmute microphone"
          }
        >
          {callState.localMedia.audioEnabled ? <Mic /> : <MicOff />}
        </button>

        {/* Camera Toggle (video calls only) */}
        {callState.currentCall.type === "video" && (
          <>
            <button
              onClick={handleVideoToggle}
              className={`action-button ${
                callState.localMedia.videoEnabled ? "active" : "inactive"
              }`}
              aria-label={
                callState.localMedia.videoEnabled
                  ? "Turn off camera"
                  : "Turn on camera"
              }
            >
              {callState.localMedia.videoEnabled ? (
                <Videocam />
              ) : (
                <VideocamOff />
              )}
            </button>

            {/* Flip Camera */}
            <button
              onClick={handleFlipCamera}
              className="action-button active"
              aria-label="Flip camera"
            >
              <FlipCameraIos />
            </button>

            {/* Speaker Toggle */}
            <button
              onClick={handleSpeakerToggle}
              className={`action-button ${
                callState.localMedia.speakerEnabled ? "active" : "inactive"
              }`}
              aria-label={
                callState.localMedia.speakerEnabled
                  ? "Switch to earpiece"
                  : "Switch to speaker"
              }
            >
              {callState.localMedia.speakerEnabled ? (
                <VolumeUp />
              ) : (
                <VolumeOff />
              )}
            </button>

            {/* Screen Share */}
            <button
              onClick={handleScreenShareToggle}
              className={`action-button ${
                callState.isScreenSharing ? "active" : "inactive"
              }`}
              aria-label={
                callState.isScreenSharing
                  ? "Stop screen sharing"
                  : "Start screen sharing"
              }
            >
              {callState.isScreenSharing ? (
                <StopScreenShare />
              ) : (
                <ScreenShare />
              )}
            </button>
          </>
        )}

        {/* End Call */}
        <button
          onClick={endCall}
          className="action-button end-call"
          aria-label="End call"
        >
          <CallEnd />
        </button>
      </div>

      {/*snackbar for audio notification*/}
      <Snackbar
        open={audioNotification.open}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        autoHideDuration={3000}
        onClose={() =>
          setAudioNotification((prev) => ({ ...prev, open: false }))
        }
        message={
          remoteUser && audioNotification.muted
            ? `${remoteUser.firstName}'s microphone is muted`
            : `${remoteUser?.firstName}'s microphone is unmuted`
        }
      />

      {/*snackbar for video */}
      <Snackbar
        open={videoNotification.open}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        autoHideDuration={3000}
        onClose={() =>
          setVideoNotification((prev) => ({ ...prev, open: false }))
        }
        message={
          remoteUser && videoNotification.paused
            ? `${remoteUser.firstName}'s camera is paused`
            : `${remoteUser?.firstName}'s camera is active`
        }
      />
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
  /** Tracks whether we've already attached this track to avoid double-attach
   *  during re-renders, which causes the "media removed" AbortError. */
  const attachedRef = useRef<string | null>(null);

  useEffect(() => {
    // Don't attach local audio to DOM — causes feedback loop / track-stalled
    // The sender already hears themselves through the mic; we only need
    // to attach local VIDEO so they can see their own camera preview.
    if (isLocal && track.kind === "audio") return;

    // DIAGNOSTIC: Log track health
    // const trackSid = (track as unknown as Record<string, unknown>).sid as
    //   | string
    //   | undefined;
    // console.log(
    //   `[MediaTrack] Attempting to attach ${track.kind} (${track.name}). SID: ${trackSid || "local"}. isEnabled: ${track.isEnabled}`,
    // );

    // Skip if already attached to this ref
    const trackKey = `${track.kind}-${track.name}`;
    if (attachedRef.current === trackKey && ref.current?.firstChild) return;
    attachedRef.current = trackKey;

    if (!ref.current) return;

    // Clear any previously attached elements
    while (ref.current.firstChild) {
      ref.current.removeChild(ref.current.firstChild);
    }

    // If track is disabled or not started, don't attempt to attach/play
    if (!track.isEnabled) return;

    let cancelled = false;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    // Auto-retry on track disabled/stalled — re-attach after 2s
    const handleTrackStalled = () => {
      if (cancelled || !ref.current) return;
      // console.log(
      //   `[MediaTrack] Track ${track.kind} stalled/disabled — re-attaching in 2s...`,
      // );
      retryTimeout = setTimeout(() => {
        if (cancelled || !track.isEnabled) return;
        // Clear and re-attach
        while (ref.current && ref.current.firstChild) {
          ref.current.removeChild(ref.current.firstChild);
        }
        try {
          const els = track.attach() as unknown as HTMLMediaElement[];
          const elList = Array.isArray(els) ? els : [els];
          const el = elList[0];
          if (el && ref.current) {
            if (isLocal) el.muted = true;
            if (el.tagName.toLowerCase() === "video") {
              el.setAttribute("autoplay", "true");
              el.setAttribute("playsinline", "true");
              el.style.width = "100%";
              el.style.height = "100%";
              el.style.objectFit = "cover";
              requestAnimationFrame(() => {
                if (!cancelled && el.isConnected) {
                  el.play().catch(() => {});
                }
              });
            }
            el.classList.add("media-element");
            ref.current.appendChild(el);
          }
        } catch {
          // re-attach failed — give up
        }
      }, 2000);
    };

    // Listen for track stall events (video tracks can go black if hardware is overloaded)
    if (
      "on" in track &&
      typeof (track as TwilioVideo.VideoTrack).on === "function"
    ) {
      (track as TwilioVideo.VideoTrack).on("disabled", handleTrackStalled);
      (track as TwilioVideo.VideoTrack).on("started", () => {
        // console.log(
        //   `[MediaTrack] Track ${track.kind} started — first frame received`,
        // );
      });
    }

    try {
      const elements = track.attach() as unknown as HTMLMediaElement[];
      const elementList = Array.isArray(elements) ? elements : [elements];
      const element = elementList[0];

      if (!element) return;

      // Local video must be muted to prevent feedback/echo
      if (isLocal) {
        element.muted = true;
      }

      // Video elements need explicit autoplay + playsinline or they stall
      if (element.tagName.toLowerCase() === "video") {
        element.setAttribute("autoplay", "true");
        element.setAttribute("playsinline", "true");
        element.style.width = "100%";
        element.style.height = "100%";
        element.style.objectFit = "cover";

        // Defer play() to next frame — prevents AbortError if React
        // removes the element before play() resolves
        requestAnimationFrame(() => {
          if (cancelled) return;
          // Verify element is still in the DOM
          if (!element.isConnected) return;
          element.play().catch((err: unknown) => {
            // AbortError is expected during rapid unmounts — safe to ignore
            const e = err as DOMException;
            if (e.name !== "AbortError") {
              // console.log("Video playback failed:", e.name, e.message);
            }
          });
        });
      }

      element.classList.add("media-element");
      ref.current.appendChild(element);
    } catch (error) {
      console.error(`MediaTrack failed to attach ${track.kind} track`, error);
    }

    return () => {
      cancelled = true;
      attachedRef.current = null;
      if (retryTimeout !== null) clearTimeout(retryTimeout);
      // Remove stall listeners
      if (
        "off" in track &&
        typeof (track as TwilioVideo.VideoTrack).off === "function"
      ) {
        (track as TwilioVideo.VideoTrack).off("disabled", handleTrackStalled);
      }
      try {
        const detached = track.detach();
        detached.forEach((el) => {
          if (el.isConnected) el.remove();
        });
      } catch {
        // Track may already be stopped/detached — safe to ignore
      }
    };
  }, [track, isLocal]);

  // Don't render anything for local audio
  if (isLocal && track.kind === "audio") {
    return null;
  }

  return (
    <div ref={ref} className={`media-track ${isLocal ? "local" : "remote"}`} />
  );
};

export default CallInterface;
