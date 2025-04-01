import React, { useEffect, useRef } from "react";
import { useCall } from "../contexts/CallContext";
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

  useEffect(() => {
    const tracks = mediaControls?.localTracks || [];
    return () => {
      //cleaning up media tracks on unmount
      console.log("Cleaning up media tracks on component unmount");
      tracks.forEach((track: LocalTrack) => {
        if (track.kind === "audio" || track.kind === "video") {
          track.stop();
          track.detach().forEach((element) => element.remove());
          // if ("stop" in track) {
          //   console.log(`Stopping ${track.kind} track`);
          //   track.stop();
          // }
          // [...track.detach()].forEach((element) => {
          //   console.log(`Removing ${track.kind} element from DOM`);
          //   element.remove();
          // });
        }
      });
    };
  }, [mediaControls?.localTracks]);

  // useEffect(() => {
  //   // Only run in development for debugging
  //   if (process.env.NODE_ENV !== "development") return;

  //   async function testDevices() {
  //     try {
  //       const stream = await navigator.mediaDevices.getUserMedia({
  //         audio: true,
  //         video: true,
  //       });

  //       const videoEl = document.createElement("video");
  //       videoEl.srcObject = stream;
  //       videoEl.autoplay = true;
  //       videoEl.muted = true;
  //       videoEl.style.position = "fixed";
  //       videoEl.style.bottom = "10px";
  //       videoEl.style.left = "10px";
  //       videoEl.style.width = "160px";
  //       videoEl.style.height = "120px";
  //       videoEl.style.zIndex = "9999";
  //       videoEl.style.border = "2px solid red";
  //       document.body.appendChild(videoEl);

  //       console.log("Device test: Created direct video element");
  //     } catch (err) {
  //       console.error("Device test failed:", err);
  //     }
  //   }

  //   testDevices();
  // }, []);

  useEffect(() => {
    let localContainer = document.getElementById("local-media-container");
    let remoteContainer = document.getElementById("remote-media-container");

    if (!localContainer) {
      console.log("Local container not found");
      // console.log("Creating local media container");
      // localContainer = document.createElement("div");
      // localContainer.id = "local-media-container";
      // localContainer.className = "local-video-wrapper";
      // document.querySelector(".video-container")?.appendChild(localContainer);
    }

    if (!remoteContainer) {
      console.log("Remote container not found");
      // console.log("Creating remote media container");
      // remoteContainer = document.createElement("div");
      // remoteContainer.id = "remote-media-container";
      // remoteContainer.className = "remote-video-wrapper";
      // document.querySelector(".video-container")?.appendChild(remoteContainer);
    }
  }, []);

  useEffect(() => {
    if (!callManager.voiceDevice) return;

    const voiceDevice = callManager.voiceDevice;
    let activeConnection: TwilioVoice.Connection | undefined;

    const handleDisconnect = () => {
      console.log("Voice connection disconnected");
      endCall();
    };

    // Get active connection properly
    if (voiceDevice.activeConnection) {
      activeConnection = voiceDevice.activeConnection();
    }

    if (activeConnection) {
      console.log("Monitoring voice connection state");
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
          <span className="call-status">
            {callState.currentCall.status === "connected"
              ? "Connected"
              : "Connecting..."}
          </span>
        </div>
      </div>

      {/* <div className="video-container">
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
                track.kind === "video"
            )
            .map((track) => (
              <MediaTrack key={track.name} track={track} isLocal />
            ))}
        </div>
      </div> */}
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

    try {
      console.log(`MediaTrack component attaching ${track.kind} track`);
      const element = track.attach();

      // //configuration of element
      if (isLocal && element.tagName.toLowerCase() === "audio") {
        element.muted = true;
        console.log("Muted local audio to prevent echo");
      }

      element.classList.add("media-element");
      //adding element to the DOM
      ref.current?.appendChild(element);

      console.log(
        `MediaTrack successfully attached ${track.kind} element to DOM`
      );

      //verifying dimensions after it starts playing (for video elements)
      if (element.tagName.toLowerCase() === "video") {
        const videoElement = element as HTMLVideoElement;
        videoElement.addEventListener("playing", () => {
          console.log("Video element is playing:", {
            width: videoElement.videoWidth,
            height: videoElement.videoHeight,
            readyState: videoElement.readyState,
          });
        });
      }

      // return () => {
      //   track.detach().forEach((el) => el.remove());
      // };

      return () => {
        console.log(`MediaTrack cleaning up ${track.kind} track`);
        const detached = track.detach();
        console.log(`Detached ${detached.length} elements`);
        detached.forEach((el) => el.remove());
      };
    } catch (error) {
      console.error(`MediaTrack failed to attach ${track.kind} track:`, error);
    }
    // if (!track.isEnabled) track.enable();
  }, [track, isLocal]);

  return (
    <div ref={ref} className={`media-track ${isLocal ? "local" : "remote"}`} />
  );
};

export default CallInterface;
