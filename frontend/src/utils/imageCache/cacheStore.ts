import { CacheEntry } from "./types";
import { CACHE_DURATION } from "./config";

class ImageCacheStore {
    private cache: Map<string, CacheEntry>;
  
    constructor() {
      this.cache = new Map();
    }
  
    get(key: string): CacheEntry | undefined {
      return this.cache.get(key);
    }
  
    set(key: string, entry: CacheEntry): void {
      this.cache.set(key, entry);
    }
  
    delete(key: string): void {
      this.cache.delete(key);
    }
  
    cleanup(): void {
      const now = Date.now();
      for (const [key, value] of this.cache.entries()) {
        if (now - value.timestamp > CACHE_DURATION) {
          URL.revokeObjectURL(URL.createObjectURL(value.blob));
          this.delete(key);
        }
      }
    }
  }
  
  export const imageCache = new ImageCacheStore();