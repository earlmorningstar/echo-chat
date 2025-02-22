export class RateLimiter {
    constructor(maxRequestsPerMinute = 60) {
      this.clients = new Map();
      this.maxRequests = maxRequestsPerMinute;
      this.interval = 60000;
    }
  
    initializeClient(clientId) {
      this.clients.set(clientId, {
        requests: 0,
        lastReset: Date.now(),
      });
    }
  
    removeClient(clientId) {
      this.clients.delete(clientId);
    }
  
    checkLimit(clientId) {
      const client = this.clients.get(clientId);
      if (!client) return false;
  
      const now = Date.now();
      if (now - client.lastReset >= this.interval) {
        client.requests = 0;
        client.lastReset = now;
      }
  
      if (client.requests >= this.maxRequests) {
        return false;
      }
  
      client.requests++;
      return true;
    }
  }
  
  export const createRequestPool = (maxConcurrent) => {
    const pool = {
      maxConcurrent,
      current: 0,
      queue: [],
    };
  
    return {
      async execute(fn) {
        if (pool.current >= pool.maxConcurrent) {
          await new Promise((resolve) => pool.queue.push(resolve));
        }
        pool.current++;
        try {
          return await fn();
        } finally {
          pool.current--;
          if (pool.queue.length > 0) {
            const next = pool.queue.shift();
            next();
          }
        }
      },
    };
  };
  