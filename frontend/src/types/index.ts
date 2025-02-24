import {
  Room,
  LocalParticipant,
  RemoteParticipant,
  RemoteTrackPublication,
  RemoteAudioTrack,
  RemoteVideoTrack,
  LocalAudioTrackPublication,
  LocalVideoTrackPublication,
  RemoteAudioTrackPublication,
  RemoteVideoTrackPublication,
} from "twilio-video";

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
  | "connecting"
  | "connected"
  | "ended";

interface BaseCallMessage {
  roomName: string;
  senderId: string;
  receiverId: string;
  callType: CallType;
  forceCleanup?: boolean;
}

export interface WSCallMessage {
  type: "call_initiate" | "call_accepted" | "call_rejected" | "call_ended";
  data: BaseCallMessage;
  requireAck: boolean;
  id: string;
  timestamp?: number;
}

export const convertWSToUIEvent = (wsMessage: WSCallMessage): CallEvent => ({
  type: mapWSTypeToUI(wsMessage.type),
  data: {
    initiatorId: wsMessage.data.senderId,
    type: wsMessage.data.callType,
    roomName: wsMessage.data.roomName,
    forceCleanup: wsMessage.data.forceCleanup,
  },
});

const mapWSTypeToUI = (wsType: WSCallMessage["type"]): CallEvent["type"] => {
  const mapping: Record<string, CallEvent["type"]> = {
    call_initiate: "incoming",
    call_accepted: "accepted",
    call_rejected: "rejected",
    call_ended: "ended",
  };
  return mapping[wsType] || "ended";
};

export interface CallState {
  isInCall: boolean;
  callType: CallType | null;
  callStatus: CallStatus;
  remoteUser: Friend | null;
  roomName: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  timestamp?: number;
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
  networkLevel?: number;
  timestamp?: number;
}

export interface CallEvent {
  type: "incoming" | "accepted" | "rejected" | "ended";
  data: {
    initiatorId?: string;
    type?: CallType;
    roomName?: string;
    forceCleanup?: boolean;
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

export interface TwilioRoom extends Room {
  name: string;
  localParticipant: LocalParticipant;
  participants: Map<string, RemoteParticipant>;
  config?: {
    peerConnection: RTCPeerConnection;
  };
}

export type TwilioTrackPublication =
  | LocalAudioTrackPublication
  | LocalVideoTrackPublication
  | RemoteAudioTrackPublication
  | RemoteVideoTrackPublication;

export type TwilioTrack = RemoteAudioTrack | RemoteVideoTrack;

export interface TwilioParticipant extends RemoteParticipant {
  identity: string;
  tracks: Map<string, RemoteTrackPublication>;
  videoTracks: Map<string, RemoteVideoTrackPublication>;
  audioTracks: Map<string, RemoteAudioTrackPublication>;
}
