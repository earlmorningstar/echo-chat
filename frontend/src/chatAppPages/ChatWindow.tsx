import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useChat } from "../contexts/ChatContext";
import { useWebSocket } from "../contexts/WebSocketContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../utils/api";
import { formatLastSeen } from "../utils/chatUtils";
import { Message, AuthUser } from "../types";
import { formatFileSize, uploadFile } from "../utils/fileUpload";
import ImageViewer from "./ImageViewer";
import { useCachedImage } from "../utils/imageCache";
import { IconButton, Backdrop, CircularProgress } from "@mui/material";
import {
  Send,
  AttachFile,
  MoreVert,
  Videocam,
  Phone,
} from "@mui/icons-material";
import { IoChevronBackOutline, IoCloudDownloadOutline } from "react-icons/io5";
import { CiUnread, CiRead } from "react-icons/ci";

interface ChatMessage extends Message {
  sender: AuthUser;
  status?: "sent" | "delivered" | "read";
  metadata?: {
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    fileUrl?: string;
  };
}

interface ChatParams extends Record<string, string> {
  friendId: string;
}

const MessageContent: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const { token } = useAuth();
  const [showImageViewer, setShowImageViewer] = useState(false);
  const { cachedUrl } = useCachedImage(message.content, {
    token: token || undefined,
  });

  switch (message.type) {
    case "image":
      return (
        <>
          <div className="image-container">
            <img
              src={cachedUrl}
              alt={message.metadata?.fileName || "Shared image"}
              className="message-image"
              loading="lazy"
              onClick={() => setShowImageViewer(true)}
              onError={(e) => {
                console.error("Image load error:", message.content);
                e.currentTarget.src = "";
              }}
            />
          </div>
          {showImageViewer && (
            <ImageViewer
              imageUrl={cachedUrl || ""}
              fileName={message.metadata?.fileName}
              onClose={() => setShowImageViewer(false)}
            />
          )}
        </>
      );

    case "file":
      const fileUrl = `${message.content}?token=${token}`;
      return (
        <a
          href={fileUrl}
          download={message.metadata?.fileName}
          className="file-attachment"
        >
          <AttachFile />
          <span className="file-name">{message.metadata?.fileName}</span>
          <span className="file-size">
            {formatFileSize(message.metadata?.fileSize)}{" "}
            <IoCloudDownloadOutline size={16} />
          </span>
        </a>
      );
    default:
      return <>{message.content}</>;
  }
};

