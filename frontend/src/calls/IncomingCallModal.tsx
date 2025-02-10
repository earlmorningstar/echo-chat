import React, { useEffect, useRef } from "react";
import { useCall } from "../contexts/CallContext";
import { Call, CallEnd, Videocam } from "@mui/icons-material";
import { motion } from "framer-motion";
import * as FramerMotion from "framer-motion";

const AnimatePresence = FramerMotion.AnimatePresence as React.ComponentType<{
  children: React.ReactNode;
  mode?: "sync" | "wait" | "popLayout";
  initial?: boolean;
}>;

const IncomingCallModal: React.FC = () => {
  const { callState, acceptCall, rejectCall } = useCall();
  const { remoteUser, callType, callStatus } = callState;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const userInteracted = useRef(false);

  useEffect(() => {
    const handleFirstInteraction = () => {
      userInteracted.current = true;
      document.removeEventListener("click", handleFirstInteraction);
    };
    document.addEventListener("click", handleFirstInteraction);

    return () => {
      document.removeEventListener("click", handleFirstInteraction);
    };
  }, []);

  // useEffect(() => {

  //   if (callStatus === "incoming") {
  //     const audio = new Audio("/sounds/iphone_15_ringtone_03.mp3");
  //     audio.loop = true;

  //     const playAudio = async () => {
  //       try {
  //         if (userInteracted.current) {
  //           await audio.play();
  //         } else {
  //           const handleUserInteraction = async () => {
  //             userInteracted.current = true;
  //             await audio.play();
  //             document.removeEventListener("click", handleUserInteraction);
  //           };
  //           document.addEventListener("click", handleUserInteraction);
  //         }
  //       } catch (error) {
  //         console.error("Audio playback error:", error);
  //       }
  //     };

  //     audioRef.current = audio;
  //     playAudio();

  //     return () => {
  //       audio.pause();
  //       audio.currentTime = 0;
  //       audioRef.current = null;
  //     };
  //   }
  // }, [callStatus]);

  useEffect(() => {
    let audioTimeout: NodeJS.Timeout;

    if (callStatus === "incoming") {
      const audio = new Audio("/sounds/iphone_15_ringtone_03.mp3");
      audio.loop = true;
      audioRef.current = audio;

      const playAudio = async () => {
        try {
          if (userInteracted.current) {
            await audio.play();
          }
        } catch (error) {
          console.error("Audio playback error:", error);
        }
      };

      audioTimeout = setTimeout(playAudio, 500);
    }

    return () => {
      if (audioTimeout) clearTimeout(audioTimeout);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
    };
  }, [callStatus]);

  const handleCallAction = async (action: () => Promise<void>) => {
    if (!callState.roomName) return;
    try {
      audioRef.current?.pause();
      await action();
    } catch (error) {
      console.error("Call action error:", error);
    }
  };

  if (callStatus !== "incoming") return null;

  return (
    <AnimatePresence mode="wait" initial={false}>
      {callStatus === "incoming" && (
        <motion.div
          className="incoming-call-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="modal-content"
            initial={{ scale: 0.8, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 20 }}
          >
            <div className="caller-info">
              <div className="avatar-container">
                {remoteUser?.avatarUrl ? (
                  <img
                    src={remoteUser.avatarUrl}
                    alt={remoteUser.username}
                    className="avatar"
                  />
                ) : (
                  <div className="avatar-fallback">
                    <span>{remoteUser?.firstName?.[0]}</span>
                  </div>
                )}
              </div>
              <h3 className="caller-name">
                {remoteUser?.firstName} {remoteUser?.lastName}
              </h3>
              <p className="call-type">Incoming {callType} call...</p>
            </div>

            <div className="call-actions">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleCallAction(rejectCall)}
                className="call-button reject-button"
              >
                <CallEnd />
                <span>Decline</span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleCallAction(acceptCall)}
                className="call-button accept-button"
              >
                {callType === "video" ? <Videocam /> : <Call />}
                <span>Accept</span>
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default IncomingCallModal;
