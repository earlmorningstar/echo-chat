import "@twilio/voice-sdk";

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
  export * from "twilio-video";
}

export type VoiceCallEntity = TwilioVoice.Connection | TwilioVoice.Call;
