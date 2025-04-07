import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useCall } from "../contexts/CallContext";
import { useQuery } from "@tanstack/react-query";
import api from "../utils/api";
import { CallType, CallStatus } from "../types";
import { IoVideocam, IoVideocamOutline } from "react-icons/io5";
import {
  MdCall,
  MdCallMade,
  MdCallReceived,
  MdCallMissed,
} from "react-icons/md";

interface CallHistoryItem {
  _id: string;
  caller: string;
  recipient: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  type: CallType;
  status: CallStatus;
  isOutgoing?: boolean;
  user: {
    _id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string;
  };
  count?: number;
}

const CallList: React.FC = () => {
  const { user } = useAuth();
  const { initiateCall } = useCall();
  const navigate = useNavigate();

  const { data: callHistory = [], isLoading } = useQuery({
    queryKey: ["callHistory"],
    queryFn: async () => {
      const response = await api.get("/api/call/history");
      return processCallHistory(response.data.calls);
    },
    refetchInterval: 10000,
    staleTime: 20000,
  });

  const processCallHistory = (calls: any[]): CallHistoryItem[] => {
    if (!user?._id || !calls.length) return [];

    //grouping calls by other user and call direction
    const groupedCalls = calls.reduce((acc: any, call: any) => {
      const isOutgoing = call.caller.toString() === user._id;
      const otherUserId = isOutgoing ? call.recipient : call.caller;
      const direction = isOutgoing ? "outgoing" : "incoming";
      const key = `${otherUserId}-${direction}-${call.type}`;

      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(call);
      return acc;
    }, {});

    //creating consolidated call history items
    const processedCalls = Object.values(groupedCalls).map((callGroup: any) => {
      const sortedCalls = callGroup.sort(
        (a: any, b: any) =>
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );

      const latestCall = sortedCalls[0];
      const isOutgoing = latestCall.caller === user._id;
      const otherUserId = isOutgoing ? latestCall.recipient : latestCall.caller;
      const count = sortedCalls.length;

      //finding participant by ensuring IDs are in string format for comparison
      const participant = latestCall.participantDetails.find(
        (p: any) => p._id === otherUserId.toString()
      );

      return {
        ...latestCall,
        isOutgoing,
        user: participant || {
          _id: otherUserId,
          firstName: "Unknown",
          lastName: "User",
          avatarUrl: "",
        },
        count: count > 1 ? count : undefined,
        duration: calculateDuration(latestCall.startTime, latestCall.endTime),
      };
    });

    //sorting by most recent calls first
    return processedCalls.sort(
      (a: any, b: any) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  };

  const calculateDuration = (
    startTime: string | Date,
    endTime?: string | Date
  ): number => {
    if (!endTime) return 0;

    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();

    return Math.floor((end - start) / 1000);
  };

  const formatDuration = (seconds: number): string => {
    if (!seconds || seconds <= 0) return "00:00";

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  };

  const formatTimestamp = (timestamp: Date) => {
    const callDate = new Date(timestamp);
    const now = new Date();
    const diffTime = now.getTime() - callDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return callDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    if (diffDays === 1) {
      return "Yesterday";
    }

    if (diffDays < 7) {
      return callDate.toLocaleDateString([], { weekday: "long" });
    }

    return callDate.toLocaleDateString([], {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const handleUserClick = (userId: string) => {
    navigate(`/chat/${userId}`);
  };

  const handleCallUser = (userId: string, callType: CallType) => {
    initiateCall(userId, callType);
  };

  if (isLoading && !callHistory.length) {
    return <div className="loading-spinner">Loading...</div>;
  }

  return (
    <div className="main-container">
      <div className="chat-list">
        {callHistory.length === 0 ? (
          <div className="no-calls-message">
            <p className="add-user-title">No call history yet</p>
            <button onClick={() => navigate("/main-navigation/chats")}>
              Start a Call
            </button>
          </div>
        ) : (
          callHistory.map((call: CallHistoryItem) => (
            <div
              key={call._id}
              className="call-item"
              onClick={() => handleUserClick(call.user._id)}
            >
              <div className="call-item-info-holder">
                <div className="call-item-avatar">
                  {call.user.avatarUrl ? (
                    <img
                      src={call.user.avatarUrl}
                      alt={`${call.user.firstName}'s profile`}
                      className="profile-image"
                    />
                  ) : (
                    <div className="default-avatar">
                      {call.user.firstName[0]}
                      {call.user.lastName[0]}
                    </div>
                  )}
                </div>

                <div className="call-info">
                  <div>
                    <span
                      className={`call-name ${
                        call.status === CallStatus.MISSED && !call.isOutgoing
                          ? "missed-call"
                          : ""
                      }`}
                    >
                      {`${call.user.firstName} ${call.user.lastName}`
                        .split(" ")
                        .map(
                          (name) =>
                            `${name.charAt(0).toUpperCase()}${name
                              .slice(1)
                              .toLowerCase()}`
                        )
                        .join(" ")}
                      {call.count && call.count > 1 && (
                        <span className="call-count">({call.count})</span>
                      )}
                    </span>
                  </div>

                  <div className="call-details">
                    <div className="call-direction">
                      {call.isOutgoing ? (
                        <MdCallMade className="call-icon outgoing" />
                      ) : call.status === CallStatus.MISSED ? (
                        <MdCallMissed className="call-icon missed" />
                      ) : (
                        <MdCallReceived className="call-icon incoming" />
                      )}

                      <span
                        className={`call-status ${call.status.toLowerCase()}`}
                      >
                        {call.isOutgoing
                          ? "Outgoing"
                          : call.status === CallStatus.MISSED
                          ? "Missed"
                          : "Incoming"}
                      </span>

                      {call.type === CallType.VIDEO ? (
                        <IoVideocam className="call-type-icon" />
                      ) : (
                        <MdCall className="call-type-icon" />
                      )}

                      {call.duration && call.duration > 0 && (
                        <span className="call-duration">
                          {formatDuration(call.duration)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="call-list-actions">
                <div>
                  <button
                    className="call-action-btn voice"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCallUser(call.user._id, CallType.VOICE);
                    }}
                  >
                    <MdCall size={20} />
                  </button>
                  <button
                    className="call-action-btn video"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCallUser(call.user._id, CallType.VIDEO);
                    }}
                  >
                    <IoVideocamOutline size={20} />
                  </button>
                </div>
                <span className="call-time">
                  {formatTimestamp(call.startTime)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CallList;
