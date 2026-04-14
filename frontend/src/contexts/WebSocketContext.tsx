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

// ─── Interfaces ───────────────────────────────────────────────────────

/** Shape of a message sent through the WebSocket. */
export interface WSSendMessage {
  type: string;
  senderId?: string | null;
  receiverId?: string | null;
  status?: string;
  timestamp?: number | Date;
  content?: string;
  metadata?: Record<string, unknown>;
  isTyping?: boolean;
  callId?: string;
  callerId?: string | null;
  recipientId?: string | null;
  acceptorId?: string;
  rejectorId?: string | null;
  endedBy?: string | null;
  callType?: string;
  roomName?: string;
  token?: string;
  originalId?: string;
  requireAck?: boolean;
  [key: string]: unknown;
}

/** A pending message waiting for delivery when the socket reconnects. */
interface PendingMessage {
  type: string;
  data: Record<string, unknown>;
  priority: number;
  timestamp: number;
}

/** Context value exposed to consumers. */
interface WebSocketContextType {
  sendMessage: (message: WSSendMessage) => Promise<void>;
  eventManager: React.RefObject<WebSocketEventManager | null>;
  isConnected: boolean;
  connectionState: number;
  managerReady: number;
}

// ─── Constants ────────────────────────────────────────────────────────

const MESSAGE_TTL_MS = 300_000;
const MAX_PENDING_MESSAGES = 50;
const CONNECT_TIMEOUT_MS = 5_000;
const RECONNECT_CHECK_INTERVAL_MS = 15_000;
const TYPING_RESET_TIMEOUT_MS = 5_000;

// ─── Context ──────────────────────────────────────────────────────────

const WebSocketContext = createContext<WebSocketContextType>({
  sendMessage: async () => {},
  eventManager: { current: null },
  isConnected: false,
  connectionState: WebSocket.CLOSED,
  managerReady: 0,
});

