export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  avatarUrl?: string;
  status?: UserStatus;
  lastSeen?: Date;
}

export type UserStatus = "online" | "offline" | "away";

export interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (userData: AuthUser, token: string) => void;
  logout: () => void;
  updateUser: (userData: Partial<AuthUser>) => void;
  updateStatus: (status: UserStatus) => void;
}

export interface Message {
    id: string;
    content: string;
    senderId: string;
    receiverId?: string;
    chatRoomId?: string;
    timestamp: Date;
    status?: 'sent' | 'delivered' | 'read';
    type?: 'text' | 'image' | 'file';
    metadata?: {
        fileName?: string;
        fileSize?: number;
        mimeType?: string;
    };
}

export interface ChatRoom {
    id: string;
    name?: string,
    type: 'direct' | 'group';
    participants: AuthUser[];
    lastMessage?: Message;
    unreadCount?: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface ApiResponse<T> {
    date: T;
    message?: string;
    status: number;
}

export interface AuthResponse {
    user: AuthUser;
    token: string;
}
