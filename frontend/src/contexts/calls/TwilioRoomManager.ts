import { useEffect, useCallback, useRef } from "react";
import { CallStatus, CallType } from "../../types";
import isEqual from "lodash.isequal";
import { ActiveCall, TwilioVideo, TwilioVoice } from "../../types/calls";
import {
  LocalTrack,
  Room,
  LocalVideoTrack,
  LocalAudioTrack,
  RemoteVideoTrack,
  RemoteAudioTrack,
} from "twilio-video";

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
  localTracks: LocalTrack[] = [],
  updateCallState: (update: CallStateUpdate) => void,
  recipientId?: string | null
): {
  connectToVideoRoom: (
    token: string,
    roomName: string,
    callId: string,
    tracks: LocalTrack[]
  ) => Promise<Room>;
  initializeVoiceDevice: (
    token: string,
    callId: string,
    recipientId: string
  ) => TwilioVoice.Device;
  makeVoiceCall: (
    identity: string,
    currentCallId: string,
    userId: string
  ) => Promise<TwilioVoice.Connection>;
  disconnectCall: () => void;
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
    [updateCallState]
  );

  const attachTrack = useCallback(
    (
      track:
        | LocalVideoTrack
        | RemoteVideoTrack
        | RemoteAudioTrack
        | LocalAudioTrack,
      isLocal: boolean
    ) => {
      const containerId = isLocal
        ? "local-media-container"
        : "remote-media-container";

      let container = document.getElementById(containerId);

      if (!container) {
        console.warn(`Container ${containerId} not found, retrying...`);
        setTimeout(() => attachTrack(track, isLocal), 500);
        return;
      }

      //removing existing elements for this track
      const trackId = track.name;
      const existing = container.querySelector(`[data-track-id="${trackId}"]`);
      if (existing) {
        console.log(
          `Removing existing ${track.kind} element for track ${trackId}`
        );
        existing.remove();
      }

      try {
        const element = track.attach() as HTMLMediaElement;
        element.setAttribute("data-track-id", trackId);
        element.classList.add(isLocal ? "local-media" : "remote-media");

        //muting to prevent echo, for local videos or audios
        if (isLocal) {
          element.muted = true;
          if (element.tagName.toLowerCase() === "video") {
            element.style.transform = "scaleX(-1)"; //mirroring for self view
          }
          console.log(`Local ${track.kind} track muted to prevent echo`);
        }

        //adding the element to the container
        container.appendChild(element);

        //verifying element was added
        const attached = container.contains(element);
        console.log(
          `${track.kind} track ${trackId} attached successfully: ${attached}`,
          element
        );

        //verifying video tracks are displaying properly
        if (track.kind === "video") {
          //event listeners to monitor video
          const videoElement = element as HTMLVideoElement;
          videoElement.addEventListener("playing", () => {
            console.log(`Video track ${trackId} is playing`, {
              width: videoElement.videoWidth,
              height: videoElement.videoHeight,
              duration: videoElement.duration,
            });
          });

          element.addEventListener("error", (e) => {
            console.error(`Video track ${trackId} error:`, element.error, e);
          });
        }
        return element;
      } catch (error) {
        console.error(`Failed to attach ${track.kind} track:`, error);
        return null;
      }
    },
    []
  );

  const connectToVideoRoom = useCallback(
    async (token: string, roomName: string, callId: string, tracks: LocalTrack[]) => {
      try {
        // Update call state to connecting
        stableUpdateCallState({
          callId,
          type: CallType.VIDEO,
          status: CallStatus.CONNECTING,
        });

        console.log(
          "Connecting to room with tracks:",
          localTracks
            .map(
              (t) =>
                `${t.kind}:${t.name || "unnamed"} (enabled:${
                  "isEnabled" in t ? t.isEnabled : "N/A"
                })`
            )
            .join(", ")
        );

        // Before connecting, make sure containers exist
        const localContainer = document.getElementById("local-media-container");
        const remoteContainer = document.getElementById(
          "remote-media-container"
        );

        if (!localContainer) {
          console.error("Local media container not found");
        }

        if (!remoteContainer) {
          console.error("Remote media container not found");
        }

        // Connect to the room with appropriate options
        const room = await TwilioVideo.connect(token, {
          name: roomName,
          tracks: tracks,
          dominantSpeaker: true,
          preferredVideoCodecs: ["VP8", "H264"],
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

        console.log("Room connected:", room.sid);
        console.log("Local participant:", room.localParticipant.identity);

        // Store reference to the room
        deviceRef.current.videoDevice = room;

        // Attach local tracks
        console.log("Attaching local tracks...");
        const localVideoTracks = Array.from(
          room.localParticipant.videoTracks.values()
        );

        const localAudioTracks = Array.from(
          room.localParticipant.audioTracks.values()
        );

        console.log(`Local video tracks: ${localVideoTracks.length}`);
        console.log(`Local audio tracks: ${localAudioTracks.length}`);

        localVideoTracks.forEach((publication) => {
          if (publication.track) {
            console.log("Attaching local video track:", publication.trackSid);
            // attachTrack(publication.track, true);
          } else {
            console.warn("Local video publication has no track:", publication);
          }
        });

        localAudioTracks.forEach((publication) => {
          if (publication.track) {
            console.log("Attaching local audio track:", publication.trackSid);
            // attachTrack(publication.track, true);
          } else {
            console.warn("Local audio publication has no track:", publication);
          }
        });

        // Process already connected remote participants
        room.participants.forEach((participant) => {
          console.log("Processing existing participant:", participant.identity);

          // Handle existing video tracks
          participant.videoTracks.forEach((publication) => {
            if (publication.track) {
              console.log(
                `Attaching existing remote video: ${publication.trackSid}`
              );
              attachTrack(publication.track, false);
            }
          });

          // Handle existing audio tracks
          participant.audioTracks.forEach((publication) => {
            if (publication.track) {
              console.log(
                `Attaching existing remote audio: ${publication.trackSid}`
              );
              attachTrack(publication.track, false);
            }
          });

          // Set up listeners for this participant
          participant.on("trackSubscribed", (track) => {
            console.log(
              `Track subscribed from ${participant.identity}:`,
              track.kind,
              track.name
            );
            if (track.kind === "video" || track.kind === "audio") {
              attachTrack(track as RemoteVideoTrack | RemoteAudioTrack, false);
            }
          });

          participant.on("trackUnsubscribed", (track) => {
            console.log(
              `Track unsubscribed from ${participant.identity}:`,
              track.kind,
              track.name
            );
            track.detach().forEach((element) => element.remove());
          });
        });

        // Set up event handlers for future participants
        room.on("participantConnected", (participant) => {
          console.log("Participant connected:", participant.identity);

          participant.on("trackSubscribed", (track) => {
            console.log(
              `New track subscribed from ${participant.identity}:`,
              track.kind,
              track.name
            );
            if (track.kind === "video" || track.kind === "audio") {
              attachTrack(track as RemoteVideoTrack | RemoteAudioTrack, false);
            }
          });

          

          participant.on("trackUnsubscribed", (track) => {
            console.log(
              `Track unsubscribed from ${participant.identity}:`,
              track.kind,
              track.name
            );
            track.detach().forEach((element) => element.remove());
          });
        });

        // After setup, update call state
        stableUpdateCallState({
          status: CallStatus.CONNECTED,
          activeCall: room,
          participants: Array.from(room.participants.values()).map(
            (p) => p.identity
          ),
        });

        return room;
      } catch (error: any) {
        console.error("Video connection failed:", error);
        stableUpdateCallState({
          status: CallStatus.FAILED,
          error: error.message || "Failed to connect to video room",
        });
        throw error;
      }
    },
    [localTracks, stableUpdateCallState, attachTrack]
  );

  const initializeVoiceDevice = useCallback(
    (
      token: string,
      currentCallId: string,
      actualRecipientId: string
    ): TwilioVoice.Device => {
      if (!actualRecipientId) {
        throw new Error("Recipient ID is missing in call state");
      }

      // let connectionTimeout: NodeJS.Timeout;

      try {
        //cleaning up existing device
        if (deviceRef.current.voiceDevice) {
          deviceRef.current.voiceDevice.destroy();
        }

        // console.log("[Device Init] Creating new device");
        const device = new TwilioVoice.Device(token, {
          logLevel: "debug",
          codecPreferences: ["opus", "pcmu"],
          fakeLocalDTMF: true,
          enableRingingState: true,
          appName: "EchoChat",
          appVersion: "1.0.0",
        } as TwilioVoice.Device.Options);

        deviceRef.current.voiceDevice = device;

        // Add connection state tracking
        let connectionAttempts = 0;
        const connectionInterval = setInterval(() => {
          if (++connectionAttempts > 10) {
            clearInterval(connectionInterval);
          }
        }, 3000);

        device.on("ready", () => {
          stableUpdateCallState({
            callId: currentCallId,
            type: CallType.VOICE,
            status: CallStatus.INITIATED,
          });
        });

        device.on("registered", () => {
          console.log("[Device Status] Registered successfully");
          // console.log("Current device state:", device.state);
          // console.log("Connection state:", device.connectionState);
        
        });

        device.on("incoming", (conn) => {
          console.log("Incoming call from:", conn);
          //updating UI to show incoming call
          stableUpdateCallState({
            status: CallStatus.RINGING,
            activeCall: conn,
          });
        });

        device.on("connect", () => {
          console.log("Call connected successfully");
          stableUpdateCallState({
            status: CallStatus.CONNECTED,
            callId: currentCallId,
          });
        });

        device.on("connectionStateChanged", (state) => {
          console.log(`Connection state: ${state}`);
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
          stableUpdateCallState({
            status: CallStatus.REJECTED,
          });
        });

        device.on("error", (error) => {
          console.error("Twilio Device Error", error);
          if (error.code === 31208) {
            alert("Please upgrade your Twilio account");
          }
        });

        console.log("Device created, registering...");
        device.register();
        console.log("Registration requested");
        return device;
      } catch (error) {
        console.log("Twilio Room Error:", error);
        stableUpdateCallState({
          status: CallStatus.FAILED,
          activeCall: null,
        });
        console.error("[Device Init Error]", error);
        throw error;
      }
    },
    [stableUpdateCallState]
  );

  const makeVoiceCall = useCallback(
    async (
      identity: string,
      currentCallId: string,
      userId: string
    ): Promise<TwilioVoice.Connection> => {
      const device = deviceRef.current.voiceDevice;
      if (!device) {
        throw new Error("Voice device not initialized");
      }

      if (device.state !== "registered") {
        throw new Error(
          "Device not registered. Current state: " + device.state
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

        console.log("Call parameters:", {
          To: formattedTo,
          From: formattedFrom,
          CallSid: currentCallId,
        });

        call.on("accept", () => {
          // console.log("Call accepted by recipient");
          stableUpdateCallState({
            status: CallStatus.CONNECTED,
            callId: currentCallId,
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
