import React, { useRef, useEffect, useState } from "react";
import { useCall } from "../contexts/CallContext";
import {
  Mic,
  MicOff,
  Videocam,
  VideocamOff,
  CallEnd,
  ScreenShare,
  StopScreenShare,
  Fullscreen,
  FullscreenExit,
} from "@mui/icons-material";
import CallQualityIndicator from "./CallQualityIndicator";

const CallInterface: React.FC = () => {
  const {
    callState,
    endCall,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    callQuality,
    isScreenSharing,
  } = useCall();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  //  useEffect(() => {
  //   if (localVideoRef.current && callState.localStream) {
  //     const videoTrack = callState.localStream.getVideoTracks()[0];
  //     if (videoTrack) {
  //       videoTrack.enabled = true;
  //     }
  //     localVideoRef.current.srcObject = callState.localStream;
  //     localVideoRef.current.muted = true;

  //     const playVideo = async () => {
  //       try {
  //         await localVideoRef.current?.play();
  //       } catch (error) {
  //         console.error("Error playing local video:", error);
  //       }
  //     };
  //     playVideo();
  //   }
  // }, [callState.localStream]);

  useEffect(() => {
    if (localVideoRef.current && callState.localStream) {
      // Clone stream to trigger re-render when tracks change
      const clonedStream = new MediaStream(callState.localStream.getTracks());
      localVideoRef.current.srcObject = clonedStream;
      localVideoRef.current.muted = true;
      localVideoRef.current.play().catch(console.error);
    }
  }, [callState.localStream]);


  // useEffect(() => {
  //   const remoteVideo = remoteVideoRef.current;
  //   if (remoteVideo && callState.remoteStream) {
  //     remoteVideo.srcObject = callState.remoteStream;
  //     remoteVideo.play().catch(console.error);
  //   }
  // }, [callState.remoteStream]);

  useEffect(() => {
    const remoteVideo = remoteVideoRef.current;
    if (remoteVideo && callState.remoteStream) {
      const clonedStream = new MediaStream(callState.remoteStream.getTracks());
      remoteVideo.srcObject = clonedStream;
      remoteVideo.play().catch(console.error);
    }
  }, [callState.remoteStream]);

  if (
    !callState.isInCall ||
    (callState.callStatus !== "outgoing" &&
      callState.callStatus !== "connected")
  ) {
    return null;
  }

  const isAudioEnabled =
    callState.localStream?.getAudioTracks()[0]?.enabled ?? false;
  const isVideoEnabled =
    callState.localStream?.getVideoTracks()[0]?.enabled ?? false;

  const toggleFullScreen = () => {
    const container = document.querySelector(".call-interface");
    if (!container) return;

    if (!document.fullscreenElement) {
      container
        .requestFullscreen?.()
        .then(() => setIsFullScreen(true))
        .catch(console.error);
    } else {
      document
        .exitFullscreen?.()
        .then(() => setIsFullScreen(false))
        .catch(console.error);
    }
  };

  return (
    <div className={`call-interface ${isFullScreen ? "fullscreen" : ""}`}>
      <div className="call-header">
        <div className="caller-info">
          <span className="caller-name">
            {callState.remoteUser?.firstName} {callState.remoteUser?.lastName}
          </span>
          <span className="call-status">
            {callState.callStatus === "outgoing" ? "Calling..." : "Connected"}
          </span>
        </div>
        {callQuality && <CallQualityIndicator quality={callQuality} />}
      </div>

      <div className="video-container">
        {callState.callType === "video" && (
          <>
            <div className="remote-video-wrapper">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="remote-video"
              />
            </div>
            <div className="local-video-wrapper">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="local-video"
              />
            </div>
          </>
        )}
        <div id="remote-audio-container" className="hidden" />
      </div>

      <div className="call-controls">
        <button
          onClick={toggleAudio}
          className={`control-button ${isAudioEnabled ? "active" : "inactive"}`}
          aria-label={isAudioEnabled ? "Mute" : "Unmute"}
        >
          {isAudioEnabled ? <Mic /> : <MicOff />}
        </button>

        {callState.callType === "video" && (
          <>
            <button
              onClick={toggleVideo}
              className={`control-button ${
                isVideoEnabled ? "active" : "inactive"
              }`}
              aria-label={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
            >
              {isVideoEnabled ? <Videocam /> : <VideocamOff />}
            </button>

            <button
              onClick={toggleScreenShare}
              className={`control-button ${
                isScreenSharing ? "active" : "inactive"
              }`}
              aria-label={isScreenSharing ? "Stop sharing" : "Share screen"}
            >
              {isScreenSharing ? <StopScreenShare /> : <ScreenShare />}
            </button>

            <button
              onClick={toggleFullScreen}
              className="control-button"
              aria-label={isFullScreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullScreen ? <FullscreenExit /> : <Fullscreen />}
            </button>
          </>
        )}

        <button
          onClick={endCall}
          className="control-button end-call"
          aria-label="End call"
        >
          <CallEnd />
        </button>
      </div>
    </div>
  );
};

export default CallInterface;
