import React from "react";
import { useCall } from "../contexts/CallContext";
import { Call, CallEnd, Videocam } from "@mui/icons-material";

const IncomingCallModal: React.FC = () => {
  const { callState, acceptCall, rejectCall } = useCall();
  const { remoteUser, callType } = callState;

  if (callState.callStatus !== "incoming") return null;

  return (
    <div className="incoming-call-modal">
      <div className="modal-content">
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
        <div className="call-actions">
          <button onClick={rejectCall} className="call-button reject-button">
            <CallEnd />
          </button>
          <button onClick={acceptCall} className="call-button accept-button">
            {callType === "video" ? <Videocam /> : <Call />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;
