import { CallStatus, CallType } from "../../types";

export interface CallState {
  currentCall: {
    id: string | null;
    type: CallType | null;
    status: CallStatus;
    participants: string[];
    initiator: string | null;
    roomName: string | null;
  };
  incomingCall: {
    callId: string | null;
    callerId: string | null;
    type: CallType | null;
  };
  localMedia: {
    audioEnabled: boolean;
    videoEnabled: boolean;
    screenShareEnabled: boolean;
  };
  callQuality: "good" | "average" | "poor";
  isScreenSharing: boolean;
  error: string | null;
}

export type CallAction =
  | {
      type: "INITIATE_CALL";
      payload: { callId: string; type: CallType; recipientId: string; initiator: string };
    }
  | { type: "ACCEPT_CALL"; payload: { callId: string } }
  | { type: "REJECT_CALL"; payload: { callId: string } }
  | { type: "END_CALL" }
  | {
      type: "SHOW_INCOMING_CALL";
      payload: {
        callId: string;
        callerId: string;
        type: CallType;
      };
    }
  | { type: "CLEAR_INCOMING_CALL" }
  | { type: "UPDATE_MEDIA"; payload: Partial<CallState["localMedia"]> }
  | { type: "SET_SCREEN_SHARE"; payload: boolean }
  | { type: "SET_QUALITY"; payload: CallState["callQuality"] }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "ADD_PARTICIPANT"; payload: string }
  | { type: "REMOVE_PARTICIPANT"; payload: string }
  | { type: "UPDATE_CALL"; payload: Partial<CallState> };

export const initialState: CallState = {
  currentCall: {
    id: null,
    type: null,
    status: CallStatus.INITIATED,
    participants: [],
    initiator: null,
    roomName: null,
  },
  incomingCall: {
    callId: null,
    callerId: null,
    type: null,
  },
  localMedia: {
    audioEnabled: true,
    videoEnabled: true,
    screenShareEnabled: false,
  },
  callQuality: "good",
  isScreenSharing: false,
  error: null,
};

export function callReducer(state: CallState, action: CallAction): CallState {
  switch (action.type) {
    case "INITIATE_CALL":
      return {
        ...state,
        currentCall: {
          ...state.currentCall,
          id: action.payload.callId,
          type: action.payload.type,
          status: CallStatus.INITIATED,
          initiator: action.payload.initiator,
        },
      };
    case "ACCEPT_CALL":
      return {
        ...state,
        currentCall: {
          ...state.currentCall,
          status: CallStatus.CONNECTED,
        },
      };
    case "REJECT_CALL":
      return {
        ...state,
        currentCall: initialState.currentCall,
        error: "Call rejected",
      };
    case "END_CALL":
      return {
        ...state,
        currentCall: initialState.currentCall,
        localMedia: initialState.localMedia,
      };
    case "UPDATE_MEDIA":
      return {
        ...state,
        localMedia: {
          ...state.localMedia,
          ...action.payload,
        },
      };
    case "SET_SCREEN_SHARE":
      return {
        ...state,
        isScreenSharing: action.payload,
      };
    case "SET_QUALITY":
      return {
        ...state,
        callQuality: action.payload,
      };
    case "SET_ERROR":
      return {
        ...state,
        error: action.payload,
      };
    case "ADD_PARTICIPANT":
      return {
        ...state,
        currentCall: {
          ...state.currentCall,
          participants: [
            ...new Set([...state.currentCall.participants, action.payload]),
          ],
        },
      };
    case "REMOVE_PARTICIPANT":
      return {
        ...state,
        currentCall: {
          ...state.currentCall,
          participants: state.currentCall.participants.filter(
            (id) => id !== action.payload
          ),
        },
      };
    case "UPDATE_CALL":
      return {
        ...state,
        ...action.payload,
        currentCall: {
          ...state.currentCall,
          ...(action.payload.currentCall || {}),
        },
      };
    case "SHOW_INCOMING_CALL":
      return {
        ...state,
        incomingCall: action.payload,
      };
    case "CLEAR_INCOMING_CALL":
      return {
        ...state,
        incomingCall: {
          callId: null,
          callerId: null,
          type: null,
        },
      };
    default:
      return state;
  }
}

// import { CallState, CallStatus } from "../../types";
// import { StateTransitionMiddleware } from "./stateValidationMiddleware";
// import api from "../../utils/api";

// export class CallStateManager {
//   private state: CallState;
//   private stateHistory: CallState[] = [];
//   private listeners: Set<(state: CallState) => void> = new Set();
//   private cleanupHandlers: Map<CallStatus, (() => Promise<void>)[]> = new Map();
//   private middleware: StateTransitionMiddleware[] = [];

//   constructor() {
//     this.state = {
//       isInCall: false,
//       callType: null,
//       callStatus: "idle",
//       remoteUser: null,
//       roomName: null,
//       localStream: null,
//       remoteStream: null,
//       localAudioEnabled: true,
//       localVideoEnabled: true,
//       isScreenSharing: false,
//       callQuality: null,
//     };
//   }

//   useMiddleware(middleware: StateTransitionMiddleware): void {
//     this.middleware.push(middleware);
//   }

//   async syncCallState() {
//     try {
//       const response = await api.get(`/api/call/${this.state.roomName}`);
//       const serverState = response.data;

