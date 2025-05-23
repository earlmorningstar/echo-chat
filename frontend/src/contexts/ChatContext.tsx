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
import { Friend, AuthUser, UserStatus } from "../types";
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
  const { sendMessage, eventManager } = useWebSocket();
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
            (user: any) => user._id
          );
          setBlockedUsers(blockedIds);
        }

        //setting users who have blocked you
        if (response.data.data.blockedByUsers) {
          const blockedByIds = response.data.data.blockedByUsers.map(
            (user: any) => user._id
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
    [blockedUsers]
  );

  const isBlockedByUser = useCallback(
    (userId: string) => {
      return blockedByUsers.includes(userId);
    },
    [blockedByUsers]
  );

  //fetching blocked users on authentication
  useEffect(() => {
    if (isAuthenticated) {
      fetchBlockedUsers();
    }
  }, [isAuthenticated, fetchBlockedUsers]);

  useEffect(() => {
    if (!eventManager) return;

    const currentManager = eventManager.current;

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

    if (currentManager) {
      currentManager.on("message", handleTypingMessage);
    }

    return () => {
      if (currentManager) {
        currentManager.off("message", handleTypingMessage);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventManager.current]);

  const getUserStatus = useCallback(
    (userId: string): UserStatus => {
      return queryClient.getQueryData(["userStatus", userId]) || "offline";
    },
    [queryClient]
  );

  const fetchFriendsWithMessages = useCallback(async (): Promise<Friend[]> => {
    if (!isAuthenticated) {
      return [];
    }

    const response = await api.get("/api/user/friends");

    const friendsWithMessages = await Promise.all(
      response.data.friends.map(async (friend: AuthUser) => {
        try{
        const [messageResponse, unreadCountResponse, friendshipResponse] =
          await Promise.all([
            api.get(`/api/messages/last/${friend._id}`),
            api.get(`/api/messages/unread-count/${friend._id}`),
            api.get(`/api/user/friendship/${friend._id}`).catch((error) => {
              return {
                data: {
                  data: {
                    friendship: {
                      createdAt: new Date(),
                      status: "not-friends",
                      _id: "not-friends",
                      user1Id: user?._id,
                      user2Id: friend._id,
                    },
                  },
                },
              };
            }),
          ]);

        const status =
          queryClient.getQueryData(["userStatus", friend._id]) || "offline";
        const lastSeen = queryClient.getQueryData(["userLastSeen", friend._id]);

        const friendshipCreatedAt = friendshipResponse.data.data.friendship
          .createdAt
          ? new Date(friendshipResponse.data.data.friendship.createdAt)
          : new Date();

        return {
          ...friend,
          status,
          lastSeen,
          friendshipCreatedAt,
          friendshipStatus: friendshipResponse.data.data.friendship.status || "not-friends",
          lastMessage: messageResponse.data.message
            ? {
                ...messageResponse.data.message,
                status: messageResponse.data.message.status || "sent",
              }
            : null,
          unreadCount: unreadCountResponse.data.count || 0,
        } as Friend;
      } catch(error) {
        console.error(`Error fetching data for friend ${friend._id}:`, error);
        //returning a friend object if an error occurs
        return {
          ...friend,
          status: 'offline',
          friendshipCreatedAt: new Date(),
          friendshipStatus: 'error',
          lastMessage: null,
          unreadCount: 0,
        } as Friend;
      }
      })
    );

    return friendsWithMessages.sort((a, b) => {
      // timestamps for comparison
      const aFriendshipTime = a.friendshipCreatedAt
        ? new Date(a.friendshipCreatedAt).getTime()
        : 0;
      const bFriendshipTime = b.friendshipCreatedAt
        ? new Date(b.friendshipCreatedAt).getTime()
        : 0;

      const aMessageTime = a.lastMessage?.timestamp
        ? new Date(a.lastMessage.timestamp).getTime()
        : 0;
      const bMessageTime = b.lastMessage?.timestamp
        ? new Date(b.lastMessage.timestamp).getTime()
        : 0;

      // the most recent activity time (either message or friendship)
      const aLatestActivity = Math.max(aFriendshipTime, aMessageTime);
      const bLatestActivity = Math.max(bFriendshipTime, bMessageTime);

      // Sort by most recent activity (whether it's a new friendship or new message)
      return bLatestActivity - aLatestActivity;
    });
  }, [isAuthenticated, queryClient, user?._id]);

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
            : friend
        );
      });
    },
    [queryClient]
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
    [sendMessage, user?._id]
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
