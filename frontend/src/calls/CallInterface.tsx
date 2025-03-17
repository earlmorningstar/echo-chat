import React, { useEffect, useRef, useState } from "react";
import { useCall } from "../contexts/CallContext";
import { RemoteVideoTrackPublication } from "twilio-video";
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
    room,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
  } = useCall();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [remoteParticipant, setRemoteParticipant] =
    useState<(typeof participants)[number]>();

  useEffect(() => {
    if (room) {
      room.localParticipant.videoTracks.forEach((publication) => {
        if (publication.track && localVideoRef.current) {
          localVideoRef.current.srcObject = new MediaStream([
            publication.track as unknown as MediaStreamTrack,
          ]);
        }
      });

      participants.forEach((participant) => {
        participant.videoTracks.forEach((publication) => {
          if (publication.track && remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = new MediaStream([
              publication.track as unknown as MediaStreamTrack,
            ]);
          }
        });
      });
    }
  }, [room, participants]);

  useEffect(() => {
    setRemoteParticipant(participants[0]);
  }, [participants]);

  useEffect(() => {
    if (!callManager.voiceDevice) return;
  
    const voiceDevice = callManager.voiceDevice;
    let activeConnection: TwilioVoice.Connection | undefined;
  
    const handleDisconnect = () => {
      console.log('Voice connection disconnected');
      endCall();
    };
  
    // Get active connection properly
    if (voiceDevice.activeConnection) {
      activeConnection = voiceDevice.activeConnection();
    }
  
    if (activeConnection) {
      console.log('Monitoring voice connection state');
      activeConnection.on('disconnect', handleDisconnect);
    }
  
    return () => {
      activeConnection?.off('disconnect', handleDisconnect);
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
          <span className="call-status">
            {callState.currentCall.status === "connected"
              ? "Connected"
              : "Connecting..."}
          </span>
        </div>
      </div>

      <div className="video-container">
        {callState.currentCall.type === "video" && (
          <>
            <div className="remote-video-wrapper">
              {remoteParticipant?.videoTracks &&
                Array.from(remoteParticipant.videoTracks.values()).map(
                  (publication: RemoteVideoTrackPublication) => {
                    if (!publication.track || !publication.isTrackEnabled)
                      return null;
                    return (
                      <video
                        key={publication.trackSid}
                        ref={(el) => {
                          if (el && publication.track)
                            el.srcObject = new MediaStream([
                              publication.track as unknown as MediaStreamTrack,
                            ]);
                        }}
                        autoPlay
                        playsInline
                        className="remote-video"
                      />
                    );
                  }
                )}
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
  );
};

export default CallInterface;