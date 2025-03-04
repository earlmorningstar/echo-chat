import React, { useEffect, useRef, useState } from "react";
import { useCall } from "../contexts/CallContext";
import { RemoteVideoTrackPublication } from "twilio-video";
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
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    participants,
    room,
  } = useCall();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [remoteParticipant, setRemoteParticipant] =
    useState<(typeof participants)[number]>();

  // useEffect(() => {
  //   if (localVideoRef.current) {
  //     const localVideoTracks = Array.from(
  //       room?.localParticipant.videoTracks.values() || []
  //     )
  //       .map((publication) => publication.track)
  //       .filter((track): track is LocalVideoTrack => track !== undefined);

  //     if (localVideoTracks.length > 0) {
  //       localVideoRef.current.srcObject = new MediaStream(
  //         localVideoTracks as unknown as MediaStreamTrack[]
  //       );
  //     }
  //   }
  // }, [room, callState.localMedia.videoEnabled]);

  useEffect(() => {
    if (room) {
      
      room.localParticipant.videoTracks.forEach(publication => {
        if (publication.track && localVideoRef.current) {
          localVideoRef.current.srcObject = new MediaStream([
            publication.track as unknown as MediaStreamTrack
          ]);
        }
      });
  
     
      participants.forEach(participant => {
        participant.videoTracks.forEach(publication => {
          if (publication.track && remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = new MediaStream([
              publication.track as unknown as MediaStreamTrack
            ]);
          }
        });
      });
    }
  }, [room, participants]);

  useEffect(() => {
    setRemoteParticipant(participants[0]);
  }, [participants]);

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

// import React, { useRef, useEffect, useState } from "react";
// import { useCall } from "../contexts/CallContext";
// import {
//   Mic,
//   MicOff,
//   Videocam,
//   VideocamOff,
//   CallEnd,
//   ScreenShare,
//   StopScreenShare,
//   Fullscreen,
//   FullscreenExit,
// } from "@mui/icons-material";
// import CallQualityIndicator from "./CallQualityIndicator";

// const CallInterface: React.FC = () => {
//   const {
//     callState,
//     endCall,
//     toggleAudio,
//     toggleVideo,
//     toggleScreenShare,
//     callQuality,
//     isScreenSharing,
//   } = useCall();
//   const localVideoRef = useRef<HTMLVideoElement>(null);
//   const remoteVideoRef = useRef<HTMLVideoElement>(null);
//   const [isFullScreen, setIsFullScreen] = useState(false);

//   useEffect(() => {
//     const remoteVideo = remoteVideoRef.current;
//     if (remoteVideo && callState.remoteStream) {
//       const clonedStream = new MediaStream(callState.remoteStream.getTracks());
//       remoteVideo.srcObject = clonedStream;
//       remoteVideo.play().catch(console.error);
//     }
//   }, [callState.remoteStream]);

//   if (
//     !callState.isInCall ||
//     (callState.callStatus !== "outgoing" &&
//       callState.callStatus !== "connected")
//   ) {
//     return null;
//   }

//   const isAudioEnabled =
//     callState.localStream?.getAudioTracks()[0]?.enabled ?? false;
//   const isVideoEnabled =
//     callState.localStream?.getVideoTracks()[0]?.enabled ?? false;

//   const toggleFullScreen = () => {
//     const container = document.querySelector(".call-interface");
//     if (!container) return;

//     if (!document.fullscreenElement) {
//       container
//         .requestFullscreen?.()
//         .then(() => setIsFullScreen(true))
//         .catch(console.error);
//     } else {
//       document
//         .exitFullscreen?.()
//         .then(() => setIsFullScreen(false))
//         .catch(console.error);
//     }
//   };

//   return (
//     <div className={`call-interface ${isFullScreen ? "fullscreen" : ""}`}>
//       <div className="call-header">
//         <div className="caller-info">
//           <span className="caller-name">
//             {callState.remoteUser?.firstName} {callState.remoteUser?.lastName}
//           </span>
//           <span className="call-status">
//             {callState.callStatus === "outgoing" ? "Calling..." : "Connected"}
//           </span>
//         </div>
//         {callQuality && <CallQualityIndicator quality={callQuality} />}
//       </div>

//       <div className="video-container">
//         {callState.callType === "video" && (
//           <>
//             <div className="remote-video-wrapper">
//               <video
//                 ref={remoteVideoRef}
//                 autoPlay
//                 playsInline
//                 className="remote-video"
//               />
//             </div>
//             <div className="local-video-wrapper">
//               <video
//                 ref={localVideoRef}
//                 autoPlay
//                 playsInline
//                 muted
//                 className="local-video"
//               />
//             </div>
//           </>
//         )}
//         <div id="remote-audio-container" className="hidden" />
//       </div>

//       <div className="call-controls">
//         <button
//           onClick={toggleAudio}
//           className={`control-button ${isAudioEnabled ? "active" : "inactive"}`}
//           aria-label={isAudioEnabled ? "Mute" : "Unmute"}
//         >
//           {isAudioEnabled ? <Mic /> : <MicOff />}
//         </button>

//         {callState.callType === "video" && (
//           <>
//             <button
//               onClick={toggleVideo}
//               className={`control-button ${
//                 isVideoEnabled ? "active" : "inactive"
//               }`}
//               aria-label={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
//             >
//               {isVideoEnabled ? <Videocam /> : <VideocamOff />}
//             </button>

//             <button
//               onClick={toggleScreenShare}
//               className={`control-button ${
//                 isScreenSharing ? "active" : "inactive"
//               }`}
//               aria-label={isScreenSharing ? "Stop sharing" : "Share screen"}
//             >
//               {isScreenSharing ? <StopScreenShare /> : <ScreenShare />}
//             </button>

//             <button
//               onClick={toggleFullScreen}
//               className="control-button"
//               aria-label={isFullScreen ? "Exit fullscreen" : "Enter fullscreen"}
//             >
//               {isFullScreen ? <FullscreenExit /> : <Fullscreen />}
//             </button>
//           </>
//         )}

//         <button
//           onClick={endCall}
//           className="control-button end-call"
//           aria-label="End call"
//         >
//           <CallEnd />
//         </button>
//       </div>
//     </div>
//   );
// };

// export default CallInterface;
