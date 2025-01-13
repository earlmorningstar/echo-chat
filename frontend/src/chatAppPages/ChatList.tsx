import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../utils/api";
import { AuthUser, Message } from "../types";
import { CiUnread, CiRead } from "react-icons/ci";
import "./ChatAppStyles.css";

interface Friend extends AuthUser {
  lastMessage?: Message;
  unreadCount?: number;
}

const ChatList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFriends();
    const interval = setInterval(fetchFriends, 2000);
    return () => clearInterval(interval);
  }, [user]);

  const fetchFriends = async () => {
    try {
      const response = await api.get("/api/user/friends");

      const friendsWithMessages = await Promise.all(
        response.data.friends.map(async (friend: AuthUser) => {
          //last message for each friend
          const [messageResponse, unreadCountResponse] = await Promise.all([
            api.get(`/api/messages/last/${friend._id}`),
            api.get(`/api/messages/unread-count/${friend._id}`),
          ]);

          return {
            ...friend,
            lastMessage: messageResponse.data.message
              ? {
                  ...messageResponse.data.message,
                  status: messageResponse.data.message.status || "sent",
                }
              : null,
            unreadCount: unreadCountResponse.data.count || 0,
          } as Friend;
        })
      );

      const sortedFriends = friendsWithMessages.sort((a, b) => {
        const timeA = a.lastMessage?.timestamp
          ? new Date(a.lastMessage.timestamp).getTime()
          : 0;
        const timeB = b.lastMessage?.timestamp
          ? new Date(b.lastMessage.timestamp).getTime()
          : 0;
        return timeB - timeA;
      });

      setFriends(sortedFriends);
    } catch (error) {
      console.error("Error fetching friends:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChatClick = async (friendId: string) => {
    try {
      await api.post(`/api/messages/mark-read/${friendId}`);

      setFriends((prev) =>
        prev.map((friend) =>
          friend._id === friendId ? { ...friend, unreadCount: 0 } : friend
        )
      );
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
    navigate(`/chat/${friendId}`);
  };

  const formatTimestamp = (timestamp: Date) => {
    const messageDate = new Date(timestamp);
    const now = new Date();
    const diffTime = now.getTime() - messageDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return messageDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    if (diffDays === 1) {
      return "Yesterday";
    }

    if (diffDays < 7) {
      return messageDate.toLocaleDateString([], { weekday: "long" });
    }

    return messageDate.toLocaleDateString([], {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const truncateLastMessage = (message: string, wordLimit: number = 15) => {
    const words = message.split(" ");
    if (words.length > wordLimit) {
      return words.slice(0, wordLimit).join(" ") + "....";
    }
    return message;
  };

  if (loading) {
    return <div className="loading-spinner">Loading...</div>;
  }

  return (
    <div className="main-container">
      <div className="chat-list">
        {friends.length === 0 ? (
          <div className="no-friends-message">
            <p>You don't have any friends yet</p>
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
                    {friend.firstName[0]}
                    {friend.lastName[0]}
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
                  {friend.lastMessage && (
                    <>
                      {friend.lastMessage.senderId && (
                        <span className="message-status">
                          {friend.lastMessage.senderId === user?._id && (
                            <>
                              {friend.lastMessage.status === "read" ? (
                                <CiRead
                                  size={18}
                                  className="message-status-icon read"
                                />
                              ) : (
                                <CiUnread
                                  size={18}
                                  className="message-status-icon unread"
                                />
                              )}
                            </>
                          )}
                        </span>
                      )}
                      <span className="last-message">
                        {truncateLastMessage(friend.lastMessage.content)}
                      </span>
                    </>
                  )}
                  {(friend.unreadCount ?? 0) > 0 && (
                    <span className="unread-count">{friend.unreadCount}</span>
                  )}
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
