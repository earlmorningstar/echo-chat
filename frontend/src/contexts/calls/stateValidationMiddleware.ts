import { CallState, CallStatus } from "../../types";

export interface StateTransitionMiddleware {
  beforeTransition: (
    currentState: CallState,
    newState: Partial<CallState>
  ) => Promise<void>;
  afterTransition: (newState: CallState) => Promise<void>;
}

export class CallStateValidationMiddleware
  implements StateTransitionMiddleware
{
  private static readonly MAX_TRANSITION_TIME = 30000; // 30 seconds
  private static readonly MAX_RETRY_ATTEMPTS = 3;
  private transitionStartTimes: Map<string, number> = new Map();
  private retryAttempts: Map<string, number> = new Map();

  //   async beforeTransition(
  //     currentState: CallState,
  //     newState: Partial<CallState>
  //   ): Promise<void> {
  //     // Validate state consistency
  //     this.validateStateConsistency(currentState, newState);

  //     // Track transition start time
  //     if (newState.callStatus) {
  //       this.transitionStartTimes.set(
  //         this.getTransitionKey(currentState.callStatus, newState.callStatus),
  //         Date.now()
  //       );
  //     }
  //   }

  //   async afterTransition(newState: CallState): Promise<void> {
  //     // Check for stuck transitions
  //     await this.checkStuckTransitions(newState);

  //     // Validate final state
  //     this.validateFinalState(newState);

  //     // Cleanup transition tracking
  //     this.cleanupTransitionTracking(newState.callStatus);
  //   }

  async beforeTransition(
    currentState: CallState,
    newState: Partial<CallState>
  ): Promise<void> {
    await this.validateStateConsistency(currentState, newState);
    this.trackTransitionStart(
      currentState.callStatus,
      newState.callStatus as CallStatus
    );
  }

  async afterTransition(newState: CallState): Promise<void> {
    await this.validateFinalState(newState);
    await this.checkStuckTransitions(newState);
    this.cleanupTransitionTracking(newState.callStatus);
  }

  private trackTransitionStart(
    fromStatus: CallStatus,
    toStatus: CallStatus | undefined
  ): void {
    if (toStatus) {
      const transitionKey = this.getTransitionKey(fromStatus, toStatus);
      this.transitionStartTimes.set(transitionKey, Date.now());
    }
  }

  // private validateStateConsistency(
  //   currentState: CallState,
  //   newState: Partial<CallState>
  // ): void {
  //   // Validate isInCall consistency
  //   if (newState.callStatus === "idle" && newState.isInCall === true) {
  //     throw new Error("Invalid state: Cannot be in call while in idle status");
  //   }

  //   // Validate media stream consistency
  //   if (
  //     newState.callStatus === "connected" &&
  //     !currentState.localStream &&
  //     !newState.localStream
  //   ) {
  //     throw new Error(
  //       "Invalid state: Connected status requires local media stream"
  //     );
  //   }

  //   // Validate room name consistency
  //   if (
  //     newState.callStatus &&
  //     ["connecting", "connected"].includes(newState.callStatus) &&
  //     !currentState.roomName &&
  //     !newState.roomName
  //   ) {
  //     throw new Error(
  //       "Invalid state: Room name required for connecting/connected status"
  //     );
  //   }
  // }

  private async validateStateConsistency(
    currentState: CallState,
    newState: Partial<CallState>
  ): Promise<void> {
    if (newState.callStatus === "idle" && newState.isInCall === true) {
      throw new Error("Invalid state: Cannot be in call while in idle status");
    }

    if (
      newState.callStatus === "connected" &&
      !currentState.localStream &&
      !newState.localStream
    ) {
      const retryKey = this.getTransitionKey(
        currentState.callStatus,
        "connected"
      );
      const attempts = this.retryAttempts.get(retryKey) || 0;

      if (attempts < CallStateValidationMiddleware.MAX_RETRY_ATTEMPTS) {
        this.retryAttempts.set(retryKey, attempts + 1);
        throw new Error("Retrying media stream setup");
      } else {
        throw new Error(
          "Failed to establish media stream after maximum retries"
        );
      }
    }

    if (
      newState.callStatus &&
      ["connecting", "connected"].includes(newState.callStatus) &&
      !currentState.roomName &&
      !newState.roomName
    ) {
      throw new Error(
        "Invalid state: Room name required for connecting/connected status"
      );
    }
  }

  private validateFinalState(state: CallState): void {
    // Validate call type consistency
    if (state.isInCall && !state.callType) {
      throw new Error("Invalid state: Call type required when in call");
    }

    // Validate remote user consistency
    if (state.isInCall && !state.remoteUser) {
      throw new Error("Invalid state: Remote user required when in call");
    }

    // Validate media streams
    if (state.callStatus === "connected") {
      if (!state.localStream) {
        throw new Error(
          "Invalid state: Local stream required in connected status"
        );
      }

      if (!state.remoteStream) {
        console.warn(
          "Warning: Remote stream not available in connected status"
        );
      }

      // Add connection state validation
      if (state.callStatus === "connected") {
        if (!state.roomName) {
          throw new Error("Connected state requires valid room name");
        }
      }
      //   if (!state.roomName) {
      //     throw new Error("Connected state requires valid room name");
      //   }
    }
  }

  private async checkStuckTransitions(newState: CallState): Promise<void> {
    const currentTime = Date.now();

    for (const [transitionKey, startTime] of this.transitionStartTimes) {
      if (
        currentTime - startTime >
        CallStateValidationMiddleware.MAX_TRANSITION_TIME
      ) {
        const [fromStatus, toStatus] = transitionKey.split("->") as [
          CallStatus,
          CallStatus
        ];

        if (newState.callStatus === toStatus) {
          console.warn(
            `Transition from ${fromStatus} to ${toStatus} took longer than expected`
          );
        } else {
          throw new Error(
            `Transition from ${fromStatus} to ${toStatus} timed out`
          );
        }
      }
    }
  }

  private getTransitionKey(
    fromStatus: CallStatus,
    toStatus: CallStatus
  ): string {
    return `${fromStatus}->${toStatus}`;
  }

  private cleanupTransitionTracking(currentStatus: CallStatus): void {
    // Remove completed transition trackers
    for (const [key] of this.transitionStartTimes) {
      const [, toStatus] = key.split("->") as [CallStatus, CallStatus];
      if (toStatus === currentStatus) {
        this.transitionStartTimes.delete(key);
        this.retryAttempts.delete(key);
      }
    }
  }
}
