import { useEffect, useCallback, useRef } from "react";
import { CallStatus, CallType } from "../../types";
import isEqual from "lodash.isequal";
import { ActiveCall, TwilioVideo, TwilioVoice } from "../../types/calls";
import { LocalTrack, Room, RemoteParticipant } from "twilio-video";

interface CallStateUpdate {
  callId?: string;
  type?: CallType;
  status?: CallStatus;
  participants?: RemoteParticipant[];
  activeCall?: ActiveCall;
  callQuality?: "good" | "average" | "poor";
  error?: string;
}

export function useTwilioRoomManager(
  localTracks: LocalTrack[] = [],
  updateCallState: (update: CallStateUpdate) => void,
  recipientId?: string | null,
): {
  connectToVideoRoom: (
    token: string,
    roomName: string,
    callId: string,
    tracks: LocalTrack[],
  ) => Promise<Room>;
  initializeVoiceDevice: (
    token: string,
    callId: string,
    recipientId: string,
  ) => TwilioVoice.Device;
  makeVoiceCall: (
    identity: string,
    currentCallId: string,
    userId: string,
  ) => Promise<TwilioVoice.Connection>;
  disconnectCall: () => void;
  publishTrack: (track: LocalTrack) => Promise<void>;
  unpublishTrack: (track: LocalTrack) => void;
  callManager: {
    videoDevice?: Room;
    voiceDevice?: TwilioVoice.Device;
  };
} {
  const deviceRef = useRef<{
    videoDevice?: Room;
    voiceDevice?: TwilioVoice.Device;
  }>({});
  const lastUpdate = useRef<CallStateUpdate | null>(null);
  const connectionStateRef = useRef<string>("");

  const stableUpdateCallState = useCallback(
    (update: CallStateUpdate) => {
      if (isEqual(update, lastUpdate.current)) return;
      lastUpdate.current = update;
      updateCallState({
        ...update,
        status: update.status || CallStatus.COMPLETED,
      });
    },
    [updateCallState],
  );

  const connectToVideoRoom = useCallback(
    async (
      token: string,
      roomName: string,
      callId: string,
      tracks: LocalTrack[],
    ) => {
      try {
        stableUpdateCallState({
          callId,
          type: CallType.VIDEO,
          status: CallStatus.CONNECTING,
        });

        // Connect to the Twilio Video room with local tracks
        const room = await TwilioVideo.connect(token, {
          name: roomName,
          tracks: tracks,
          dominantSpeaker: true,
          preferredVideoCodecs: [{ codec: "VP8", simulcast: false }],
          bandwidthProfile: {
            video: {
              mode: "grid",
              clientTrackSwitchOffControl: "auto",
              dominantSpeakerPriority: "standard",
              contentPreferencesMode: "auto",
              maxSubscriptionBitrate: 2500000,
            },
          },
          maxAudioBitrate: 16000,
          networkQuality: { local: 1, remote: 1 },
        });

        deviceRef.current.videoDevice = room;

        // Debounced syncParticipants — prevents rapid re-renders from
        // unmounting video elements mid-attachment (causes track-stalled).
        let syncTimeout: ReturnType<typeof setTimeout> | null = null;
        const syncParticipants = () => {
          if (syncTimeout !== null) clearTimeout(syncTimeout);
          syncTimeout = setTimeout(() => {
            syncTimeout = null;
            const p = Array.from(room.participants.values());
            stableUpdateCallState({
              status: CallStatus.CONNECTED,
              activeCall: room,
              participants: p,
            });
          }, 300);
        };

        // Process already-connected remote participants
        room.participants.forEach((participant) => {
          // We only need the listeners here; Twilio handles the initial sync
          // through the syncParticipants call triggered at the end of connection.
          participant.on("trackSubscribed", () => syncParticipants());
          participant.on("trackUnsubscribed", () => syncParticipants());
        });

        // Future participants
        room.on("participantConnected", (participant) => {
          participant.on("trackSubscribed", () => syncParticipants());
          participant.on("trackUnsubscribed", () => syncParticipants());
          syncParticipants();
        });

        room.on("participantDisconnected", () => {
          syncParticipants();
        });

        room.on("disconnected", () => {
          stableUpdateCallState({
            status: CallStatus.COMPLETED,
            activeCall: null,
            participants: [],
          });
        });

        // Initial participant sync
        syncParticipants();

        return room;
      } catch (error: unknown) {
        console.error("Video connection failed:", error);
        stableUpdateCallState({
          status: CallStatus.FAILED,
          error: "Failed to connect to video room",
        });
        throw error;
      }
    },
    [stableUpdateCallState],
  );

  const initializeVoiceDevice = useCallback(
    (
      token: string,
      currentCallId: string,
      actualRecipientId: string,
    ): TwilioVoice.Device => {
      if (!actualRecipientId) {
        throw new Error("Recipient ID is missing in call state");
      }

      try {
        if (deviceRef.current.voiceDevice) {
          deviceRef.current.voiceDevice.destroy();
        }

        const device = new TwilioVoice.Device(token, {
          logLevel: "debug",
          codecPreferences: ["opus", "pcmu"],
          fakeLocalDTMF: true,
          enableRingingState: true,
          appName: "EchoChat",
          appVersion: "1.0.0",
        } as TwilioVoice.Device.Options);

        deviceRef.current.voiceDevice = device;

        device.on("ready", () => {
          stableUpdateCallState({
            callId: currentCallId,
            type: CallType.VOICE,
            status: CallStatus.INITIATED,
          });
        });

        device.on("incoming", (conn) => {
          stableUpdateCallState({
            status: CallStatus.RINGING,
            activeCall: conn,
          });
        });

        device.on("connect", () => {
          stableUpdateCallState({
            status: CallStatus.CONNECTED,
            callId: currentCallId,
          });
        });

        device.on("connectionStateChanged", (state) => {
          switch (state) {
            case "connecting":
              stableUpdateCallState({ status: CallStatus.INITIATED });
              break;
            case "connected":
              stableUpdateCallState({ status: CallStatus.CONNECTED });
              break;
            case "disconnected":
              stableUpdateCallState({ status: CallStatus.COMPLETED });
              break;
          }
        });

        device.on("reconnecting", () => {
          stableUpdateCallState({ callQuality: "average" });
        });

        device.on("reconnected", () => {
          stableUpdateCallState({ callQuality: "good" });
        });

        device.on("cancel", () => {
          stableUpdateCallState({ status: CallStatus.REJECTED });
        });

        device.register();
        return device;
      } catch (error) {
        stableUpdateCallState({
          status: CallStatus.FAILED,
          activeCall: null,
        });
        console.error("Device Error");
        throw error;
      }
    },
    [stableUpdateCallState],
  );

  const makeVoiceCall = useCallback(
    async (
      identity: string,
      currentCallId: string,
      userId: string,
    ): Promise<TwilioVoice.Connection> => {
      const device = deviceRef.current.voiceDevice;
      if (!device) {
        throw new Error("Voice device not initialized");
      }

      if (device.state !== "registered") {
        throw new Error(
          "Device not registered. Current state: " + device.state,
        );
      }

      const formattedTo = identity.startsWith("client:")
        ? identity
        : `client:${identity}`;

      const formattedFrom = userId.startsWith("client:")
        ? userId
        : `client:${userId}`;

      try {
        const call = (await device.connect({
          params: {
            To: formattedTo,
            From: formattedFrom,
            CallSid: currentCallId,
          },
        })) as TwilioVoice.Connection;

        call.on("accept", () => {
          stableUpdateCallState({
            status: CallStatus.CONNECTED,
            callId: currentCallId,
          });
        });

        return call;
      } catch (error) {
        console.error("Voice call failed");
        stableUpdateCallState({ status: CallStatus.FAILED });
        throw error;
      }
    },
    [stableUpdateCallState],
  );

  const disconnectCall = useCallback(() => {
    deviceRef.current.voiceDevice?.disconnectAll();
    deviceRef.current.voiceDevice?.destroy();
    deviceRef.current.videoDevice?.disconnect();
    deviceRef.current = {};
    stableUpdateCallState({
      activeCall: null,
      status: CallStatus.COMPLETED,
      participants: [],
    });
  }, [stableUpdateCallState]);

  /**
   * Publishes a local track to the active video room.
   * Used when the user enables video/audio mid-call.
   */
  const publishTrack = useCallback(async (track: LocalTrack): Promise<void> => {
    const room = deviceRef.current.videoDevice;
    if (!room) {
      console.warn("Cannot publish track: no active video room");
      return;
    }
    try {
      await room.localParticipant.publishTrack(track);
    } catch (error) {
      console.error("Failed to publish track:", error);
    }
  }, []);

  /**
   * Unpublishes a local track from the active video room.
   */
  const unpublishTrack = useCallback((track: LocalTrack): void => {
    const room = deviceRef.current.videoDevice;
    if (!room) return;
    try {
      room.localParticipant.unpublishTrack(track);
    } catch (error) {
      console.error("Failed to unpublish track:", error);
    }
  }, []);

  useEffect(() => {
    const device = deviceRef.current.voiceDevice;
    if (!device) return;

    const stateHandler = (state: string) => {
      connectionStateRef.current = state;
    };

    device.on("connectionStateChanged", stateHandler);

    const timer = setTimeout(() => {
      if (connectionStateRef.current === "connecting") {
        disconnectCall();
        updateCallState({ status: CallStatus.FAILED });
      }
    }, 30000);

    return () => {
      clearTimeout(timer);
      device.off("connectionStateChanged", stateHandler);
    };
  }, [disconnectCall, updateCallState]);

  useEffect(() => {
    return () => disconnectCall();
  }, [disconnectCall]);

  return {
    connectToVideoRoom,
    initializeVoiceDevice,
    makeVoiceCall,
    disconnectCall,
    publishTrack,
    unpublishTrack,
    callManager: deviceRef.current,
  };
}
