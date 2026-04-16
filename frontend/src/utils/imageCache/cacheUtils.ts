import { CacheOptions } from "./types";
import { imageCache } from "./cacheStore";
import { CACHE_DURATION, API_BASE_URL } from "./config";

const resolveUrl = (url: string): string => {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_BASE_URL}${url}`;
};

export const getCachedImage = async (
  url: string,
  options: CacheOptions = {}
): Promise<string> => {
  const { token, forceRefresh } = options;

  const resolvedUrl = resolveUrl(url);
  const cacheKey = token ? `${resolvedUrl}?token=${token}` : resolvedUrl;
  const fetchUrl = token ? `${resolvedUrl}?token=${token}` : resolvedUrl;

  const cachedData = imageCache.get(cacheKey);
  if (
    !forceRefresh &&
    cachedData &&
    Date.now() - cachedData.timestamp < CACHE_DURATION
  ) {
    return URL.createObjectURL(cachedData.blob);
  }

  const response = await fetch(fetchUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);

  const blob = await response.blob();

  imageCache.set(cacheKey, {
    blob,
    timestamp: Date.now(),
    token,
  });

  return URL.createObjectURL(blob);
};