// import { CallType, CallEvent } from "../../types";
// import { CallStateManager } from "./CallStateManager";
// import { MediaStreamManager } from "./MediaStreamManager";
// import { TwilioRoomManager } from "./TwilioRoomManager";
// import api from "../../utils/api";

// export class CallEventHandler {
//   constructor(
//     private stateManager: CallStateManager,
//     private mediaManager: MediaStreamManager,
//     private roomManager: TwilioRoomManager,
//     private sendWebSocketMessage: (message: any) => void
//   ) {
//     this.registerCleanupHandlers();
//   }

//   private registerCleanupHandlers(): void {
//     //registering cleanup for connecting state
//     this.stateManager.registerCleanupHandler("connecting", async () => {
//       const state = this.stateManager.getState();
//       if (state.callStatus === "ended") {
//         await this.mediaManager.cleanupLocalStream();
//       }
//     });

//     //registering cleanup for connected state
//     this.stateManager.registerCleanupHandler("connected", async () => {
//       await this.mediaManager.cleanupLocalStream();
//       await this.mediaManager.cleanupRemoteStream();
//       this.roomManager.handleDisconnect();
//     });

//     //registering cleanup for ended state
//     this.stateManager.registerCleanupHandler("ended", async () => {
//       await this.mediaManager.cleanupLocalStream();
//       await this.mediaManager.cleanupRemoteStream();
//       this.roomManager.handleDisconnect();
//     });
//   }

//   async handleIncomingCall(event: CallEvent): Promise<void> {
//     try {
//       const currentState = this.stateManager.getState();

//       if (
//         currentState.callStatus !== "idle" &&
//         currentState.callStatus !== "ended"
//       ) {
//         console.warn(
//           "Cannot handle incoming call in current state:",
//           currentState.callStatus
//         );
//         return;
//       }

//       console.log("Processing incoming call event:", event);

//       if (
//         !event.data?.roomName ||
//         !event.data?.initiatorId ||
//         !event.data?.type
//       ) {
//         throw new Error("Invalid call initiation message");
//       }

//       const { initiatorId: senderId, roomName, type: callType } = event.data;

//       try {
//         const response = await api.get(`/api/user/${senderId}`);
//         if (!response.data?.user) {
//           throw new Error("Caller information not found");
//         }

//         //setting incomimg state
//         await this.stateManager.transition({
//           callStatus: "incoming",
//           callType: callType as CallType,
//           remoteUser: response.data.user,
//           roomName,
//           isInCall: true,
//         });

//         console.log("Incoming call statee set successfully");
//       } catch (apiError: any) {
//         console.error("Failed to fetch caller info:", apiError);
//         throw new Error(`Caller information error: ${apiError.message}`);
//       }
//     } catch (error) {
//       console.error("Error handling incoming call:", error);
//       await this.cleanup();
//     }
//   }

//   // async handleCallAccepted(event: CallEvent): Promise<void> {
//   //   try {
//   //     const currentState = this.stateManager.getState();

//   //     // handling accepted events from both outgoing and connecting states
//   //     if (
//   //       currentState.callStatus !== "outgoing" &&
//   //       currentState.callStatus !== "connecting"
//   //     ) {
//   //       console.warn(
//   //         `Received call acceptance in invalid state: ${currentState.callStatus}`
//   //       );
//   //       return;
//   //     }

//   //     // first transitioning to connecting state
//   //     await this.stateManager.transition({
//   //       callStatus: "connecting",
//   //     });

//   //     // setting up media streams and room connection if not done
//   //     if (!currentState.localStream) {
//   //       const localStream = await this.mediaManager.setupLocalStream(
//   //         currentState.callType!
//   //       );

//   //       if (currentState.roomName) {
//   //         try {
//   //           await this.roomManager.connectToRoom(
//   //             currentState.roomName,
//   //             localStream.getTracks()
//   //           );
//   //         } catch (roomError) {
//   //           console.error("Error connecting to room:", roomError);
//   //           throw roomError;
//   //         }
//   //       }

//   //       await this.stateManager.transition({
//   //         callStatus: "connected",
//   //         localStream,
//   //       });
//   //     } else {
//   //       //if local stream is available, transition to connected
//   //       await this.stateManager.transition({
//   //         callStatus: "connected",
//   //       });
//   //     }

//   //     //kkick off quality monitoring after connection is established
//   //     this.roomManager.startQualityMonitoring((quality) => {
//   //       //fill out
//   //       // We need to pass this through to the CallContext
//   //       // This will be handled by the CallProvider
//   //     });
//   //   } catch (error) {
//   //     console.error("Error handling call acceptance:", error);
//   //     await this.cleanup();
//   //   }
//   // }

//   async handleCallAccepted(event: CallEvent): Promise<void> {
//     try {
//       const currentState = this.stateManager.getState();
//       const { roomName } = event.data;

//       if (!roomName) throw new Error("Missing room name");

//       const token = await api.post("/api/call/token", { roomName });
//       const localStream = await this.mediaManager.setupLocalStream(
//         currentState.callType || "video"
//       );

//       await this.roomManager.connectToRoom(
//         roomName,
//         token.data.token,
//         currentState.callType || "video"
//       );

//       await this.stateManager.transition({
//         callStatus: "connected",
//         localStream,
//         isInCall: true,
//       });
//     } catch (error) {
//       console.error("Call acceptance failed:", error);
//       await this.cleanup();
//     }
//   }

//   async handleCallRejected(): Promise<void> {
//     try {
//       await this.stateManager.transition({
//         callStatus: "ended",
//         isInCall: false,
//       });
//     } catch (error) {
//       console.error("Error handling call rejection:", error);
//       await this.cleanup();
//     }
//   }

//   async handleCallEnded(event?: CallEvent): Promise<void> {
//     const currentState = this.stateManager.getState();

//     if (event?.data?.forceCleanup) {
//       console.log("Forced call termination received from remote party");
//     }

//     //checking to see if we need to notify other party
//     if (
//       currentState.isInCall &&
//       currentState.remoteUser?._id &&
//       currentState.roomName &&
//       !event?.data?.forceCleanup //don't send if we're responding to a force cleanup
//     ) {
//       try {
//         this.sendWebSocketMessage({
//           type: "call_ended",
//           receiverId: currentState.remoteUser._id,
//           roomName: currentState.roomName,
//           forceCleanup: true,
//         });
//       } catch (error) {
//         console.warn(
//           "Failed to send call_ended event, proceeding with cleanup anyway",
//           error
//         );
//       }
//     }

//     //proceeding  with cleanup
//     await this.cleanup();
//   }

//   private async cleanup(): Promise<void> {
//     try {
//       const currentState = this.stateManager.getState();

//       //perform cleanup if only in a call state
//       if (currentState.isInCall) {
//         await this.stateManager.transition({
//           callStatus: "ended",
//           isInCall: false,
//         });

//         //clean up media resources
//         await Promise.allSettled([
//           this.mediaManager.cleanupLocalStream(),
//           this.mediaManager.cleanupRemoteStream(),
//         ]);

//         //disconnecting from room if connected
//         this.roomManager.handleDisconnect();

//         //reset state afterwards
//         await this.stateManager.reset();
//       }
//     } catch (error) {
//       console.error("Error during cleanup:", error);
//       // Force reset in case of error
//       try {
//         await this.stateManager.reset();
//       } catch (resetError) {
//         console.error("Failed to reset state:", resetError);
//       }
//     }
//   }
// }

export {};