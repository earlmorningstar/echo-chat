import { CacheOptions } from "./types";
import { imageCache } from "./cacheStore";
import { CACHE_DURATION } from "./config";

export const getCachedImage = async (
  url: string,
  options: CacheOptions = {}
): Promise<string> => {
  const { token, forceRefresh } = options;
  const cacheKey = token ? `${url}?token=${token}` : url;

  const cachedData = imageCache.get(cacheKey);
  if (
    !forceRefresh &&
    cachedData &&
    Date.now() - cachedData.timestamp < CACHE_DURATION
  ) {
    return URL.createObjectURL(cachedData.blob);
  }

  try {
     const response = await fetch(cacheKey, {
      headers: token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {},
    });

   if (!response.ok) throw new Error("Failed to fetch image");

    const blob = await response.blob();

    imageCache.set(cacheKey, {
      blob,
      timestamp: Date.now(),
      token,
    });

    return URL.createObjectURL(blob);
  } catch (error) {
    throw error;
  }
};
