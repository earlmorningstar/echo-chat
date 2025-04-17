import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useChat } from "../contexts/ChatContext";
import { useCall } from "../contexts/CallContext";
import type { AuthUser } from "../types";
import api from "../utils/api";
import { CallType } from "../types";
import { formatLastSeen } from "../utils/chatUtils";
import { IoChevronBackOutline } from "react-icons/io5";
import { SlOptions } from "react-icons/sl";
import { IoMdCall, IoMdVideocam } from "react-icons/io";
import { RiMessage2Fill } from "react-icons/ri";
import { MdOutlineBlock } from "react-icons/md";
import { CircularProgress, Snackbar } from "@mui/material";

const FriendsProfile: React.FC = () => {
  const navigate = useNavigate();
  const { friendId } = useParams<{ friendId: string }>();
  const { getUserStatus } = useChat();
  const { initiateCall } = useCall();
  const queryClient = useQueryClient();
  const [isBlocking, setIsBlocking] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  //fetching friendship data
  const { data: friendshipData } = useQuery({
    queryKey: ["friendship", friendId],
    queryFn: async () => {
      if (!friendId) throw new Error("No friend ID provided");

      const response = await api.get(`/api/user/friendship/${friendId}`);
      const createdAt = response.data.data.friendship.createdAt;
      return {
        createdAt: createdAt ? new Date(createdAt) : undefined,
      };
    },
    enabled: !!friendId,
    staleTime: Infinity, //friendship creation date shouldn't change
  });

  //fetching user data
  const { data: userData } = useQuery({
    queryKey: ["friend", friendId],
    queryFn: async () => {
      if (!friendId) throw new Error("No friend ID provided");
      const response = await api.get(`/api/user/${friendId}`);
      return response.data.user as AuthUser;
    },
    enabled: !!friendId,
    staleTime: 1000 * 60,
  });

  //fetching block status
  const { data: blockStatusData } = useQuery({
    queryKey: ["blockStatus", friendId],
    queryFn: async () => {
      if (!friendId) throw new Error("No friend ID provided");
      const response = await api.get(`/api/user/block-status/${friendId}`);
      return response.data.data;
    },
    enabled: !!friendId,
  });

  const blockMutation = useMutation({
    mutationFn: async () => {
      if (!friendId) throw new Error("No friend ID provided");
      return api.post("/api/user/block", { blockedId: friendId });
    },
    onSuccess: () => {
      setSnackbarMessage("User blocked successfully");
      setSnackbarOpen(true);
      //invalidating relevant queries
      queryClient.invalidateQueries({ queryKey: ["blockStatus", friendId] });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      queryClient.invalidateQueries({ queryKey: ["friendship", friendId] });

      setTimeout(() => {
        navigate("/main-navigation/chats");
      }, 1000);
    },
  });

  const unblockMutation = useMutation({
    mutationFn: async () => {
      if (!friendId) throw new Error("No friend ID provided");
      return api.post("/api/user/unblock", { blockedId: friendId });
    },
    onSuccess: () => {
      //invalidating relevant queries
      queryClient.invalidateQueries({ queryKey: ["blockStatus", friendId] });
    },
  });

  const handleVoiceCall = () => {
    if (friendId) {
      initiateCall(friendId, CallType.VOICE);
    }
  };

  const handleVideoCall = () => {
    if (friendId) {
      initiateCall(friendId, CallType.VIDEO);
    }
  };

  const handleToggleBlock = async () => {
    if (!friendId) return;

    setIsBlocking(true);
    try {
      if (blockStatusData?.youBlockedThem) {
        await unblockMutation.mutateAsync();
      } else {
        await blockMutation.mutateAsync();
      }
    } finally {
      setIsBlocking(false);
    }
  };

  //getting current status separately
  const status = friendId ? getUserStatus(friendId) : undefined;

  const formatDateAdded = (date: Date | undefined) => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return "Not available";
    }

    const now = new Date();
    const diffHours =
      Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24) return "Added today";
    if (diffHours < 48) return "Added yesterday";

    const diffDays = Math.ceil(diffHours / 24);
    if (diffDays < 7) return `Added ${diffDays} days ago`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `Added ${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
    }
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `Added ${months} ${months === 1 ? "month" : "months"} ago`;
    }

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const friend = userData
    ? {
        ...userData,
        status,
        friendshipCreatedAt: friendshipData?.createdAt,
      }
    : undefined;

  const navigateToChatWindow = () => {
    if (friendId) {
      navigate(`/chat/${friendId}`);
    }
  };

  const isBlocked = blockStatusData?.youBlockedThem;
  const isBlockedByFriend = blockStatusData?.theyBlockedYou;

  return (
    <section className="friends-profile-main-container">
      <span
        className="userProfile-redirection-arrow back-button"
        onClick={navigateToChatWindow}
      >
        <IoChevronBackOutline size={25} color="#333" />
      </span>

      <div className="friends-details-section">
        <span className="friends-profile-image-container">
          {friend?.avatarUrl ? (
            <img src={friend.avatarUrl} alt="Profile" />
          ) : (
            <div className="default-avatar">
              {friend?.firstName?.[0]}
              {friend?.lastName?.[0]}
            </div>
          )}
        </span>
        <h2>
          {friend
            ? `${friend.firstName} ${friend.lastName}`
                .split(" ")
                .map(
                  (name) =>
                    `${name.charAt(0).toUpperCase()}${name
                      .slice(1)
                      .toLowerCase()}`
                )
                .join(" ")
            : "Loading..."}
        </h2>

        <section>
          {!isBlocked && !isBlockedByFriend && (
            <>
              <span onClick={navigateToChatWindow}>
                <RiMessage2Fill size={25} color="#208d7f" />
              </span>
              <span onClick={handleVoiceCall}>
                <IoMdCall size={25} color="#208d7f" />
              </span>
              <span onClick={handleVideoCall}>
                <IoMdVideocam size={25} color="#208d7f" />
              </span>
              <span>
                <SlOptions size={25} color="#208d7f" />
              </span>
            </>
          )}
          {isBlockedByFriend && (
            <div className="blocked-message">
              <p>You have been blocked by this user</p>
            </div>
          )}
        </section>
      </div>

      <div className="friends-info-section">
        <span>
          <p>First Name</p>
          <h3>
            {friend?.firstName.charAt(0).toUpperCase()}
            {friend?.firstName.slice(1).toLowerCase() || "Loading..."}
          </h3>
        </span>
        <span>
          <p>Last Name</p>
          <h3>
            {friend?.lastName.charAt(0).toUpperCase()}
            {friend?.lastName.slice(1).toLowerCase() || "Loading..."}
          </h3>
        </span>
        <span>
          <p>Email Address</p>
          <h3>{friend?.email || "Loading..."}</h3>
        </span>
        {!isBlocked && !isBlockedByFriend && (
          <span>
            <p>Date Added</p>
            <h3>
              {friendshipData?.createdAt
                ? formatDateAdded(friendshipData.createdAt)
                : "Not available"}
            </h3>
          </span>
        )}
        {!isBlockedByFriend && (
          <span>
            <p>Status</p>
            <h3>
              {friend?.status === "online"
                ? "Online"
                : formatLastSeen(friend?.lastSeen)}
            </h3>
          </span>
        )}
      </div>

      <div className="block-user-btn-holder">
        <button
          className={`user-blk-btn ${isBlocked ? "user-unblk-btn" : ""}`}
          onClick={handleToggleBlock}
          disabled={isBlocking || isBlocked}
        >
          {isBlocking ? (
            <>
              {isBlocked ? "Unblocking" : "Blocking"}{" "}
              <CircularProgress size={20} color="inherit" />
            </>
          ) : (
            <>
              {isBlocked ? "Unblock User" : "Block User"}{" "}
              <MdOutlineBlock size={20} />
            </>
          )}
        </button>
      </div>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        message={snackbarMessage}
      />
    </section>
  );
};

export default FriendsProfile;
