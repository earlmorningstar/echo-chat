import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../utils/api";
import { AuthUser } from "../types";
import "./ChatAppStyles.css";

interface Friend extends AuthUser {
  _id: string;
  lastMessage?: {
    content: string;
    timestamp: Date;
    unread: boolean;
  };
}

const ChatList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFriends();
  }, [user]);

  const fetchFriends = async () => {
    try {
      const response = await api.get("/api/user/friends");

      console.log("Friends response:", response.data);

      const friendsWithMessages = await Promise.all(
        response.data.friends.map(async (friend: AuthUser) => {
          console.log("Processing friend:", friend);
          //last message for each friend
          const messageResponse = await api.get(
            `/api/messages/last/${friend._id}`
          );
          return {
            ...friend,
            lastMessage: messageResponse.data.message || null,
          };
        })
      );
      setFriends(friendsWithMessages);
    } catch (error) {
      console.error("Error fetching friends:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChatClick = (friendId: string) => {
    console.log("Navigating to chat with friendId:", friendId);
    navigate(`/main-navigation/chat/${friendId}`);
  };

  const formatTimestamp = (timestamp: Date) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 24) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return date.toLocaleDateString();
  };

  const getLastActiveStatus = (lastSeen?: Date) => {
    if (!lastSeen) return "Offline";
    const lastSeenDate = new Date(lastSeen);
    const now = new Date();
    const diff = now.getTime() - lastSeenDate.getTime();
    const minutes = Math.floor(diff / (1000 * 60));

    if (minutes < 1) return "Online";
    if (minutes < 60) return `${minutes}m ago`;
    return formatTimestamp(lastSeenDate);
  };

  if (loading) {
    return <div className="loading-spinner">Loading...</div>;
  }

  return (
    <div className="main-container">
      <div className="chat-list">
        {friends.length === 0 ? (
          <div className="no-friends-message">
            <p>You haven't added any friends yet.</p>
            <button onClick={() => navigate("/main-navigation/add-user")}>
              Add Friends
            </button>
          </div>
        ) : (
          friends.map((friend) => (
            <div
              key={friend._id}
              className="chat-item"
              onClick={() => handleChatClick(friend._id)}
            >
              <div className="chat-item-avatar">
                {friend.avatarUrl ? (
                  <img
                    src={friend.avatarUrl}
                    alt={`${friend.firstName}'s profile`}
                    className="profile-image"
                  />
                ) : (
                  <div className="default-avatar">
                    {friend.firstName[0]}${friend.lastName[0]}
                  </div>
                )}
                <span
                  className={`status-indicator ${friend.status || "offline"}`}
                />
              </div>

              <div className="chat-info">
                <div className="chat-header">
                  <span className="chat-name">
                    {friend.firstName} {friend.lastName}
                  </span>
                  {friend.lastMessage && (
                    <span className="chat-time">
                      {formatTimestamp(friend.lastMessage.timestamp)}
                    </span>
                  )}
                </div>

                <div className="chat-preview">
                  {friend.lastMessage ? (
                    <span className="last-message">
                      {friend.lastMessage.content}
                    </span>
                  ) : (
                    <span className="no-messages">No messages yet</span>
                  )}
                  {friend.lastMessage?.unread && (
                    <span className="unread-indicator" />
                  )}
                </div>
                <div className="user-status">
                  {getLastActiveStatus(friend.lastSeen)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ChatList;
