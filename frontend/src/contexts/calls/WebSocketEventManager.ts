import { EventEmitter } from "events";

interface WSEvent {
  id: string;
  type: string;
  data: any;
  attempts: number;
  timestamp: number;
  priority: number;
}

export class WebSocketEventManager {
  public get connectionState(): number {
    return this.ws.readyState;
  }
  public get isConnected(): boolean {
    return this.ws.readyState === WebSocket.OPEN;
  }

  private eventQueue: WSEvent[] = [];
  private processingQueue: boolean = false;
  private eventEmitter = new EventEmitter();
  public ws: WebSocket;
  private maxRetries: number = 3;
  private retryDelay: number = 1000;
  private readonly maxQueueSize = 100;
  private pendingAcks = new Map<
    string,
    { timeout: NodeJS.Timeout; resolve: (value: boolean) => void }
  >();

  constructor(ws: WebSocket) {
    this.ws = ws;
    this.eventEmitter = new EventEmitter();
    this.eventEmitter.setMaxListeners(20);

    // this.isConnected = ws.readyState === WebSocket.OPEN;

    ws.addEventListener("open", this.handleConnectionOpen.bind(this));
    ws.addEventListener("close", this.handleConnectionClose.bind(this));
    ws.addEventListener("message", this.handleIncomingMessage.bind(this));
    ws.addEventListener("error", this.handleConnectionError.bind(this));
  }

  public checkConnection(): boolean {
    return this.ws.readyState === WebSocket.OPEN;
  }

  private handleConnectionOpen() {
    this.processQueue().catch((error) => {
      console.error("Error processing queue after connection:", error);
    });
  }

  private handleConnectionClose() {
    this.clearPendingAcks();
  }

  private handleConnectionError(error: Event) {
    console.error("WebSocket connection error:", error);
    this.clearPendingAcks();
  }

  private handleIncomingMessage(event: MessageEvent) {
    try {
      const message = JSON.parse(event.data);
      // console.log("Received message:", message);

      //handling acknowledgments
      if (message.type === "ack") {
        const pending = this.pendingAcks.get(message.id);
        if (pending) {
          clearTimeout(pending.timeout);
          pending.resolve(true);
          this.pendingAcks.delete(message.id);
        }
        return;
      }

      this.eventEmitter.emit("message", message);
    } catch (error) {
      console.error("Error handling incoming message", event.data);
    }
  }

  private clearPendingAcks() {
    this.pendingAcks.forEach(({ timeout, resolve }) => {
      clearTimeout(timeout);
      resolve(false);
    });
    this.pendingAcks.clear();
  }

  private cleanupPendingAcks() {
    const now = Date.now();
    this.pendingAcks.forEach(({ timeout }, id) => {
      if (now - Number(id.split("-")[0]) > 30000) {
        // 30-second TTL
        clearTimeout(timeout);
        this.pendingAcks.delete(id);
      }
    });
  }

  async enqueueEvent(
    type: string,
    data: any,
    priority: number = 1
  ): Promise<void> {
    try {
      this.cleanupPendingAcks();

      if (this.eventQueue.length >= this.maxQueueSize) {
        this.eventQueue = this.eventQueue.filter(
          (event) => Date.now() - event.timestamp < 60000
        );
      }

      const event: WSEvent = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        data: {
          ...data,
          requireAck: type !== "ping",
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        },
        attempts: 0,
        timestamp: Date.now(),
        priority,
      };

      this.eventQueue.push(event);
      this.eventQueue.sort((a, b) => b.priority - a.priority);

      if (this.isConnected && !this.processingQueue) {
        await this.processQueue();
      }
    } catch (error) {
      console.error("Error enqueueing event");
      throw error;
    }
  }

  cleanup() {
    this.clearPendingAcks();
    this.eventEmitter.removeAllListeners();
    this.eventQueue = [];
    this.processingQueue = false;
  }

  // on(event: string, handler: (...args: any[]) => void) {
  //   this.eventEmitter.on(event, handler);
  // }

  // off(event: string, handler: (...args: any[]) => void) {
  //   this.eventEmitter.off(event, handler);
  // }

  emit(event: string, ...args: any[]): boolean {
    return this.eventEmitter.emit(event, ...args);
  }

  on(event: string, listerner: (...args: any[]) => void): this {
    this.eventEmitter.on(event, listerner);
    return this;
  }

  off(event: string, listerner: (...args: any[]) => void): this {
    this.eventEmitter.off(event, listerner);
    return this;
  }

  private async sendWithAck(data: any): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingAcks.delete(data.id);
        resolve(false);
        console.warn(`Ack timeout for ${data.type}`);
      }, 12000);

      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          const message = JSON.stringify({
            ...data,
            timestamp: Date.now(),
          });

          this.ws.send(message);
          this.pendingAcks.set(data.id, { timeout, resolve });
        } else {
          clearTimeout(timeout);
          resolve(false);
        }
      } catch (error) {
        clearTimeout(timeout);
        resolve(false);
      }
    });
  }

  private async processQueue() {
    if (!this.checkConnection()) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return;
    }

    //priority based processing
    this.eventQueue.sort((a, b) => {
      if (a.type.startsWith("call_")) return -1;
      if (b.type.startsWith("call_")) return -1;
      return b.priority - a.priority;
    });

    if (
      this.processingQueue ||
      this.eventQueue.length === 0 ||
      !this.isConnected
    ) {
      return;
    }

    this.processingQueue = true;

    while (this.eventQueue.length > 0 && this.isConnected) {
      const event = this.eventQueue[0];

      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          const success = await this.sendWithAck(event.data);

          if (success) {
            this.eventQueue.shift();
          } else {
            //to not increase attempts on connection issues
            if (this.ws.readyState !== WebSocket.OPEN) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
              continue;
            }

            if (event.attempts >= this.maxRetries) {
              this.eventQueue.shift();
            } else {
              event.attempts++;
              this.eventQueue.push(this.eventQueue.shift()!);
              await new Promise((resolve) =>
                setTimeout(resolve, this.retryDelay * event.attempts)
              );
            }
          }
        } else {
          break;
        }
      } catch (error) {
        console.error("Error processing event:", error);

        if (this.ws.readyState !== WebSocket.OPEN) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        if (event.attempts >= this.maxRetries) {
          this.eventQueue.shift();
        } else {
          event.attempts++;
          this.eventQueue.push(this.eventQueue.shift()!);
          await new Promise((resolve) =>
            setTimeout(resolve, this.retryDelay * event.attempts)
          );
        }
      }
    }

    this.processingQueue = false;
  }
}
