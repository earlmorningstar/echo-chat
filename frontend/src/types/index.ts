import * as TwilioVideo from "twilio-video";
import * as TwilioVoice from "@twilio/voice-sdk";

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

export enum CallStatus {
  INITIATED = "initiated",
  RINGING = "ringing",
  MISSED = "missed",
  COMPLETED = "completed",
  REJECTED = "rejected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  FAILED = "failed",
}

export enum CallType {
  VOICE = "voice",
  VIDEO = "video",
}

export interface CallEvent {
  type: "call_initiate" | "call_accept" | "call_reject" | "call_end";
  callId: string;
  callerId: string;
  recipientId?: string;
  callType?: CallType;
  timestamp: number;
  token?: string;
  roomName?: string;
  requireAck?: boolean;
  id?: string;
}

export interface CallStateUpdate {
  callId?: string;
  type?: CallType;
  status?: CallStatus;
  participants?: string[];
  activeCall?: TwilioVideo.Room | TwilioVoice.Call | null;
  callQuality?: "good" | "average" | "poor";
  error?: string;
}
