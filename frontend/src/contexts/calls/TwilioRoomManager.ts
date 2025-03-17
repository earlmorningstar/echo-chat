import { useEffect, useCallback, useRef } from "react";
import { CallStatus, CallType } from "../../types";
import isEqual from "lodash.isequal";
import {
  ActiveCall,
  VoiceCallEntity,
  TwilioVideo,
  TwilioVoice,
} from "../../types/calls";

interface CallStateUpdate {
  callId?: string;
  type?: CallType;
  status?: CallStatus;
  participants?: string[];
  activeCall?: ActiveCall;
  callQuality?: "good" | "average" | "poor";
  error?: string;
}

export function useTwilioRoomManager(
  localTracks: TwilioVideo.LocalTrack[] = [],
  updateCallState: (update: CallStateUpdate) => void
) {
  const deviceRef = useRef<{
    videoDevice?: TwilioVideo.Room;
    voiceDevice?: TwilioVoice.Device;
  }>({});
  const lastUpdate = useRef<CallStateUpdate | null>(null);
  const connectionStateRef = useRef<string>("");

  const stableUpdateCallState = useCallback(
    (update: CallStateUpdate) => {
      if (isEqual(update, lastUpdate.current)) return;
      lastUpdate.current = update;
      updateCallState(update);
    },
    [updateCallState]
  );

  const connectToVideoRoom = useCallback(
    async (token: string, roomName: string, callId: string) => {
      try {
        const room = await TwilioVideo.connect(token, {
          name: roomName,
          tracks: localTracks,
        });

        deviceRef.current.videoDevice = room;
        stableUpdateCallState({
          callId,
          type: CallType.VIDEO,
          status: CallStatus.CONNECTED,
          activeCall: room,
          participants: Array.from(room.participants.keys()).map((p) => p),
        });

        // Event handlers
        room.on("participantConnected", (participant) => {
          stableUpdateCallState({
            participants: Array.from(room.participants.keys()).map((p) => p),
          });
        });

        room.on("participantDisconnected", (participant) => {
          stableUpdateCallState({
            participants: Array.from(room.participants.keys()).map((p) => p),
            status:
              room.participants.size > 0
                ? CallStatus.CONNECTED
                : CallStatus.COMPLETED,
          });
        });

        return room;
      } catch (error) {
        stableUpdateCallState({
          status: CallStatus.REJECTED,
          activeCall: null,
        });
        throw error;
      }
    },
    [localTracks, stableUpdateCallState]
  );

  const initializeVoiceDevice = useCallback(
    (token: string, currentCallId: string) => {
      console.log(
        "Initializing device with token:",
        token.substring(0, 50) + "..."
      );

      let connectionTimeout: NodeJS.Timeout;

      //cleaning up existing device
      if (deviceRef.current.voiceDevice) {
        deviceRef.current.voiceDevice.destroy();
      }

      try {
        const device = new TwilioVoice.Device(token, {
          logLevel: "debug",
          codecPreferences: ["opus", "pcmu"],
          fakeLocalDTMF: true,
          enableRingingState: true,
          appName: "EchoChat",
          appVersion: "1.0.0",
          allowIncomingWhileBusy: true,
          maxCallSignalingTimeoutMs: 30000,
        } as TwilioVoice.Device.Options);

        deviceRef.current.voiceDevice = device;

        // Add connection state tracking
        let connectionAttempts = 0;
        const connectionInterval = setInterval(() => {
          console.log(
            `Device state: ${device.state}, Connection: ${device.connectionState}`
          );
          if (++connectionAttempts > 10) {
            clearInterval(connectionInterval);
          }
        }, 3000);

        device.on("ready", () => {
          console.log("Twilio device ready");
          clearTimeout(connectionTimeout);
          stableUpdateCallState({
            callId: currentCallId,
            type: CallType.VOICE,
            status: CallStatus.INITIATED,
          });
        });

        connectionTimeout = setTimeout(() => {
          if (device.connectionState !== "connected") {
            console.error("Device initialization timeout");
            device.destroy();
            stableUpdateCallState({
              status: CallStatus.FAILED,
              error: "Connection timeout",
            });
          }
        }, 45000);

        device.on("incoming", (connection) => {
          console.log("Incoming call from:", connection);
          //updating UI to show incoming call
          stableUpdateCallState({
            callId: currentCallId,
            // type: CallType.VOICE,
            status: CallStatus.INITIATED,
            activeCall: connection,
          });
          // connection.accept();
        });

        device.on("registered", () => {
          console.log("Device successfully registered with Twilio");
        });

        device.on("connect", () => {
          console.log("Call connected successfully");
          stableUpdateCallState({
            status: CallStatus.CONNECTED,
            callId: currentCallId,
          });
        });

        device.on("connectionStateChanged", (state) => {
          console.log(`Twilio Device State: ${state}`);
          if (state === "connected") {
            stableUpdateCallState({
              status: CallStatus.CONNECTED,
              callId: currentCallId,
            });
          }
        });

        device.on("reconnecting", () => {
          stableUpdateCallState({ callQuality: "average" });
        });

        device.on("reconnected", () => {
          stableUpdateCallState({ callQuality: "good" });
        });

        device.on("cancel", () => {
          stableUpdateCallState({
            status: CallStatus.REJECTED,
          });
        });

        device.on("error", (error) => {
          stableUpdateCallState({ status: CallStatus.FAILED });
          console.error("Twilio Device Error:", error);
        });

        device.register();
        return device;
      } catch (error) {
        console.log("Twilio Room Error:", error);
        stableUpdateCallState({
          status: CallStatus.FAILED,
          activeCall: null,
        });
        throw error;
      }
    },
    [stableUpdateCallState]
  );

  const makeVoiceCall = useCallback(
    async (identity: string, currentCallId: string, userId: string) => {
      const device = deviceRef.current.voiceDevice;
      if (!device) {
        throw new Error("Voice device not initialized");
      }

      try {
        const call = (await device.connect({
          params: {
            To: `client:${identity}`,
            From: `client:${userId}`,
            CallSid: currentCallId,
          },
        })) as unknown as VoiceCallEntity;

        console.log("Call parameters:", {
          To: `client:${identity}`,
          From: `client:${userId}`,
          CallSid: currentCallId,
        });

        (call as any)("accept", () => {
          stableUpdateCallState({
            callId: currentCallId,
            type: CallType.VOICE,
            status: CallStatus.CONNECTED,
            activeCall: call,
          });
        });

        return call;
      } catch (error) {
        console.error("Voice call failed:", error);
        stableUpdateCallState({
          status: CallStatus.FAILED,
        });
        throw error;
      }
    },
    [stableUpdateCallState]
  );

  const disconnectCall = useCallback(() => {
    deviceRef.current.voiceDevice?.destroy();
    deviceRef.current.videoDevice?.disconnect();
    deviceRef.current = {};
    stableUpdateCallState({
      activeCall: null,
      status: CallStatus.COMPLETED,
      participants: [],
    });
  }, [stableUpdateCallState]);

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
    callManager: deviceRef.current,
  };
}
