export interface CacheOptions {
    token?: string;
    forceRefresh?: boolean;
  }
  
  export interface CacheEntry {
    blob: Blob;
    timestamp: number;
    token?: string;
  }