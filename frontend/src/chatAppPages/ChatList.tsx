import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useChat } from "../contexts/ChatContext";
import { CiUnread, CiRead } from "react-icons/ci";
import { Friend, Message } from "../types";
import "./ChatAppStyles.css";

const ChatList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { friends, isLoading, setFriendAsRead, friendTypingStatus } = useChat();

  const handleChatClick = async (friendId: string) => {
    setFriendAsRead(friendId);
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

  const getMessagePreview = (message: Message) => {
    switch (message.type) {
      case "image":
        return "📷 Sent a photo";
      case "file":
        if (message.metadata?.fileName) {
          return `📎 Sent ${message.metadata.fileName}`;
        }
        return "📎 Sent a file";
      default:
        return truncateLastMessage(message.content);
    }
  };

  const truncateLastMessage = (
    message: string,
    wordLimit: number = 15,
    charLimit: number = 100
  ) => {
    const words = message.split(" ");
    let truncatedMessage = message;

    if (words.length > wordLimit) {
      truncatedMessage = words.slice(0, wordLimit).join(" ") + "....";
    }

    if (truncatedMessage.length > charLimit) {
      return truncatedMessage.slice(0, charLimit) + "...";
    }

    return truncatedMessage;
  };

  if (isLoading && !friends.length) {
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
          friends.map((friend: Friend) => (
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
                      {friendTypingStatus[friend._id] ? (
                        <div className="typing-indicator-list">
                          <div className="typing-indicator-dots">
                            <div className="typing-dot"></div>
                            <div className="typing-dot"></div>
                            <div className="typing-dot"></div>
                          </div>
                          <span className="typing-text">typing...</span>
                        </div>
                      ) : (
                        <span className="last-message">
                          {getMessagePreview(friend.lastMessage)}
                        </span>
                      )}
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
