import { imageCache } from "./cacheStore";
import { CACHE_DURATION } from "./config";

export { useCachedImage } from "./hooks/useCachedImage";
export { getCachedImage } from "./cacheUtils";
export type { CacheOptions } from "./types";

setInterval(() => {
  imageCache.cleanup();
}, CACHE_DURATION);
