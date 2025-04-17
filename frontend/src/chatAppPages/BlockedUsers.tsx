import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../utils/api";
import { useNavigate } from "react-router-dom";
import { IoChevronBackOutline } from "react-icons/io5";
import { CircularProgress, Snackbar } from "@mui/material";
import EchoChatLoader from "../pages/EchoChatLoader";

interface BlockedUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
  blockedAt: string;
}

const BlockedUsers: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [unblockingUserId, setUnblockingUserId] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  //list of blocked users
  const { data: blockedUsers, isLoading } = useQuery({
    queryKey: ["blockedUsers"],
    queryFn: async () => {
      const response = await api.get("/api/user/blocked");
      return response.data.blockedUsers as BlockedUser[];
    },
  });

  //unblock user mutation
  const unblockMutation = useMutation({
    mutationFn: async (blockedId: string) => {
      setUnblockingUserId(blockedId);
      return api.post("/api/user/unblock", { blockedId });
    },
    onSuccess: () => {
      setSnackbarMessage("Unblocked user successfully");
      setSnackbarOpen(true);

      //invalidating relevant queries
      queryClient.invalidateQueries({ queryKey: ["blockedUsers"] });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
    onSettled: () => {
      setUnblockingUserId(null);
    },
  });

  const handleUnblock = (userId: string) => {
    unblockMutation.mutate(userId);
  };

  const formatBlockedDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Unknown date";

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const goBack = () => {
    navigate(-1);
  };

  return (
    <div className="blocked-users-container">
      <div className="blocked-users-header">
        <span style={{ cursor: "pointer" }} onClick={goBack}>
          <IoChevronBackOutline size={25} color="#333" />
        </span>
        <h2>Blocked Users</h2>
      </div>

      {isLoading ? (
        <EchoChatLoader />
      ) : blockedUsers && blockedUsers.length > 0 ? (
        <div className="blocked-users-list">
          {blockedUsers.map((user) => (
            <div key={user._id} className="blocked-user-item">
              <div className="blocked-user-avatar-holder">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={`${user.firstName} ${user.lastName}`}
                  />
                ) : (
                  <div className="default-avatar">
                    {user.firstName[0]}
                    {user.lastName[0]}
                  </div>
                )}
              </div>
              <div className="blocked-info-action-flex">
                <div className="user-info">
                  <h3>
                    {user.firstName.charAt(0).toUpperCase() +
                      user.firstName.slice(1).toLowerCase()}{" "}
                    {user.lastName.charAt(0).toUpperCase() +
                      user.lastName.slice(1).toLowerCase()}
                  </h3>
                  <p>{user.email}</p>
                </div>
                <div className="user-info unblock-action">
                  <small>Blocked on {formatBlockedDate(user.blockedAt)}</small>
                  <button
                    onClick={() => handleUnblock(user._id)}
                    disabled={unblockingUserId === user._id}
                  >
                    {unblockingUserId === user._id ? (
                      <span className="unblockProgress-holder">
                        <CircularProgress size={16} color="inherit" />
                        <span>Unblocking...</span>
                      </span>
                    ) : (
                      "Unblock"
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="no-calls-message">
          <p className="add-user-title">You haven't blocked any users yet.</p>
        </div>
      )}

<Snackbar
  open={snackbarOpen}
  autoHideDuration={3000}
  onClose={() => setSnackbarOpen(false)}
  anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
  message={snackbarMessage}
  />
    </div>
  );
};
export default BlockedUsers;
