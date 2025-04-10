import "@twilio/voice-sdk";
import * as TwilioVideoLib from "twilio-video";

declare module "@twilio/voice-sdk" {
  export enum Codec {
    Opus = "opus",
    PCMU = "pcmu",
  }

  interface DeviceOptions {
    fakeLocalDTMF?: boolean;
    enableRingingState?: boolean;
    codecPreferences?: string[];
    logLevel?: "debug" | "error" | "warn" | "info" | "silent";
  }

  interface Device {
    activeConnection(): Connection | undefined;
    updateToken(token: string): void;
    _options: DeviceOptions;
    _connection: Connection | null;
    _soundcache: Map<string, HTMLAudioElement>;
    constructor(token: string, options?: DeviceOptions);
    connectionState: string;
    connect(params?: Record<string, any>): Promise<Connection>;
    destroy(): void;
    register(): void;
    unregister(): void;
    unregister(): void;
    on(
      event:
        | "registered"
        | "connect"
        | "connectionStateChanged"
        | "incoming"
        | "ready"
        | "reconnecting"
        | "reconnected"
        | "disconnect"
        | "error"
        | "cancel",
      handler: (...args: any[]) => void
    ): this;
  }

  interface Call {
    parameters: Record<string, string>;
    status: CallStatus;
    direction: "incoming" | "outgoing";
  }

  interface Connection {
    on(
      event: "connect" | "disconnect" | "accept",
      handler: (...args: any[]) => void
    ): this;
    off(event: string, handler?: (...args: any[]) => void): this;
    parameters: Record<string, string>;
    status(): string;
    direction: "incoming" | "outgoing";
    accept(): void;
    disconnect(): void;
  }

  enum ConnectionState {
    Connecting = "conneecting",
    Connected = "connected",
    Disconnected = "disconnected",
    Offline = "offline",
  }
}

declare module "twilio-video" {
  // Base Track interface
  export interface Track {
    isEnabled: boolean;
    enable(): void;
    disable(): void;
    name: string;
    attach(): HTMLMediaElement;
    detach(): HTMLMediaElement[];
    kind: string;
  }

  // Base LocalTrack interface that extends Track
  export interface LocalTrack extends Track {
    stop(): void;
    mediaStreamTrack: MediaStreamTrack;
    isEnabled: boolean;
  }

  // Specialized track types that extend LocalTrack
  export interface LocalVideoTrack extends LocalTrack {
    dimensions?: { width: number; height: number };
    kind: "video";
  }

  export interface LocalAudioTrack extends LocalTrack {
    kind: "audio";
  }

  export interface LocalDataTrack extends LocalTrack {
    kind: "data";
  }

  export interface RemoteDataTrack
    extends Omit<RemoteTrack, "mediaStreamTrack"> {
    kind: "data";
  }

  // Remote track interfaces
  export interface RemoteTrack extends Track {
    mediaStreamTrack: MediaStreamTrack;
  }

  export interface RemoteVideoTrack extends RemoteTrack {
    kind: "video";
  }

  export interface RemoteAudioTrack extends RemoteTrack {
    kind: "audio";
  }

  export interface TrackPublication {
    track:
      | LocalVideoTrack
      | RemoteVideoTrack
      | LocalAudioTrack
      | RemoteAudioTrack
      | null;
    trackName: string;
    trackSid: string;
    kind: string;
  }

  export function createLocalTracks(
    options?: MediaStreamConstraints
  ): Promise<LocalTrack[]>;

  export interface Room {
    sid: string;
    localParticipant: LocalParticipant;
    participants: Map<string, RemoteParticipant>;
    disconnect(): void;
    on(event: string, listener: Function): void;
  }

  export interface LocalParticipant {
    identity: string;
    videoTracks: Map<string, LocalTrackPublication>;
    audioTracks: Map<string, LocalTrackPublication>;
  }

  export interface RemoteParticipant {
    identity: string;
    sid: string;
    videoTracks: Map<string, RemoteVideoTrackPublication>;
    audioTracks: Map<string, RemoteAudioTrackPublication>;
    on(event: string, listener: Function): void;
  }

  export interface LocalTrackPublication {
    track: LocalVideoTrack | LocalAudioTrack | null;
    trackSid: string;
  }

  export interface RemoteVideoTrackPublication {
    track: RemoteVideoTrack | null;
    trackSid: string;
    kind: "video";
  }

  export interface RemoteAudioTrackPublication {
    track: RemoteAudioTrack | null;
    trackSid: string;
    kind: "video";
  }

  // Connect function signature
  export function connect(token: string, options: any): Promise<Room>;
}

export type VideoTrack =
  | TwilioVideoLib.LocalVideoTrack
  | TwilioVideoLib.RemoteVideoTrack;
export type AudioTrack =
  | TwilioVideoLib.LocalAudioTrack
  | TwilioVideoLib.RemoteAudioTrack;
export type Track = TwilioVideoLib.Track;
export type LocalTrack = TwilioVideoLib.LocalTrack;
export type TrackPublication = TwilioVideoLib.TrackPublication;

export type VoiceCallEntity = TwilioVoice.Connection | TwilioVoice.Call;
