import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../utils/api";
import { Message, AuthUser } from "../types";
import { IconButton, TextField, CircularProgress } from "@mui/material";
import { Send, AttachFile, MoreVert } from "@mui/icons-material";

interface ChatMessage extends Message {
  sender: AuthUser;
  // senderId: string;
}

interface ChatParams extends Record<string, string> {
  friendId: string;
}

const ChatWindow: React.FC = () => {
  const { friendId } = useParams<ChatParams>();
  const { user } = useAuth();
  const [friend, setFriend] = useState<AuthUser | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const ws = useRef<WebSocket | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const addNewMessage = useCallback(
    (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
      scrollToBottom();
    },
    [scrollToBottom]
  );

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

    ws.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log("WebSocket message received:", message);

        if (message.type === "message") {
          setMessages((prev) => {
            const messageExists = prev.some(
              (m) =>
                m.content === message.content &&
                m.senderId === message.senderId &&
                new Date(m.timestamp).getTime() ===
                  new Date(message.timestamp).getTime()
            );
            if (!messageExists) {
              return [...prev, message];
            }
            return prev;
          });
          scrollToBottom();
        } else if (message.type === "typing" && message.senderId === friendId) {
          setTyping(message.isTyping);
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
      }
    };
  }, [friendId, scrollToBottom]);

  const fetchFriendDetails = useCallback(async () => {
    try {
      const response = await api.get(`/api/user/${friendId}`);
      setFriend(response.data.user);
    } catch (error) {
      console.error("Error fetching friend details:", error);
    }
  }, [friendId]);

  const fetchChatHistory = useCallback(async () => {
    try {
     
      const response = await api.get(`/api/messages/${friendId}`);
      
      setMessages(response.data.messages);
      setLoading(false);
      scrollToBottom();
    } catch (error: any) {
      console.error("Error fetching chat history:", {
        status: error.response?.status,
        data: error.response?.data,
        friendId,
      });
      setLoading(false);
    }
  }, [friendId, scrollToBottom]);

  useEffect(() => {
       const initialize = async () => {
      initializeWebSocket();
      await fetchFriendDetails();
      await fetchChatHistory();
    };

    if (friendId) {
      initialize();
    }

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [friendId, fetchChatHistory, fetchFriendDetails, initializeWebSocket]);

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
      };

      addNewMessage(localMessage);

      ws.current.send(JSON.stringify(messageToSend));
      setNewMessage("");

      //save to db
      await api.post("/api/messages/send", messageToSend);
    } catch (error) {
      console.error("Error sending message:", error);
    }

    setMessages((prev) =>
      prev.filter((msg) => msg._id !== Date.now().toString())
    );
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        {friend && (
          <>
            <div className="friend-info">
              <div className="friend-avatar">
                {friend.avatarUrl ? (
                  <img src={friend.avatarUrl} alt={friend.firstName} />
                ) : (
                  <div className="default-avatar">
                    {friend.firstName[0]}
                    {friend.lastName[0]}
                  </div>
                )}
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
        {loading ? (
          <div className="loading-container">
            <CircularProgress />
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <div
                key={index}
                className={`message ${
                  message.senderId === user?._id ? "sent" : "received"
                }`}
              >
                <div className="message-content">
                  {message.content}
                  <span className="message-time">
                    {new Date(message.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ))}
            {typing && (
              <div className="typing-indicator">
                {friend?.firstName} is typing...
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
        <TextField
          fullWidth
          multiline
          maxRows={4}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          variant="outlined"
          size="small"
        />
        <IconButton
          color="primary"
          onClick={handleSendMessage}
          disabled={!newMessage.trim()}
        >
          <Send />
        </IconButton>
      </div>
    </div>
  );
};

export default ChatWindow;
