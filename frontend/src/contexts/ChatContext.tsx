import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../utils/api";
import { Friend, AuthUser } from "../types";
import { useWebSocket } from "./WebSocketContext";
import { useAuth } from "./AuthContext";

interface ChatContextType {
  friends: Friend[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  setFriendAsRead: (friendId: string) => void;
  updateTypingStatus: (friendId: string, isTyping: boolean) => void;
  typingStatus: Record<string, boolean>;
  friendTypingStatus: Record<string, boolean>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { sendMessage } = useWebSocket();
  const [typingStatus, setTypingStatus] = useState<Record<string, boolean>>({});
  const [friendTypingStatus, setFriendTypingStatus] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      // Update friendTypingStatus when WebSocket messages arrive (common mistake if ignored);
      queryClient
        .getQueriesData({ queryKey: ["friendTypingStatus"] })
        .forEach(([key, value]) => {
          if (Array.isArray(key) && key.length > 1) {
            const friendId = key[1];
            setFriendTypingStatus((prev) => ({
              ...prev,
              [friendId]: value as boolean,
            }));
          }
        });
    });

    return () => unsubscribe();
  }, [queryClient]);

  const fetchFriendsWithMessages = async (): Promise<Friend[]> => {
    const response = await api.get("/api/user/friends");

    const friendsWithMessages = await Promise.all(
      response.data.friends.map(async (friend: AuthUser) => {
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

    return friendsWithMessages.sort((a, b) => {
      const timeA = a.lastMessage?.timestamp
        ? new Date(a.lastMessage.timestamp).getTime()
        : 0;
      const timeB = b.lastMessage?.timestamp
        ? new Date(b.lastMessage.timestamp).getTime()
        : 0;
      return timeB - timeA;
    });
  };

  const {
    data: friends = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["friends"],
    queryFn: fetchFriendsWithMessages,
    refetchInterval: 2000,
    staleTime: 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const setFriendAsRead = (friendId: string) => {
    queryClient.setQueryData(["friends"], (oldData: Friend[] | undefined) => {
      if (!oldData) return [];
      return oldData.map((friend) =>
        friend._id === friendId
          ? {
              ...friend,
              unreadCount: 0,
              lastMessage: friend.lastMessage
                ? { ...friend.lastMessage, status: "read" }
                : null,
            }
          : friend
      );
    });
  };

  const updateTypingStatus = useCallback(
    (friendId: string, isTyping: boolean) => {
      if (!user?._id) return;

      sendMessage({
        type: "typing",
        senderId: user._id,
        receiverId: friendId,
        isTyping,
      });

      setTypingStatus((prev) => {
        if (!isTyping && !prev[friendId]) {
          return prev;
        }

        if (!isTyping) {
          const newStatus = { ...prev };
          delete newStatus[friendId];
          return newStatus;
        }

        return {
          ...prev,
          [friendId]: isTyping,
        };
      });
    },
    [sendMessage, user]
  );

  const value = {
    friends,
    isLoading,
    isError,
    refetch,
    setFriendAsRead,
    updateTypingStatus,
    typingStatus,
    friendTypingStatus,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be use within a ChatProvider");
  }
  return context;
};
