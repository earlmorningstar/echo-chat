import { CallType, CallEvent } from "../../types";
import { CallStateManager } from "./CallStateManager";
import { MediaStreamManager } from "./MediaStreamManager";
import { TwilioRoomManager } from "./TwilioRoomManager";
import api from "../../utils/api";

export class CallEventHandler {
  constructor(
    private stateManager: CallStateManager,
    private mediaManager: MediaStreamManager,
    private roomManager: TwilioRoomManager,
    private sendWebSocketMessage: (message: any) => void
  ) {
    this.registerCleanupHandlers();
  }

  private registerCleanupHandlers(): void {
    // Register cleanup for connecting state
    this.stateManager.registerCleanupHandler("connecting", async () => {
      const state = this.stateManager.getState();
      if (state.callStatus === "ended") {
        await this.mediaManager.cleanupLocalStream();
      }
    });

    // Register cleanup for connected state
    this.stateManager.registerCleanupHandler("connected", async () => {
      await this.mediaManager.cleanupLocalStream();
      await this.mediaManager.cleanupRemoteStream();
      this.roomManager.disconnectFromRoom();
    });

    // Register cleanup for ended state
    this.stateManager.registerCleanupHandler("ended", async () => {
      await this.mediaManager.cleanupLocalStream();
      await this.mediaManager.cleanupRemoteStream();
      this.roomManager.disconnectFromRoom();
    });
  }

  async handleIncomingCall(event: CallEvent): Promise<void> {
    try {
      const currentState = this.stateManager.getState();
      if (currentState.callStatus !== "idle") return;

      const data = event.data;
      if (!data || typeof data !== "object") {
        throw new Error("Invalid callevent data");
      }

      //using proper evt data structure
      // const initiatorId = event.data?.initiatorId;
      // const roomName = event.data?.roomName;
      // const callType = event.data?.type;

      const { initiatorId, roomName, type } = data;
      if (!initiatorId || !roomName || !type) {
        throw new Error("Missing required call parameters");
      }

      const response = await api.get(`/api/user/${initiatorId}`);
      if (!response.data?.user) {
        throw new Error("Caller information not found");
      }

      await this.stateManager.transition({
        callStatus: "incoming",
        callType: type as CallType,
        remoteUser: response.data.user,
        roomName,
        isInCall: true,
      });
    } catch (error) {
      console.error("Error handling incoming call:", error);
      await this.cleanup();
    }
  }

  async handleCallAccepted(event: CallEvent): Promise<void> {
    try {
      const currentState = this.stateManager.getState();

      // handling accepted events from both outgoing and connecting states
      if (
        currentState.callStatus !== "outgoing" &&
        currentState.callStatus !== "connecting"
      ) {
        console.warn(
          `Received call acceptance in invalid state: ${currentState.callStatus}`
        );
        return;
      }

      // first transitioning to connecting state
      await this.stateManager.transition({
        callStatus: "connecting",
      });

      // setting up media streams and room connection if not done
      if (!currentState.localStream) {
        const localStream = await this.mediaManager.setupLocalStream(
          currentState.callType!
        );

        if (currentState.roomName) {
          try {
            await this.roomManager.connectToRoom(
              currentState.roomName,
              localStream.getTracks()
            );
          } catch (roomError) {
            console.error("Error connecting to room:", roomError);
            throw roomError;
          }
        }

        await this.stateManager.transition({
          callStatus: "connected",
          localStream,
        });
      } else {
        //if local stream is available, transition to connected
        await this.stateManager.transition({
          callStatus: "connected",
        });
      }

      //kkick off quality monitoring after connection is established
      this.roomManager.startQualityMonitoring((quality) => {
        //fill out
        // We need to pass this through to the CallContext
        // This will be handled by the CallProvider
      });
    } catch (error) {
      console.error("Error handling call acceptance:", error);
      await this.cleanup();
    }
  }

  async handleCallRejected(): Promise<void> {
    try {
      await this.stateManager.transition({
        callStatus: "ended",
        isInCall: false,
      });
    } catch (error) {
      console.error("Error handling call rejection:", error);
      await this.cleanup();
    }
  }

  async handleCallEnded(event?: CallEvent): Promise<void> {
    const currentState = this.stateManager.getState();

    if (event?.data?.forceCleanup) {
      console.log("Forced call termination received from remote party");
    }

    //checking to see if we need to notify other party
    if (
      currentState.isInCall &&
      currentState.remoteUser?._id &&
      currentState.roomName &&
      !event?.data?.forceCleanup //don't send if we're responding to a force cleanup
    ) {
      try {
        this.sendWebSocketMessage({
          type: "call_ended",
          receiverId: currentState.remoteUser._id,
          roomName: currentState.roomName,
          forceCleanup: true,
        });
      } catch (error) {
        console.warn(
          "Failed to send call_ended event, proceeding with cleanup anyway",
          error
        );
      }
    }

    //proceeding  with cleanup
    await this.cleanup();
  }

  private async cleanup(): Promise<void> {
    try {
      const currentState = this.stateManager.getState();

      //perform cleanup if only in a call state
      if (currentState.isInCall) {
        await this.stateManager.transition({
          callStatus: "ended",
          isInCall: false,
        });

        //clean up media resources
        await Promise.allSettled([
          this.mediaManager.cleanupLocalStream(),
          this.mediaManager.cleanupRemoteStream(),
        ]);

        //disconnecting from room if connected
        this.roomManager.disconnectFromRoom();

        //reset state afterwards
        await this.stateManager.reset();
      }
    } catch (error) {
      console.error("Error during cleanup:", error);
      // Force reset in case of error
      try {
        await this.stateManager.reset();
      } catch (resetError) {
        console.error("Failed to reset state:", resetError);
      }
    }
  }
}
