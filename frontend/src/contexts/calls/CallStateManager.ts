import { CallStatus, CallType } from "../../types";
import type { ActiveCall } from "../../types/calls";

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
    token?: string;
    activeCall?: unknown;
  };
  activeCall?: ActiveCall;

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
      payload: {
        callId: string;
        type: CallType;
        recipientId: string;
        initiator: string;
      };
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
        token: string;
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
        incomingCall: action.payload.incomingCall ?? state.incomingCall,
      };
    case "SHOW_INCOMING_CALL":
      return {
        ...state,
        incomingCall: {
          callId: action.payload.callId,
          callerId: action.payload.callerId,
          type: action.payload.type,
          token: action.payload.token,
        },
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
