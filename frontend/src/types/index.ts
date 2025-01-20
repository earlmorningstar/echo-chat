export interface AuthUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  avatarUrl?: string;
  status?: UserStatus;
  lastSeen?: Date;
}

export interface Friend extends AuthUser {
  lastMessage?: Message;
  unreadCount?: number;
}

export type UserStatus = "online" | "offline";

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
  _id: string;
  content: string;
  senderId: string;
  receiverId?: string;
  chatRoomId?: string;
  timestamp: Date;
  status?: "sent" | "delivered" | "read";
  type?: "text" | "image" | "file";
  readAt?: Date;
  metadata?: {
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    fileUrl?: string;
    fileId?: string;
  };
}

export interface ChatRoom {
  _id: string;
  name?: string;
  type: "direct" | "group";
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
