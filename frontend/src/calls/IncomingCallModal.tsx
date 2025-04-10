import React, { useEffect, useRef, useState } from "react";
import { useCall } from "../contexts/CallContext";
import { useWebSocket } from "../contexts/WebSocketContext";
import { useAuth } from "../contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
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
  const [showModal, setShowModal] = useState(false);

  const { data: callerData } = useQuery({
    queryKey: ["user", incomingCall.callerId],
    queryFn: async () => {
      if (!incomingCall.callerId) throw new Error("No caller ID provided");
      const response = await api.get(`/api/user/${incomingCall.callerId}`);
      return response.data.user;
    },
    enabled: !!incomingCall.callerId,
  });

  useEffect(() => {
    if (callerData) {
      setCaller(callerData);
    }
  }, [callerData]);

  //to delay showing of the modal by 10secs to avoid twilio ringing while the demo sound plays
  useEffect(() => {
    let timeout: NodeJS.Timeout;

    if (incomingCall.callId) {
      timeout = setTimeout(() => {
        setShowModal(true);
        const audio = new Audio("/sounds/iphone_15_ringtone_03.mp3");
        audio.loop = true;
        audio.play().catch(() => {});
        audioRef.current = audio;
      }, 10000);
    } else {
      setShowModal(false);
    }
    return () => {
      clearTimeout(timeout);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, [incomingCall.callId]);

  useEffect(() => {
    if (callState.incomingCall.activeCall) {
      const connection = callState.incomingCall
        .activeCall as TwilioVoice.Connection;

      const timeout = setTimeout(() => {
        rejectCall(callState.incomingCall.callId!);
      }, 30000);

      connection.on("accept", () => {
        clearTimeout(timeout);
      });

      return () => clearTimeout(timeout);
    }
  }, [callState.incomingCall, rejectCall]);

  const handleAccept = async () => {
    try {
      if (incomingCall.callId) {
        await acceptCall(incomingCall.callId);
        audioRef.current?.pause();
      }
    } catch (error) {
      console.error("Call acceptance failed");
    }
  };

  const handleReject = async () => {
    try {
      if (incomingCall.callId && user?._id) {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          audioRef.current = null; //avoiding reuse
        }
        await rejectCall(incomingCall.callId);

        sendMessage({
          type: "call_reject",
          callId: incomingCall.callId,
          rejectorId: user._id,
        });
      }
    } catch (error) {
      console.error("Rejection failed");
    }
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {incomingCall.callId && showModal && (
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
                    <span>
                      {caller?.firstName?.[0]}
                      {caller?.lastName?.[0]}
                    </span>
                  </div>
                )}
              </div>
              <h3 className="caller-name">
                {caller?.firstName
                  ? `${caller.firstName} ${caller.lastName}`
                  : "Loading caller..."}
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
