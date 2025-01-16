import React, {
  createContext,
  useContext,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { useAuth } from "./AuthContext";
import { useQueryClient } from "@tanstack/react-query";

interface WebSocketContextType {
  sendMessage: (message: any) => void;
  isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(
  undefined
);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const ws = useRef<WebSocket | null>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = React.useState(false);

  const connectWebSocket = useCallback(() => {
    if (!user?._id || ws.current?.readyState === WebSocket.OPEN) return;

    ws.current = new WebSocket(
      process.env.REACT_APP_WS_URL || "ws://localhost:5000"
    );

    ws.current.onopen = () => {
      console.log("WebSocket connected");
      setIsConnected(true);

      if (ws.current && user?._id) {
        ws.current.send(
          JSON.stringify({
            type: "register",
            senderId: user._id,
          })
        );
      }
    };

    ws.current.onclose = () => {
      console.log("WebSocket disconnected");
      setIsConnected(false);
      setTimeout(connectWebSocket, 3000);
    };

    ws.current.onerror = (error) => {
      console.error("WebSocket error:", error);
      setIsConnected(false);
    };

    ws.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log("WebSocket message received:", message);

        switch (message.type) {
          case "typing":
            queryClient.setQueryData(
              ["typingStatus", message.senderId],
              message.isTyping
            );

            queryClient.setQueryData(
              ["friendTypingStatus", message.senderId],
              message.isTyping
            );
            break;

          case "message":
            queryClient.invalidateQueries({ queryKey: ["message"] });
            queryClient.invalidateQueries({ queryKey: ["friends"] });
            break;

          case "read_status":
            queryClient.invalidateQueries({ queryKey: ["message"] });
            queryClient.invalidateQueries({ queryKey: ["friends"] });
            break;
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
      }
    };
  }, [user?._id, queryClient]);

  useEffect(() => {
    if (user?._id) {
      connectWebSocket();
    }
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [user?._id, connectWebSocket]);

  const sendMessage = useCallback(
    (message: any) => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify(message));
      } else {
        console.warn("WebSocket is not connected. Attempting to reconnect....");
        connectWebSocket();
      }
    },
    [connectWebSocket]
  );

  return (
    <WebSocketContext.Provider value={{ sendMessage, isConnected }}>
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
