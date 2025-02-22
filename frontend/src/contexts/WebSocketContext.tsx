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
import { WebSocketEventManager } from "./calls/WebSocketEventManager ";

interface WebSocketContextType {
  sendMessage: (message: any) => Promise<void>;
  eventManager: WebSocketEventManager | null;
  isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(
  undefined
);
const RECONNECT_DELAY = 1000;
const MAX_RECONNECT_ATTEMPTS = 5;

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
  const pendingMessages = useRef<
    Array<{ type: string; data: any; timestamp: number }>
  >([]);

  const cleanupConnection = useCallback(() => {
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
  }, []);

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
          queryClient.setQueryData(["callEvent"], {
            type: "incoming",
            data: {
              initiatorId: message.initiatorId,
              type: message.callType,
              roomName: message.roomName,
            },
          });
        },
        call_accepted: () => {
          queryClient.setQueryData(["callEvent"], {
            type: "accepted",
            data: message,
          });
        },
        call_rejected: () => {
          queryClient.setQueryData(["callEvent"], {
            type: "rejected",
            data: message,
          });
        },
        call_ended: () => {
          queryClient.setQueryData(["callEvent"], {
            type: "ended",
            data: {
              roomName: message.roomName,
              initiatorId: message.senderId,
              forceCleanup: true,
            },
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
    [queryClient, user?._id]
  );

  const connect = useCallback(() => {
    if (!user?._id || isConnecting.current) return;

    //checkingg existing connection state
    if (ws.current) {
      const state = ws.current.readyState;
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return;
    }

    // Clear existing connection if needed
    if (
      ws.current &&
      (ws.current.readyState === WebSocket.OPEN ||
        ws.current.readyState === WebSocket.CONNECTING)
    ) {
      ws.current.close();
    }

    isConnecting.current = true;
    cleanupConnection();

    try {
      const wsUrl = process.env.REACT_APP_WS_URL || "ws://localhost:5000";
      const socket = new WebSocket(wsUrl);
      ws.current = socket;

      socket.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
        connectionAttempts.current = 0;
        isConnecting.current = false;

        eventManager.current = new WebSocketEventManager(socket);
        eventManager.current.on("message", handleWebSocketMessage);

        if (user._id) {
          eventManager.current.enqueueEvent(
            "register",
            {
              type: "register",
              senderId: user._id,
              status: lastStatusRef.current,
            },
            2
          );
        }

        //processing pending messages with TTL
        const now = Date.now();
        pendingMessages.current = pendingMessages.current.filter(
          (msg) => now - msg.timestamp < 300000 // 5-minute TTL
        );
        while (pendingMessages.current.length > 0) {
          const msg = pendingMessages.current.shift();
          if (msg && eventManager.current) {
            eventManager.current.enqueueEvent(
              msg.type,
              msg.data,
              msg.type.startsWith("status") ? 2 : 1
            );
          }
        }
      };

      socket.onclose = () => {
        console.log("WebSocket disconnected");
        setIsConnected(false);
        isConnecting.current = false;
        cleanupConnection();

        if (connectionAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(
            RECONNECT_DELAY * Math.pow(2, connectionAttempts.current),
            30000
          );
          connectionAttempts.current++;
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
      };

      socket.onerror = (error) => {
        console.error("WebSocket error");
        isConnecting.current = false;
      };
    } catch (error) {
      console.error("WebSocket initialization error");
      isConnecting.current = false;
      cleanupConnection();
    }
  }, [user?._id, cleanupConnection, handleWebSocketMessage]);

  const sendMessage = useCallback(
    async (message: any) => {

      //remove
      // if (
      //   !isConnected ||
      //   connectionAttempts.current >= MAX_RECONNECT_ATTEMPTS
      // ) {
      //   console.warn("Message queued offline:", message.type);
      //   pendingMessages.current.push({
      //     type: message.type,
      //     data: message,
      //     timestamp: Date.now(),
      //   });
      //   connect();
      //   return;
      // }
      //remove

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
          timestamp: Date.now(),
        });
        connect();
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
            timestamp: Date.now(),
          });
        }
      }
    },
    [connect]
  );

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
      value={{ sendMessage, eventManager: eventManager.current, isConnected }}
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
