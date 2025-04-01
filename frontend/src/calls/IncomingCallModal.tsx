import React, { useEffect, useRef, useState } from "react";
import { useCall } from "../contexts/CallContext";
import { useWebSocket } from "../contexts/WebSocketContext";
import { useAuth } from "../contexts/AuthContext";
import { Call, CallEnd, Videocam } from "@mui/icons-material";
import { motion } from "framer-motion";
import * as FramerMotion from "framer-motion";
import { AuthUser } from "../types";
import api from "../utils/api";
import { TwilioVoice } from "../types/calls";

const AnimatePresence = FramerMotion.AnimatePresence as React.ComponentType<{
  children: React.ReactNode;
  mode?: "sync" | "wait" | "popLayout";
  initial?: boolean;
}>;

const IncomingCallModal: React.FC = () => {
  const { callState, acceptCall, rejectCall } = useCall();
  const { user } = useAuth();
  const { sendMessage } = useWebSocket();
  const { incomingCall } = callState;
  const [caller, setCaller] = useState<AuthUser | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (callState.incomingCall.activeCall) {
      const connection = callState.incomingCall
        .activeCall as TwilioVoice.Connection;

      const timeout = setTimeout(() => {
        rejectCall(callState.incomingCall.callId!);
      }, 45000);

      connection.on("accept", () => {
        clearTimeout(timeout);
      });

      return () => clearTimeout(timeout);
    }
  }, [callState.incomingCall, rejectCall]);

  useEffect(() => {
    const fetchCaller = async () => {
      try {
        if (incomingCall.callerId) {
          const strippedCallerPrefix = incomingCall.callerId.replace(
            /^client:/g,
            ""
          );
          const response = await api.get(`/api/users/${strippedCallerPrefix}`);
          if (response.data.user) {
            setCaller(response.data.user);
          }
        }
      } catch (error) {
        console.error("Error fetching caller");
      }
    };

    if (incomingCall.callId) fetchCaller();
  }, [incomingCall.callId, incomingCall.callerId]);

  useEffect(() => {
    const audio = new Audio("/sounds/iphone_15_ringtone_03.mp3");
    if (incomingCall.callId) {
      audio.loop = true;
      audio.play().catch(() => {});
      audioRef.current = audio;
    }

    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, [incomingCall.callId]);

  const handleAccept = async () => {
    try {
      if (incomingCall.callId) {
        console.log("Accepting call:", incomingCall.callId);
        await acceptCall(incomingCall.callId);
        audioRef.current?.pause();
      }
    } catch (error) {
      console.error("Call acceptance failed:", error);
    }
  };

  const handleReject = async () => {
    try {
      if (incomingCall.callId && user?._id) {
        await rejectCall(incomingCall.callId);
        audioRef.current?.pause();

        sendMessage({
          type: "call_reject",
          callId: incomingCall.callId,
          rejectorId: user._id,
        });
      }
    } catch (error) {
      console.error("Rejection failed:", error);
    }
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {incomingCall.callId && (
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
                {caller?.avatarUrl ? (
                  <img
                    src={caller.avatarUrl}
                    alt={caller.username}
                    className="avatar"
                  />
                ) : (
                  <div className="avatar-fallback">
                    <span>{caller?.firstName?.[0]}</span>
                  </div>
                )}
              </div>
              <h3 className="caller-name">
                {caller?.firstName} {caller?.lastName}
              </h3>
              <p className="call-type">Incoming {incomingCall.type} call...</p>
            </div>

            <div className="call-actions">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleReject}
                className="call-button reject-button"
              >
                <CallEnd />
                <span>Decline</span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleAccept}
                className="call-button accept-button"
              >
                {incomingCall.type === "video" ? <Videocam /> : <Call />}
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
