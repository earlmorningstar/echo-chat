import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../utils/api";
import { Friend, UserStatus } from "../types";
import { useWebSocket } from "./WebSocketContext";
import { useAuth } from "./AuthContext";
import { isValidObjectId } from "../utils/validators";

interface ChatContextType {
  friends: Friend[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  setFriendAsRead: (friendId: string) => void;
  updateTypingStatus: (friendId: string, isTyping: boolean) => void;
  typingStatus: Record<string, boolean>;
  friendTypingStatus: Record<string, boolean>;
  getUserStatus: (userId: string) => UserStatus;
  blockedUsers: string[];
  blockedByUsers: string[];
  isUserBlocked: (userId: string) => boolean;
  isBlockedByUser: (userId: string) => boolean;
  fetchBlockedUsers: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const { sendMessage, eventManager, managerReady } = useWebSocket();
  const [typingStatus, setTypingStatus] = useState<Record<string, boolean>>({});
  const [friendTypingStatus, setFriendTypingStatus] = useState<
    Record<string, boolean>
  >({});
  const typingTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [blockedByUsers, setBlockedByUsers] = useState<string[]>([]);

  useEffect(() => {
    if (isAuthenticated && user?._id) {
      sendMessage({
        type: "register",
        senderId: user._id,
        status: "online",
      });
    }
  }, [isAuthenticated, user?._id, sendMessage]);

  //fetching blocked users
  const fetchBlockedUsers = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const response = await api.get("/api/user/blocked");
      if (response.data && response.data.data) {
        //setting users you've blocked
        if (response.data.data.blockedUsers) {
          const blockedIds = response.data.data.blockedUsers.map(
            (user: any) => user._id,
          );
          setBlockedUsers(blockedIds);
        }

        //setting users who have blocked you
        if (response.data.data.blockedByUsers) {
          const blockedByIds = response.data.data.blockedByUsers.map(
            (user: any) => user._id,
          );
          setBlockedByUsers(blockedByIds);
        }
      }
    } catch (error) {
      console.error("Error fetching blocked users:", error);
    }
  }, [isAuthenticated]);

  const isUserBlocked = useCallback(
    (userId: string) => {
      return blockedUsers.includes(userId);
    },
    [blockedUsers],
  );

  const isBlockedByUser = useCallback(
    (userId: string) => {
      return blockedByUsers.includes(userId);
    },
    [blockedByUsers],
  );

  //fetching blocked users on authentication
  useEffect(() => {
    if (isAuthenticated) {
      fetchBlockedUsers();
    }
  }, [isAuthenticated, fetchBlockedUsers]);

  /**
   * Subscribes to raw WebSocket "message" events for typing indicators.
   * Re-subscribes whenever managerReady changes — i.e. whenever a new
   * WebSocketEventManager is created (initial connect or after reconnect).
   */
  useEffect(() => {
    const manager = eventManager.current;
    if (!manager) return;

    const handleTypingMessage = (message: any) => {
      if (message.type === "typing") {
        //making use of   functional update and limit state changes
        setFriendTypingStatus((prev) => {
          if (prev[message.senderId] === message.isTyping) return prev;
          return { ...prev, [message.senderId]: message.isTyping };
        });

        //auto-clear typing status after 2 seconds
        if (typingTimeouts.current[message.senderId]) {
          clearTimeout(typingTimeouts.current[message.senderId]);
        }

        if (message.isTyping) {
          typingTimeouts.current[message.senderId] = setTimeout(() => {
            setFriendTypingStatus((prev) => ({
              ...prev,
              [message.senderId]: false,
            }));
          }, 2000);
        }
      }
    };

    manager.on("message", handleTypingMessage);

    return () => {
      manager.off("message", handleTypingMessage);
    };
  }, [eventManager, managerReady]);

  const getUserStatus = useCallback(
    (userId: string): UserStatus => {
      return queryClient.getQueryData(["userStatus", userId]) || "offline";
    },
    [queryClient],
  );

  /**
   * Fetches all friends with their last message, unread count, and
   * friendship metadata in a SINGLE API call — eliminating the N+1
   * pattern that previously fired 3×N requests per refetch.
   */
  const fetchFriendsWithMessages = useCallback(async (): Promise<Friend[]> => {
    if (!isAuthenticated) return [];
    // Guard: don't fire the request until the user's _id is available.
    if (!user?._id) return [];

    try {
      const response = await api.get("/api/user/friends-summary");
      // sendSuccess spreads { friends } at the top level:
      // { success: true, message: "...", friends: [...] }
      const rawFriends = response.data?.friends || [];

      return rawFriends.map((f: Friend) => ({
        ...f,
        friendshipCreatedAt: f.friendshipCreatedAt
          ? new Date(f.friendshipCreatedAt)
          : new Date(),
        lastMessage: f.lastMessage
          ? { ...f.lastMessage, status: f.lastMessage.status || "sent" }
          : null,
      }));
    } catch (error) {
      console.error("Error fetching friends summary:", error);
      return [];
    }
  }, [isAuthenticated, user?._id]);

  const {
    data: friends = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["friends"],
    queryFn: fetchFriendsWithMessages,
    staleTime: 60_000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    enabled: isAuthenticated,
  });

  const setFriendAsRead = useCallback(
    (friendId: string) => {
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
            : friend,
        );
      });
    },
    [queryClient],
  );

  const updateTypingStatus = useCallback(
    (friendId: string, isTyping: boolean) => {
      if (!user?._id || !isValidObjectId(friendId)) return;

      //adding client-side validation
      setTypingStatus((prev) => ({ ...prev, [friendId]: isTyping }));

      sendMessage({
        type: "typing",
        senderId: user._id,
        receiverId: friendId,
        isTyping,
      }).catch((error) => {
        console.warn("Typing update failed:", error);
        setTypingStatus((prev) => ({ ...prev, [friendId]: false }));
      });

      //clear typing after 2 seconds
      setTimeout(() => {
        setTypingStatus((prev) => ({ ...prev, [friendId]: false }));
      }, 2000);
    },
    [sendMessage, user?._id],
  );

  useEffect(() => {
    const handleTypingStatus = (userId: string, isTyping: boolean) => {
      setFriendTypingStatus((prev) => ({
        ...prev,
        [userId]: isTyping,
      }));
      if (!isTyping) {
        setTimeout(() => {
          setFriendTypingStatus((prev) => {
            const newStatus = { ...prev };
            delete newStatus[userId];
            return newStatus;
          });
        }, 1000);
      }
    };

    // subscribing to typing status updates
    if (isAuthenticated) {
      queryClient.setQueryData(["typingStatus"], handleTypingStatus);
    }
    return () => {
      queryClient.setQueryData(["typingStatus"], null);
    };
  }, [isAuthenticated, queryClient]);

  const value = {
    friends,
    isLoading,
    isError,
    refetch,
    setFriendAsRead,
    updateTypingStatus,
    typingStatus,
    friendTypingStatus,
    getUserStatus,
    blockedUsers,
    blockedByUsers,
    isUserBlocked,
    isBlockedByUser,
    fetchBlockedUsers,
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
