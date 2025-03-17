import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./AuthContext";
import { UserStatus } from "../types";
import { WebSocketEventManager } from "./calls/WebSocketEventManager";

interface WebSocketContextType {
  sendMessage: (message: any) => Promise<void>;
  eventManager: React.RefObject<WebSocketEventManager>;
  isConnected: boolean;
  connectionState: number;
}

interface pendingMessage {
  type: string;
  data: any;
  priority: number;
  timestamp: number;
}

const WebSocketContext = createContext<WebSocketContextType>({
  sendMessage: async () => {},
  eventManager: { current: null },
  isConnected: false,
  connectionState: WebSocket.CLOSED,
});

const RECONNECT_DELAY = 1000;
const MAX_RECONNECT_ATTEMPTS = 5;

type ConnectFunction = () => void;

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const ws = useRef<WebSocket | null>(null);
  const eventManager = useRef<WebSocketEventManager | null>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const connectionAttempts = useRef(0);
  const lastStatusRef = useRef<UserStatus>("offline");
  const isConnecting = useRef(false);
  const pendingMessages = useRef<pendingMessage[]>([]);
  const connectRef = useRef<ConnectFunction>();
  const cleanupConnectionRef = useRef<() => void>();

  const sendMessage = useCallback(async (message: any) => {
    if (!eventManager.current?.isConnected) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (!eventManager.current?.isConnected) return;
    }

    //to maintain message queue health
    const now = Date.now();
    pendingMessages.current = pendingMessages.current.filter(
      (msg) => now - msg.timestamp < 300000 // 5-minute TTL
    );
    if (pendingMessages.current.length >= 50) {
      pendingMessages.current.shift();
    }

    if (
      !eventManager.current &&
      connectionAttempts.current < MAX_RECONNECT_ATTEMPTS
    ) {
      pendingMessages.current.push({
        type: message.type,
        data: message,
        priority: 1,
        timestamp: Date.now(),
      });
      connectRef.current?.();
      return;
    }

    if (eventManager.current) {
      try {
        await eventManager.current.enqueueEvent(
          message.type,
          message,
          message.type.startsWith("status") ? 2 : 1
        );
      } catch (error) {
        console.error(`Failed to send message: ${message.type}`, error);
        //store failed messages for retry
        pendingMessages.current.push({
          type: message.type,
          data: message,
          priority: 1,
          timestamp: Date.now(),
        });
      }
    }
  }, []);

  const cleanupConnection = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      sendMessage({
        type: "status",
        senderId: user?._id,
        status: "online",
        timestamp: Date.now(),
      });
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }

    if (eventManager.current) {
      eventManager.current.cleanup();
      eventManager.current = null;
    }

    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }

    setIsConnected(false);
    queryClient.invalidateQueries({ queryKey: ["typingStatus"] });
  }, [sendMessage, user?._id, queryClient]);

  useEffect(() => {
    cleanupConnectionRef.current = cleanupConnection;
  }, [cleanupConnection]);

  const handleWebSocketMessage = useCallback(
    (message: any) => {
      if (!message || typeof message !== "object") return;

      const handlers: Record<string, () => void> = {
        typing: () => {
          queryClient.setQueryData(
            ["typingStatus", message.senderId],
            message.isTyping
          );
          queryClient.setQueryData(
            ["friendTypingStatus", message.senderId],
            message.isTyping
          );
          if (!message.isTyping) return;

          setTimeout(() => {
            queryClient.setQueryData(["typingStatus", message.senderId], false);
          }, 5000);
        },
        message: () => {
          queryClient.invalidateQueries({ queryKey: ["message"] });
          queryClient.invalidateQueries({ queryKey: ["friends"] });
        },
        read_status: () => {
          queryClient.invalidateQueries({ queryKey: ["message"] });
          queryClient.invalidateQueries({ queryKey: ["friends"] });
        },
        status: () => {
          if (message.userId === user?._id) {
            lastStatusRef.current = message.status;
          }
          queryClient.setQueryData(
            ["userStatus", message.userId],
            message.status
          );
          if (message.lastSeen) {
            queryClient.setQueryData(
              ["userLastSeen", message.userId],
              message.lastSeen
            );
          }
          queryClient.invalidateQueries({ queryKey: ["friends"] });
        },
        call_initiate: () => {
          eventManager.current?.emit("call", {
            type: "call_initiate",
            callId: message.callId,
            callerId: message.callerId,
            callType: message.callType,
            timestamp: message.timestamp,
          });
        },
        call_accept: () => {
          eventManager.current?.emit("call", {
            type: "call_accept",
            callId: message.callId,
            acceptorId: message.acceptorId,
            roomName: message.roomName,
            token: message.token,
          });
        },
        call_reject: () => {
          eventManager.current?.emit("call", {
            type: "call_reject",
            callId: message.callId,
            rejectorId: message.rejectorId,
          });
        },
        call_end: () => {
          eventManager.current?.emit("call", {
            type: "call_end",
            callId: message.callId,
            endedBy: message.endedBy,
          });
        },
      };

      const handler = handlers[message.type];
      if (handler) {
        try {
          handler();
        } catch (error) {
          console.error(`Error handling ${message.type}:`, error);
        }
      }
    },
    [queryClient, user?._id, eventManager]
  );

  const connect = useCallback<ConnectFunction>(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;
    if (!user?._id || isConnecting.current) return;

    //clearing existing connection if in invalid state
    if (ws.current) {
      const state = ws.current.readyState;
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
        ws.current.close();
      }
    }

    if (isConnecting.current) return;
    isConnecting.current = true;
    cleanupConnection();

    try {
      const wsUrl = process.env.REACT_APP_WS_URL || "ws://localhost:5000";
      const socket = new WebSocket(wsUrl);
      ws.current = socket;

      const connectTimeout = setTimeout(() => {
        if (socket.readyState === WebSocket.CONNECTING) {
          console.warn("WebSocket connection timeout");
          socket.close();
          isConnecting.current = false;
        }
      }, 5000);

      socket.onopen = () => {
        clearTimeout(connectTimeout);
        console.log("WebSocket connected");
        console.log("WS Connected - User ID:", user?._id);
        setIsConnected(true);
        connectionAttempts.current = 0;
        isConnecting.current = false;

        eventManager.current = new WebSocketEventManager(socket);
        eventManager.current.on("message", handleWebSocketMessage);

        //sending registration message
        if (user._id) {
          eventManager.current?.enqueueEvent(
            "register",
            {
              type: "register",
              senderId: user._id,
              status: lastStatusRef.current,
              timestamp: Date.now(),
              requireAck: true,
              id: `reg-${Date.now()}`,
            },
            2
          );
        }

        //processing pending messages
        const now = Date.now();
        pendingMessages.current = pendingMessages.current.filter(
          (msg) => now - msg.timestamp < 300000
        );
        pendingMessages.current.forEach((msg) => {
          eventManager.current?.enqueueEvent(
            msg.type,
            msg.data,
            msg.priority || 1
          );
        });
        pendingMessages.current = [];
      };

      const pingInterval = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "ping" }));
        }
      }, 25000);

      socket.onclose = () => {
        clearInterval(pingInterval);
        clearTimeout(connectTimeout);
        console.log("WebSocket disconnected");
        setIsConnected(false);
        isConnecting.current = false;
        cleanupConnection();

        //exponential backoff reconnect
        if (connectionAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(
            RECONNECT_DELAY * Math.pow(2, connectionAttempts.current),
            30000 // max 30 seconds
          );
          connectionAttempts.current++;
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
      };

      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        isConnecting.current = false;
        socket.close();
      };
    } catch (error) {
      console.error("WebSocket initialization error:", error);
      isConnecting.current = false;
      cleanupConnection();
    }
  }, [user?._id, cleanupConnection, handleWebSocketMessage]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isConnected) connect();
    }, 15000);
    return () => clearInterval(interval);
  }, [isConnected, connect]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    if (user?._id) {
      connect();

      const handleVisibilityChange = () => {
        const isVisible = document.visibilityState === "visible";
        if (isVisible && ws.current?.readyState !== WebSocket.OPEN) {
          connect();
        }
        sendMessage({
          type: "status",
          senderId: user._id,
          status: isVisible ? "online" : "offline",
          timestamp: Date.now(),
        });
      };

      const handleBeforeUnload = () => {
        sendMessage({
          type: "status",
          senderId: user._id,
          status: "offline",
          timestamp: Date.now(),
        });
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);
      window.addEventListener("beforeunload", handleBeforeUnload);

      return () => {
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange
        );
        window.removeEventListener("beforeunload", handleBeforeUnload);
        cleanupConnection();
      };
    }
  }, [user?._id, connect, sendMessage, cleanupConnection]);

  useEffect(() => {
    const handleConnectionChange = () => {
      if (ws.current) {
        setIsConnected(ws.current.readyState === WebSocket.OPEN);
      }
    };

    window.addEventListener("online", handleConnectionChange);
    window.addEventListener("offline", handleConnectionChange);

    return () => {
      window.removeEventListener("online", handleConnectionChange);
      window.removeEventListener("offline", handleConnectionChange);
    };
  }, []);

  return (
    <WebSocketContext.Provider
      value={{
        sendMessage,
        eventManager,
        isConnected,
        connectionState:
          eventManager.current?.connectionState ?? WebSocket.CLOSED,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
};
