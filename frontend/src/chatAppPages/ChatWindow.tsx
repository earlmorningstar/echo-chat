import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, NavLink } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../utils/api";
import { Message, AuthUser } from "../types";
import {
  IconButton,
  Backdrop,
  // TextField,
  CircularProgress,
} from "@mui/material";
import { Send, AttachFile, MoreVert } from "@mui/icons-material";
import { IoChevronBackOutline } from "react-icons/io5";
import { CiUnread, CiRead } from "react-icons/ci";

interface ChatMessage extends Message {
  sender: AuthUser;
  status?: "sent" | "delivered" | "read";
  // senderId: string;
}

interface ChatParams extends Record<string, string> {
  friendId: string;
}

const ChatWindow: React.FC = () => {
  const { friendId } = useParams<ChatParams>();
  const { user } = useAuth();
  const [newMessage, setNewMessage] = useState("");
  const [typing, setTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(
    null
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const ws = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();

  const { data: friend } = useQuery({
    queryKey: ["friend", friendId],
    queryFn: async () => {
      const response = await api.get(`/api/user/${friendId}`);
      return response.data.user;
    },
    enabled: !!friendId,
    staleTime: 1000 * 60,
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
    if (!friendId) return;

    try {
      await api.post(`/api/messages/mark-read/${friendId}`);
      updateMessagesAsRead();
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  }, [friendId, queryClient, updateMessagesAsRead]);

  const initializeWebSocket = useCallback(() => {
    ws.current = new WebSocket(
      process.env.REACT_APP_WS_URL || "ws://localhost:5000"
    );

    ws.current.onopen = () => {
      console.log("WebSocket connected");
    };

    ws.current.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.current.onclose = () => {
      console.log("WebSocket disconnected");
    };

    ws.current.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log("WebSocket message received:", message);

        if (message.type === "message") {
          if (message.senderId === friendId) {
            await markMessageAsRead();
          }
          queryClient.setQueryData(
            ["messages", friendId],
            (oldMessages: ChatMessage[] | undefined) => {
              const messageExists = oldMessages?.some(
                (m) =>
                  m.content === message.content &&
                  m.senderId === message.senderId &&
                  new Date(m.timestamp).getTime() ===
                    new Date(message.timestamp).getTime()
              );
              if (!messageExists) {
                const newMessage = {
                  ...message,
                  status:
                    message.senderId === friendId ? "read" : message.status,
                };
                return oldMessages
                  ? [...oldMessages, newMessage]
                  : [newMessage];
              }
              return oldMessages;
            }
          );
          scrollToBottom();
        } else if (message.type === "typing" && message.senderId === friendId) {
          setTyping(message.isTyping);
         }
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
      }
    };
  }, [
    friendId,
    queryClient,
    scrollToBottom,
    markMessageAsRead,
  ]);

  useEffect(() => {
    if (friendId) {
      markMessageAsRead();
    }
  }, [friendId, markMessageAsRead]);

  useEffect(() => {
    if (friendId) {
      initializeWebSocket();
    }

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [friendId, initializeWebSocket]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !ws.current || !user?._id) return;

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

      ws.current.send(JSON.stringify(messageToSend));
      setNewMessage("");

      //save to db
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
      if (ws.current && friendId && user?._id) {
        const typingMessage = {
          type: "typing",
          senderId: user._id,
          receiverId: friendId,
          isTyping,
        };
        ws.current.send(JSON.stringify(typingMessage));
      }
    },
    [friendId, user?._id]
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

  return (
    <div className="chat-container">
      <div className="chat-window-header">
        {friend && (
          <>
            <div className="friend-info">
              <NavLink
                to="/main-navigation/chats"
                className="login-redirection-arrow"
              >
                <IoChevronBackOutline size={20} color="#333" />
              </NavLink>
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
                <h3>{`${friend.firstName} ${friend.lastName}`}</h3>
                <span className="status">
                  {friend.status === "online" ? "Online" : "Offline"}
                </span>
              </div>
            </div>

            <IconButton>
              <MoreVert />
            </IconButton>
          </>
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
                <div className="message-content">
                  {message.content}
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

      <div className="message-input-container">
        <IconButton>
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
        {/* <TextField
        className="message-input"
          fullWidth
          multiline
          maxRows={4}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Type a message..."
          variant="standard"
          size="small"
        /> */}

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
