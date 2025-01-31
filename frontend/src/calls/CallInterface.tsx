import React, { useRef, useEffect } from "react";
import { useCall } from "../contexts/CallContext";
import {
  Mic,
  MicOff,
  Videocam,
  VideocamOff,
  CallEnd,
} from "@mui/icons-material";

const CallInterface: React.FC = () => {
  const { callState, endCall, toggleAudio, toggleVideo } = useCall();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && callState.localStream) {
      localVideoRef.current.srcObject = callState.localStream;
    }
  }, [callState.localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && callState.remoteStream) {
      remoteVideoRef.current.srcObject = callState.remoteStream;
    }
  }, [callState.remoteStream]);

  if (!callState.isInCall) return null;

  const isAudioEnabled = callState.localStream?.getAudioTracks()[0]?.enabled;
  const isVideoEnabled = callState.localStream?.getVideoTracks()[0]?.enabled;

  return (
    <div className="call-interface">
      {callState.callType === "video" && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="remote-video"
        />
      )}
      {callState.callType === "video" && (
        <div className="local-video-container">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="local-video"
          />
        </div>
      )}
      <div className="call-controls">
        <button
          onClick={toggleAudio}
          className={`control-button ${isAudioEnabled ? "active" : "inactive"}`}
        >
          {isAudioEnabled ? <Mic /> : <MicOff />}
        </button>
        {callState.callType === "video" && (
          <button
            onClick={toggleVideo}
            className={`control-button ${
              isVideoEnabled ? "active" : "inactive"
            }`}
          >
            {isVideoEnabled ? <Videocam /> : <VideocamOff />}
          </button>
        )}
        <button onClick={endCall} className="control-button end-call-button">
          <CallEnd />
        </button>
      </div>
    </div>
  );
};

export default CallInterface;