// ─── Provider ─────────────────────────────────────────────────────────

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const wsRef = useRef<WebSocket | null>(null);
  const eventManagerRef = useRef<WebSocketEventManager | null>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [managerReady, setManagerReady] = useState(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const lastStatusRef = useRef<UserStatus>("offline");
  const isConnectingRef = useRef(false);
  const pendingMessagesRef = useRef<PendingMessage[]>([]);
  const connectRef = useRef<(() => void) | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stable refs so handleWebSocketMessage never needs to recreate
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;
  const userIdRef = useRef<string | null>(user?._id ?? null);
  userIdRef.current = user?._id ?? null;

  // ── sendMessage ────────────────────────────────────────────────────

  const sendMessage = useCallback(async (message: WSSendMessage) => {
    if (!eventManagerRef.current?.isConnected) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (!eventManagerRef.current?.isConnected) return;
    }

    const now = Date.now();
    pendingMessagesRef.current = pendingMessagesRef.current.filter(
      (msg) => now - msg.timestamp < MESSAGE_TTL_MS,
    );
    if (pendingMessagesRef.current.length >= MAX_PENDING_MESSAGES) {
      pendingMessagesRef.current.shift();
    }

    if (!eventManagerRef.current) {
      pendingMessagesRef.current.push({
        type: message.type,
        data: message as Record<string, unknown>,
        priority: 1,
        timestamp: Date.now(),
      });
      connectRef.current?.();
      return;
    }

    if (eventManagerRef.current) {
      try {
        const priority = message.type.startsWith("status") ? 2 : 1;
        await eventManagerRef.current.enqueueEvent(
          message.type,
          message as Record<string, unknown>,
          priority,
        );
      } catch (error: unknown) {
        console.error(`Failed to send message: ${message.type}`, error);
        pendingMessagesRef.current.push({
          type: message.type,
          data: message as Record<string, unknown>,
          priority: 1,
          timestamp: Date.now(),
        });
      }
    }
  }, []);

  // ── cleanupConnection ──────────────────────────────────────────────

  const cleanupConnection = useCallback(() => {
    if (pingIntervalRef.current !== null) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current !== null) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventManagerRef.current) {
      eventManagerRef.current.cleanup();
      eventManagerRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    queryClient.invalidateQueries({ queryKey: ["typingStatus"] });
  }, [queryClient]);

  useEffect(() => {
    connectRef.current = () => connect();
  });

  // ── handleWebSocketMessage (stable: [] deps) ───────────────────────

  const handleWebSocketMessage = useCallback(
    (message: Record<string, unknown>) => {
      console.log("[WS] RAW WS EVENT RECEIVED:", message?.type, message);
      if (!message || typeof message !== "object") return;

      const qc = queryClientRef.current;
      const currentUserId = userIdRef.current;

      const invalidateMessageQueries = () => {
        qc.invalidateQueries(
          {
            predicate: (query) => {
              const keyStr = JSON.stringify(query.queryKey).toLowerCase();
              const isTarget =
                keyStr.includes("message") || keyStr.includes("friend");
              if (isTarget) {
                console.log("[WS] 🔁 MATCH — refetching:", query.queryKey);
              }
              return isTarget;
            },
          },
          { cancelRefetch: true },
        );
      };

      const handlers: Record<string, () => void> = {
        typing: () => {
          qc.setQueryData(
            ["typingStatus", message.senderId],
            message.isTyping ?? false,
          );
          qc.setQueryData(
            ["friendTypingStatus", message.senderId],
            message.isTyping ?? false,
          );
          if (message.isTyping) {
            setTimeout(() => {
              qc.setQueryData(["typingStatus", message.senderId], false);
            }, TYPING_RESET_TIMEOUT_MS);
          }
        },
        // Accepts "message" (backend envelope) and "text" (content type)
        message: invalidateMessageQueries,
        text: invalidateMessageQueries,
        read_status: invalidateMessageQueries,
        status: () => {
          if (message.userId === currentUserId) {
            lastStatusRef.current = message.status as UserStatus;
          }
          qc.setQueryData(["userStatus", message.userId], message.status);
          if (message.lastSeen !== undefined) {
            qc.setQueryData(["userLastSeen", message.userId], message.lastSeen);
          }
          qc.invalidateQueries(
            {
              predicate: (query) =>
                JSON.stringify(query.queryKey).toLowerCase().includes("friend"),
            },
            { cancelRefetch: true },
          );
        },
        call_initiate: () => {
          eventManagerRef.current?.emit("call", {
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
          eventManagerRef.current?.emit("call", {
            type: "call_accept",
            callId: message.callId,
            acceptorId: message.acceptorId,
            roomName: message.roomName,
            token: message.token,
          });
        },
        call_reject: () => {
          eventManagerRef.current?.emit("call", {
            type: "call_reject",
            callId: message.callId,
            rejectorId: message.rejectorId,
          });
        },
        call_end: () => {
          eventManagerRef.current?.emit("call", {
            type: "call_end",
            callId: message.callId,
            endedBy: message.endedBy,
            force: true,
          });
        },
      };

      const handler = handlers[message.type as string];
      if (handler) {
        try {
          handler();
        } catch (error) {
          console.error(`Error handling ${message.type}`);
        }
      }
    },
    [], // stable — all mutable state via refs
  );

  // ── connect ────────────────────────────────────────────────────────

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (!user?._id || isConnectingRef.current) return;

    if (wsRef.current) {
      const state = wsRef.current.readyState as number;
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
        wsRef.current.close();
        setTimeout(() => connect(), 100);
        return;
      }
    }

    isConnectingRef.current = true;
    cleanupConnection();

    try {
      const wsUrl = process.env.REACT_APP_WS_URL || "ws://localhost:5000";
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      const connectTimeout = setTimeout(() => {
        if (socket.readyState === WebSocket.CONNECTING) {
          socket.close();
          isConnectingRef.current = false;
        }
      }, CONNECT_TIMEOUT_MS);

      socket.onopen = () => {
        if (isConnectingRef.current === false && isDestroyedRef.current) return;
        clearTimeout(connectTimeout);
        setIsConnected(true);
        isConnectingRef.current = false;

        eventManagerRef.current = new WebSocketEventManager(socket);
        const unsubscribe = eventManagerRef.current.on(
          "message",
          handleWebSocketMessage,
        );
        (eventManagerRef.current as unknown as Record<string, unknown>)[
          "_unsubscribeMessage"
        ] = unsubscribe;
        setManagerReady((g) => g + 1);

        if (user._id) {
          const token = localStorage.getItem("token");
          eventManagerRef.current.enqueueEvent(
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

        const now = Date.now();
        pendingMessagesRef.current = pendingMessagesRef.current.filter(
          (msg) => now - msg.timestamp < MESSAGE_TTL_MS,
        );
        pendingMessagesRef.current.forEach((msg) => {
          eventManagerRef.current?.enqueueEvent(
            msg.type,
            msg.data,
            msg.priority,
          );
        });
        pendingMessagesRef.current = [];
      };

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
        setIsConnected(false);
        isConnectingRef.current = false;
        cleanupConnection();

        if (eventManagerRef.current && !eventManagerRef.current.isThrottled()) {
          const delay = eventManagerRef.current.getNextReconnectDelay();
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        } else {
          reconnectTimeoutRef.current = setTimeout(
            connect,
            Math.min(1000 * Math.pow(2, 5), 30000),
          );
        }
      };

      socket.onerror = () => {
        isConnectingRef.current = false;
        socket.close();
      };
    } catch (error: unknown) {
      console.error("[WS Context] Connection error:", error);
      isConnectingRef.current = false;
      cleanupConnection();
    }
  }, [user?._id, cleanupConnection, handleWebSocketMessage]);

  // ── Effects ────────────────────────────────────────────────────────

  const isDestroyedRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isConnected && !isDestroyedRef.current) connect();
    }, RECONNECT_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isConnected, connect]);

  useEffect(() => {
    if (!user?._id) return;
    connect();

    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === "visible";
      if (isVisible && wsRef.current?.readyState !== WebSocket.OPEN) {
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
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  useEffect(() => {
    return () => {
      isDestroyedRef.current = true;
      cleanupConnection();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleNetworkChange = () => {
      if (wsRef.current) {
        setIsConnected(wsRef.current.readyState === WebSocket.OPEN);
      }
    };
    window.addEventListener("online", handleNetworkChange);
    window.addEventListener("offline", handleNetworkChange);
    return () => {
      window.removeEventListener("online", handleNetworkChange);
      window.removeEventListener("offline", handleNetworkChange);
    };
  }, []);

  return (
    <WebSocketContext.Provider
      value={{
        sendMessage,
        eventManager: eventManagerRef,
        isConnected,
        connectionState:
          eventManagerRef.current?.connectionState ?? WebSocket.CLOSED,
        managerReady,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
};
