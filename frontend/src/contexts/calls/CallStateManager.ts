import { CallState, CallStatus } from "../../types";
import { StateTransitionMiddleware } from "./stateValidationMiddleware";

export class CallStateManager {
  private state: CallState;
  private stateHistory: CallState[] = [];
  private listeners: Set<(state: CallState) => void> = new Set();
  private cleanupHandlers: Map<CallStatus, (() => Promise<void>)[]> = new Map();
  private middleware: StateTransitionMiddleware[] = [];

  constructor() {
    this.state = {
      isInCall: false,
      callType: null,
      callStatus: "idle",
      remoteUser: null,
      roomName: null,
      localStream: null,
      remoteStream: null,
    };
  }

  useMiddleware(middleware: StateTransitionMiddleware): void {
    this.middleware.push(middleware);
  }

  private async executeMiddlewareBeforeTransition(
    currentState: CallState,
    newState: Partial<CallState>
  ): Promise<void> {
    for (const m of this.middleware) {
      try {
        await m.beforeTransition(currentState, newState);
      } catch (error) {
        console.error(`Middleware beforeTransition failed:`, error);
        throw error;
      }
    }
  }

  private async executeMiddlewareAfterTransition(
    newState: CallState
  ): Promise<void> {
    for (const m of this.middleware) {
      try {
        await m.afterTransition(newState);
      } catch (error) {
        console.error(`Middleware afterTransition failed:`, error);
        throw error;
      }
    }
  }

  async transition(newState: Partial<CallState>): Promise<void> {
    const currentState = { ...this.state };

    try {
      // Execute middleware before transition
      await this.executeMiddlewareBeforeTransition(currentState, newState);

      // Save current state to history with timestamp
      this.stateHistory.push({
        ...currentState,
        timestamp: Date.now(),
      });

      // Execute cleanup handlers if transitioning to a new status
      if (
        newState.callStatus &&
        newState.callStatus !== currentState.callStatus
      ) {
        await this.executeCleanupHandlers(currentState.callStatus);
      }

      // Update state
      this.state = {
        ...currentState,
        ...newState,
      };

      // Execute middleware after transition
      await this.executeMiddlewareAfterTransition(this.state);

      // Notify listeners
      this.notifyListeners();
    } catch (error) {
      // Attempt state recovery if transition fails
      if (this.stateHistory.length > 0) {
        const previousState = this.stateHistory.pop()!;
        this.state = { ...previousState };
        this.notifyListeners();
      }
      throw error;
    }
  }

  registerCleanupHandler(
    status: CallStatus,
    handler: () => Promise<void>
  ): void {
    const handlers = this.cleanupHandlers.get(status) || [];
    handlers.push(handler);
    this.cleanupHandlers.set(status, handlers);
  }

  private async executeCleanupHandlers(status: CallStatus): Promise<void> {
    const handlers = this.cleanupHandlers.get(status) || [];
    await Promise.allSettled(handlers.map((handler) => handler()));
  }

  async reset(): Promise<void> {
    const currentState = { ...this.state };
    try {
      // Execute cleanup handlers for current state
      await this.executeCleanupHandlers(this.state.callStatus);

      // Execute middleware before reset
      await this.executeMiddlewareBeforeTransition(currentState, {
        isInCall: false,
        callType: null,
        callStatus: "idle",
        remoteUser: null,
        roomName: null,
        localStream: null,
        remoteStream: null,
      });

      // Reset to initial state
      this.state = {
        isInCall: false,
        callType: null,
        callStatus: "idle",
        remoteUser: null,
        roomName: null,
        localStream: null,
        remoteStream: null,
      };
      // Execute middleware after reset
      await this.executeMiddlewareAfterTransition(this.state);

      this.stateHistory = [];
      this.notifyListeners();
    } catch (error) {
      console.error("Error during state reset:", error);
      throw error;
    }
  }

  getState(): CallState {
    return { ...this.state };
  }

  getStateHistory(): CallState[] {
    return [...this.stateHistory];
  }

  subscribe(listener: (state: CallState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const stateCopy = { ...this.state };
    this.listeners.forEach((listener) => listener(stateCopy));
  }

  // Utility method to handle incomplete state transitions
  async handleIncompleteTransition(targetStatus: CallStatus): Promise<void> {
    const currentState = this.getState();
    const lastTransition = this.stateHistory[this.stateHistory.length - 1];

    if (
      currentState.callStatus === "connecting" &&
      lastTransition?.timestamp &&
      Date.now() - lastTransition.timestamp > 30000
    ) {
      await this.transition({
        callStatus: "ended",
        isInCall: false,
      });
    }
  }
  clearMiddleware(): void {
    this.middleware = [];
  }
}