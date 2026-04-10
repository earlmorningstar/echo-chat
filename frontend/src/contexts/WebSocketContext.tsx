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
  eventManager: React.RefObject<WebSocketEventManager | null>;
  isConnected: boolean;
  connectionState: number;
  /** Increments each time a new WebSocketEventManager is created. Consumers
   *  should include this in useEffect deps to re-subscribe after reconnects. */
  managerReady: number;
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
  managerReady: 0,
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
  /** Increments each time a new WebSocketEventManager is created, so consumers
   *  can re-subscribe when the manager instance changes (e.g. after reconnect). */
  const [managerReady, setManagerReady] = useState(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const connectionAttempts = useRef<number>(0);
  const lastStatusRef = useRef<UserStatus>("offline");
  const isConnecting = useRef<boolean>(false);
  const pendingMessages = useRef<pendingMessage[]>([]);
  const connectRef = useRef<ConnectFunction | undefined>(undefined);
  const cleanupConnectionRef = useRef<(() => void) | undefined>(undefined);
  /** Single shared ref for the ping interval — prevents duplicate intervals
   *  when connect() is called again before the previous socket fully closes. */
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Stable refs for use inside handleWebSocketMessage ──────────────
  // These keep the callback stable (empty deps []) while still giving it
  // access to the latest queryClient and userId without causing re-creation.
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;
  const userIdRef = useRef<string | null>(user?._id ?? null);
  userIdRef.current = user?._id ?? null;

  const sendMessage = useCallback(async (message: any) => {
    if (!eventManager.current?.isConnected) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (!eventManager.current?.isConnected) return;
    }

    //to maintain message queue health
    const now = Date.now();
    pendingMessages.current = pendingMessages.current.filter(
      (msg) => now - msg.timestamp < 300000, // 5-minute TTL
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
          message.type.startsWith("status") ? 2 : 1,
        );
      } catch (error) {
        console.error(`Failed to send message: ${message.type}`);
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
    if (pingIntervalRef.current !== null) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
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
    // eslint-disable-next-line
  }, [sendMessage, user?._id, queryClient]);

  useEffect(() => {
    cleanupConnectionRef.current = cleanupConnection;
  }, [cleanupConnection]);

  /**
   * Centralized handler for incoming WebSocket messages.
   * Uses refs (queryClientRef, userIdRef, lastStatusRef, eventManager)
   * so this callback is stable with an empty dependency array — preventing
   * the reconnect-storm bug when deps change.
   */
  const handleWebSocketMessage = useCallback(
    (message: any) => {
      if (!message || typeof message !== "object") return;

      const qc = queryClientRef.current;
      const currentUserId = userIdRef.current;

      const handlers: Record<string, () => void> = {
        typing: () => {
          qc.setQueryData(["typingStatus", message.senderId], message.isTyping);
          qc.setQueryData(
            ["friendTypingStatus", message.senderId],
            message.isTyping,
          );
          if (!message.isTyping) return;

          setTimeout(() => {
            qc.setQueryData(["typingStatus", message.senderId], false);
          }, 5000);
        },
        // FIX #1 — invalidate the correct query keys.
        // ChatWindow uses ["messages", friendId] (plural).  We invalidate
        // every query whose first key segment is "messages" so all open
        // chat windows refetch when a new message arrives.
        message: () => {
          qc.invalidateQueries({
            predicate: (query) => query.queryKey[0] === "messages",
          });
          qc.invalidateQueries({ queryKey: ["friends"] });
        },
        read_status: () => {
          qc.invalidateQueries({
            predicate: (query) => query.queryKey[0] === "messages",
          });
          qc.invalidateQueries({ queryKey: ["friends"] });
        },
        status: () => {
          if (message.userId === currentUserId) {
            lastStatusRef.current = message.status;
          }
          qc.setQueryData(["userStatus", message.userId], message.status);
          if (message.lastSeen) {
            qc.setQueryData(["userLastSeen", message.userId], message.lastSeen);
          }
          qc.invalidateQueries({ queryKey: ["friends"] });
        },
        call_initiate: () => {
          eventManager.current?.emit("call", {
            type: "call_initiate",
            callId: message.callId,
            callerId: message.callerId,
            callType: message.callType,
            token: message.token,
            roomName: message.roomName,
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
            force: true,
          });
        },
      };

      const handler = handlers[message.type];
      if (handler) {
        try {
          handler();
        } catch (error) {
          console.error(`Error handling ${message.type}`);
        }
      }
    },
    [], // stable — all mutable state accessed via refs
  );

  const connect = useCallback<ConnectFunction>(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;
    if (!user?._id || isConnecting.current) return;

    //clearing existing connection if in invalid state
    if (ws.current) {
      const state = ws.current.readyState as number;
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
          socket.close();
          isConnecting.current = false;
        }
      }, 5000);

      socket.onopen = () => {
        clearTimeout(connectTimeout);
        // console.log("WebSocket connected");
        // console.log("WS Connected - User ID:", user?._id);
        setIsConnected(true);
        connectionAttempts.current = 0;
        isConnecting.current = false;

        eventManager.current = new WebSocketEventManager(socket);
        eventManager.current.on("message", handleWebSocketMessage);

        // Signal consumers that a fresh manager exists and they should subscribe.
        setManagerReady((g) => g + 1);

        //sending registration message with auth token
        if (user._id) {
          const token = localStorage.getItem("token");
          eventManager.current?.enqueueEvent(
            "register",
            {
              type: "register",
              senderId: user._id,
              token: token || undefined,
              status: lastStatusRef.current,
              timestamp: Date.now(),
              requireAck: true,
              id: `reg-${Date.now()}`,
            },
            2,
          );
        }

        //processing pending messages
        const now = Date.now();
        pendingMessages.current = pendingMessages.current.filter(
          (msg) => now - msg.timestamp < 300000,
        );
        pendingMessages.current.forEach((msg) => {
          eventManager.current?.enqueueEvent(
            msg.type,
            msg.data,
            msg.priority || 1,
          );
        });
        pendingMessages.current = [];
      };

      // Clear any previous ping interval before starting a new one
      if (pingIntervalRef.current !== null) {
        clearInterval(pingIntervalRef.current);
      }
      pingIntervalRef.current = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "ping" }));
        }
      }, 25000);

      socket.onclose = () => {
        if (pingIntervalRef.current !== null) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        clearTimeout(connectTimeout);
        // console.log("WebSocket disconnected");
        setIsConnected(false);
        isConnecting.current = false;
        cleanupConnection();

        //exponential backoff reconnect
        if (connectionAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(
            RECONNECT_DELAY * Math.pow(2, connectionAttempts.current),
            30000, // max 30 seconds
          );
          connectionAttempts.current++;
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
      };

      socket.onerror = (error) => {
        // console.error("WebSocket error");
        isConnecting.current = false;
        socket.close();
      };
    } catch (error) {
      // console.error("WebSocket initialization error:", error);
      isConnecting.current = false;
      cleanupConnection();
    }
    // eslint-disable-next-line
  }, [user?._id, cleanupConnection]);

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
        // console.log("WS connection state:", ws.current?.readyState);
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
          handleVisibilityChange,
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
        managerReady,
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
