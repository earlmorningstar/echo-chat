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
  private eventQueue: WSEvent[] = [];
  private processingQueue: boolean = false;
  private eventEmitter = new EventEmitter();
  private ws: WebSocket;
  private maxRetries: number = 3;
  private retryDelay: number = 1000;
  public isConnected: boolean = false;
  private readonly maxQueueSize = 100;
  private pendingAcks = new Map<
    string,
    { timeout: NodeJS.Timeout; resolve: (value: boolean) => void }
  >();

  constructor(ws: WebSocket) {
    this.ws = ws;
    this.eventEmitter = new EventEmitter();
    this.eventEmitter.setMaxListeners(20);

    this.isConnected = ws.readyState === WebSocket.OPEN;

    ws.addEventListener("open", this.handleConnectionOpen.bind(this));
    ws.addEventListener("close", this.handleConnectionClose.bind(this));
    ws.addEventListener("message", this.handleIncomingMessage.bind(this));
    ws.addEventListener("error", this.handleConnectionError.bind(this));
  }

  private handleConnectionOpen() {
    this.isConnected = true;
    this.processQueue().catch((error) => {
      console.error("Error processing queue after connection");
    });
  }

  private handleConnectionClose() {
    this.isConnected = false;
    this.clearPendingAcks();
  }

  private handleConnectionError(error: Event) {
    console.error("WebSocket connection error");
    this.isConnected = false;
    this.clearPendingAcks();
  }

  private handleIncomingMessage(event: MessageEvent) {
    try {
      const message = JSON.parse(event.data);

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
      console.error("Error handling incoming message");
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
    this.isConnected = false;
  }

  on(event: string, handler: (...args: any[]) => void) {
    this.eventEmitter.on(event, handler);
  }

  off(event: string, handler: (...args: any[]) => void) {
    this.eventEmitter.off(event, handler);
  }

  private async sendWithAck(data: any): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingAcks.delete(data.id);
        resolve(false);
        console.warn(`Ack timeout for ${data.type}`);
      }, 3000);

      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify(data));
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
