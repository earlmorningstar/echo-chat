import { useState, useEffect } from "react";
import { CacheOptions } from "../types";
import { getCachedImage } from "../cacheUtils";

export const useCachedImage = (
  url: string | undefined,
  options: CacheOptions = {}
) => {
  const [cachedUrl, setCachedUrl] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!url) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const loadImage = async () => {
      try {
        setIsLoading(true);
        const cached = await getCachedImage(url, options);
        if (isMounted) {
          setCachedUrl(cached);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error ? err : new Error("Failed to load image")
          );
          setCachedUrl(url);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadImage();

    return () => {
      isMounted = false;
      if (cachedUrl && cachedUrl !== url) {
        URL.revokeObjectURL(cachedUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, options.token, options.forceRefresh]);

  return { cachedUrl, isLoading, error };
};