//       //resolving state conflicts
//       if (serverState.status !== this.state.callStatus) {
//         await this.transition({
//           callStatus: serverState.status,
//           ...(serverState.status === 'ended' && { isInCall: false })
//         });
//       }
//     } catch (error) {
//       console.error('State synchronization failed:', error);
//     }
//   }

//   private async executeMiddlewareBeforeTransition(
//     currentState: CallState,
//     newState: Partial<CallState>
//   ): Promise<void> {
//     for (const m of this.middleware) {
//       try {
//         await m.beforeTransition(currentState, newState);
//       } catch (error) {
//         console.error(`Middleware beforeTransition failed:`, error);
//         throw error;
//       }
//     }
//   }

//   private async executeMiddlewareAfterTransition(
//     newState: CallState
//   ): Promise<void> {
//     for (const m of this.middleware) {
//       try {
//         await m.afterTransition(newState);
//       } catch (error) {
//         console.error(`Middleware afterTransition failed:`, error);
//         throw error;
//       }
//     }
//   }

//   async transition(newState: Partial<CallState>): Promise<void> {
//     const currentState = { ...this.state };

//     //websocket connection check
//     if (newState.callStatus && newState.callStatus !== "idle") {
//       const connectionStatus = this.middleware
//         .map((m) => m.isConnected?.())
//         .find((status) => typeof status === "boolean");

//       if (connectionStatus === false) {
//         throw new Error("WebSocket connection not available");
//       }
//     }

//     try {
//       // Execute middleware before transition
//       await this.executeMiddlewareBeforeTransition(currentState, newState);

//       // Save current state to history with timestamp
//       this.stateHistory.push({
//         ...currentState,
//         timestamp: Date.now(),
//       });

//       // Execute cleanup handlers if transitioning to a new status
//       if (
//         newState.callStatus &&
//         newState.callStatus !== currentState.callStatus
//       ) {
//         await this.executeCleanupHandlers(currentState.callStatus);
//       }

//       // Update state
//       this.state = {
//         ...currentState,
//         ...newState,
//       };

//       // Execute middleware after transition
//       await this.executeMiddlewareAfterTransition(this.state);

//       // Notify listeners
//       this.notifyListeners();
//     } catch (error) {
//       // Attempt state recovery if transition fails
//       if (this.stateHistory.length > 0) {
//         const previousState = this.stateHistory.pop()!;
//         this.state = { ...previousState };
//         this.notifyListeners();
//       }
//       throw error;
//     }
//   }

//   registerCleanupHandler(
//     status: CallStatus,
//     handler: () => Promise<void>
//   ): void {
//     const handlers = this.cleanupHandlers.get(status) || [];
//     handlers.push(handler);
//     this.cleanupHandlers.set(status, handlers);
//   }

//   private async executeCleanupHandlers(status: CallStatus): Promise<void> {
//     const handlers = this.cleanupHandlers.get(status) || [];
//     await Promise.allSettled(handlers.map((handler) => handler()));
//   }

//   async reset(): Promise<void> {
//     const currentState = { ...this.state };
//     try {
//       // Execute cleanup handlers for current state
//       await this.executeCleanupHandlers(this.state.callStatus);

//       // Execute middleware before reset
//       await this.executeMiddlewareBeforeTransition(currentState, {
//         isInCall: false,
//         callType: null,
//         callStatus: "idle",
//         remoteUser: null,
//         roomName: null,
//         localStream: null,
//         remoteStream: null,
//         localAudioEnabled: true,
//         localVideoEnabled: true,
//         isScreenSharing: false,
//         callQuality: null,
//       });

//       // Reset to initial state
//       this.state = {
//         isInCall: false,
//         callType: null,
//         callStatus: "idle",
//         remoteUser: null,
//         roomName: null,
//         localStream: null,
//         remoteStream: null,
//         localAudioEnabled: true,
//         localVideoEnabled: true,
//         isScreenSharing: false,
//         callQuality: null,
//       };
//       // Execute middleware after reset
//       await this.executeMiddlewareAfterTransition(this.state);

//       this.stateHistory = [];
//       this.notifyListeners();
//     } catch (error) {
//       console.error("Error during state reset:", error);
//       throw error;
//     }
//   }

//   getState(): CallState {
//     return { ...this.state };
//   }

//   getStateHistory(): CallState[] {
//     return [...this.stateHistory];
//   }

//   subscribe(listener: (state: CallState) => void): () => void {
//     this.listeners.add(listener);
//     return () => this.listeners.delete(listener);
//   }

//   private notifyListeners(): void {
//     const stateCopy = { ...this.state };
//     this.listeners.forEach((listener) => listener(stateCopy));
//   }

//   // Utility method to handle incomplete state transitions
//   async handleIncompleteTransition(targetStatus: CallStatus): Promise<void> {
//     const currentState = this.getState();
//     const lastTransition = this.stateHistory[this.stateHistory.length - 1];

//     if (
//       currentState.callStatus === "connecting" &&
//       lastTransition?.timestamp &&
//       Date.now() - lastTransition.timestamp > 30000
//     ) {
//       await this.transition({
//         callStatus: "ended",
//         isInCall: false,
//       });
//     }
//   }
//   clearMiddleware(): void {
//     this.middleware = [];
//   }
// }
