export interface AuthUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  avatarUrl?: string;
  status?: UserStatus;
  lastSeen?: Date;
  friendshipCreatedAt?: Date;
}

export interface Friend extends AuthUser {
  lastMessage?: Message;
  unreadCount?: number;
  friendshipCreatedAt?: Date;
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

export type CallType = "voice" | "video";
export type CallStatus =
  | "idle"
  | "incoming"
  | "outgoing"
  | "connected"
  | "ended";

export interface CallState {
  isInCall: boolean;
  callType: CallType | null;
  callStatus: CallStatus;
  remoteUser: Friend | null;
  roomName: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
}

export interface CallQuality {
  audio: {
    bitrate: number;
    packetsLost: number;
    roundTripTime: number;
  };
  video?: {
    bitrate: number;
    packetsLost: number;
    frameRate: number;
    resolution: { width: number; height: number };
  };
}

export interface CallContextType {
  callState: CallState;
  initiateCall: (friend: Friend, type: CallType) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleAudio: () => void;
  toggleVideo: () => void;
  callQuality: CallQuality | null;
  isScreenSharing: boolean;
  toggleScreenShare: () => Promise<void>;

}