const ChatWindow: React.FC = () => {
  const { friendId } = useParams<ChatParams>();
  const { user } = useAuth();
  const { sendMessage } = useWebSocket();
  const { updateTypingStatus, getUserStatus } = useChat();
  const [newMessage, setNewMessage] = useState("");
  const [typing, setTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(
    null
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: friend } = useQuery({
    queryKey: ["friend", friendId],
    queryFn: async () => {
      if (!friendId) throw new Error("No friend ID provided");

      const response = await api.get(`/api/user/${friendId}`);
      const userData = response.data.user;

      return {
        ...userData,
        status: getUserStatus(friendId),
        lastSeen:
          userData.lastSeen ||
          queryClient.getQueryData(["userLastSeen", friendId]),
      };
    },
    enabled: !!friendId,
    staleTime: 1000 * 60,
    refetchInterval: 2000,
  });

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["messages", friendId],
    queryFn: async () => {
      const response = await api.get(`/api/messages/${friendId}`);
      return response.data.messages;
    },
    enabled: !!friendId,
    refetchInterval: 2000,
    staleTime: 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      const typingStatusData = queryClient.getQueryData([
        "typingStatus",
        friendId,
      ]);
      setTyping(!!typingStatusData);
    });

    return () => {
      unsubscribe();
    };
  }, [friendId, queryClient]);

  useEffect(() => {
    const typingStatusData = queryClient.getQueryData([
      "typingStatus",
      friendId,
    ]);
    setTyping(!!typingStatusData);
  }, [friendId, queryClient]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const addNewMessage = useCallback(
    (message: ChatMessage) => {
      queryClient.setQueryData(
        ["messages", friendId],
        (oldMessages: ChatMessage[] | undefined) => {
          return oldMessages
            ? [...oldMessages, { ...message, status: "read" }]
            : [{ ...message, status: "read" }];
        }
      );
      scrollToBottom();
    },
    [queryClient, friendId, scrollToBottom]
  );

  const updateMessagesAsRead = useCallback(() => {
    queryClient.setQueryData(
      ["messages", friendId],
      (oldMessages: ChatMessage[] | undefined) => {
        if (!oldMessages) return [];
        return oldMessages.map((message) => ({
          ...message,
          status: message.senderId === friendId ? "read" : message.status,
        }));
      }
    );
  }, [friendId, queryClient]);

  const markMessageAsRead = useCallback(async () => {
    if (!friendId || !user?._id) return;

    try {
      await api.post(`/api/messages/mark-read/${friendId}`);
      updateMessagesAsRead();
      queryClient.invalidateQueries({ queryKey: ["friends"] });

      sendMessage({
        type: "read_status",
        senderId: user._id,
        receiverId: friendId,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  }, [friendId, queryClient, updateMessagesAsRead, user?._id, sendMessage]);

  useEffect(() => {
    if (friendId && messages.length > 0) {
      const hasUnreadMessages = messages.some(
        (msg: ChatMessage) => msg.senderId === friendId && msg.status !== "read"
      );

      if (hasUnreadMessages) {
        markMessageAsRead();
      }
    }
  }, [friendId, messages, markMessageAsRead]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user?._id) return;

    try {
      const messageToSend = {
        type: "text" as const,
        content: newMessage,
        senderId: user._id,
        receiverId: friendId,
        timestamp: new Date(),
      };

      const localMessage: ChatMessage = {
        _id: Date.now().toString(),
        type: "text",
        content: newMessage,
        senderId: user._id,
        receiverId: friendId,
        timestamp: messageToSend.timestamp,
        sender: user,
        status: "sent",
      };

      addNewMessage(localMessage);
      sendMessage(messageToSend);
      setNewMessage("");

      // save to db
      await api.post("/api/messages/send", messageToSend);
      queryClient.invalidateQueries({ queryKey: ["messages", friendId] });
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey && newMessage.trim()) {
      event.preventDefault();
      handleSendMessage();
      setNewMessage("");
    }
  };

  const sendTypingStatus = useCallback(
    (isTyping: boolean) => {
      if (friendId && user?._id) {
        const typingMessage = {
          type: "typing",
          senderId: user._id,
          receiverId: friendId,
          isTyping,
        };
        sendMessage(typingMessage);
        updateTypingStatus(friendId, isTyping);
      }
    },
    [friendId, user?._id, sendMessage, updateTypingStatus]
  );

  const handleMessageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);

    sendTypingStatus(true);

    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    const timeout = setTimeout(() => {
      sendTypingStatus(false);
    }, 2000);

    setTypingTimeout(timeout);
  };

  useEffect(() => {
    return () => {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
    };
  }, [typingTimeout]);

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file || !user?._id) return;

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await uploadFile(formData);

      const fileUrl = uploadResponse.fileUrl;

      //message type
      const messageType = file.type.startsWith("image/") ? "image" : "file";

      const messageToSend = {
        type: messageType,
        content: fileUrl,
        senderId: user._id,
        receiverId: friendId,
        timestamp: new Date(),
        status: "sent" as const,
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          fileUrl,
        },
      };

      const localMessage: ChatMessage = {
        _id: Date.now().toString(),
        sender: user,
        type: messageType,
        content: messageToSend.content,
        senderId: messageToSend.senderId,
        receiverId: messageToSend.receiverId,
        timestamp: messageToSend.timestamp,
        status: messageToSend.status,
        metadata: messageToSend.metadata,
      };

      addNewMessage(localMessage);
      sendMessage(messageToSend);

      await api.post("/api/messages/send", messageToSend);
      queryClient.invalidateQueries({ queryKey: ["messages", friendId] });
    } catch (error) {
      console.error("Error sending file:", error);
    }
  };

  const renderMessage = (message: ChatMessage) => {
    return <MessageContent message={message} />;
  };

  const handleFriendProfile = () => {
    navigate(`/friends-profile/${friendId}`);
  };

 
  return (
    <div className="chat-container">
      <div className="chat-window-header">
        {friend && (
          <section className="chat-window-section-flex">
            <NavLink
              to="/main-navigation/chats"
              className="login-redirection-arrow"
            >
              <IoChevronBackOutline size={20} color="#333" />
            </NavLink>
            <div className="friend-info" onClick={handleFriendProfile}>
              <div className="friend-avatar">
                {friend.avatarUrl ? (
                  <img src={friend.avatarUrl} alt={friend.firstName} />
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
              <div className="friend-details">
                <h3>
                  {`${friend.firstName} ${friend.lastName}`
                    .split(" ")
                    .map(
                      (name) =>
                        `${name.charAt(0).toUpperCase()}${name
                          .slice(1)
                          .toLowerCase()}`
                    )
                    .join(" ")}
                </h3>
                <span className="status">
                  {friend.status === "online" ? (
                    "Online"
                  ) : (
                    <>{formatLastSeen(friend.lastSeen)}</>
                  )}
                </span>
              </div>
            </div>

            <div className="profile-comm-btn-container">
              <IconButton>
                <Phone />
              </IconButton>
              <IconButton>
                <Videocam />
              </IconButton>
              <IconButton>
                <MoreVert />
              </IconButton>
            </div>
          </section>
        )}
      </div>

      <div className="messages-container">
        {isLoading ? (
          <div className="loading-container">
            <Backdrop
              sx={{
                color: "#208d7f",
                zIndex: (theme) => theme.zIndex.drawer + 1,
              }}
              open={isLoading}
            >
              <CircularProgress color="inherit" />
            </Backdrop>
          </div>
        ) : (
          <>
            {messages.map((message: ChatMessage, index: number) => (
              <div
                key={index}
                className={`message ${
                  message.senderId === user?._id ? "sent" : "received"
                }`}
              >
                <div className={`message-content ${message.type}`}>
                  {renderMessage(message)}
                  <span className="message-time" id="chat-windown-message-time">
                    {new Date(message.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {message.senderId === user?._id && (
                      <span className="chat-window-message-status">
                        {message.status === "read" ? (
                          <CiRead
                            size={18}
                            className="chat-window-message-status-icon read"
                          />
                        ) : (
                          <CiUnread
                            size={18}
                            className="chat-window-message-status-icon unread"
                          />
                        )}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            ))}
            {typing && friend && (
              <div className="typing-indicator">
                <div className="typing-indicator-bubble">
                  <div className="typing-indicator-dot"></div>
                  <div className="typing-indicator-dot"></div>
                  <div className="typing-indicator-dot"></div>
                </div>
                <span className="typing-indicator-text">
                  {friend?.firstName} is typing...
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        style={{ display: "none" }}
        accept="image/*,.pdf,.docx,.txt"
      />

      <div className="message-input-container">
        <IconButton onClick={() => fileInputRef.current?.click()}>
          <AttachFile />
        </IconButton>
        <input
          className="message-input"
          value={newMessage}
          onChange={handleMessageInput}
          onKeyUp={handleKeyPress}
          placeholder="Type a message..."
          type="text"
        />
        <IconButton onClick={handleSendMessage} disabled={!newMessage.trim()}>
          <Send
            sx={{
              color: !newMessage.trim() ? "rgba(0, 0, 0, 0.26)" : "#208d7f",
            }}
          />
        </IconButton>
      </div>
    </div>
  );
};

export default ChatWindow;
