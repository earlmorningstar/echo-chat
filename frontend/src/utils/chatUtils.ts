export const formatLastSeen = (lastSeen: string | Date | undefined) => {
  if (!lastSeen) return "Offline";

  const lastSeenDate = new Date(lastSeen);
  const now = new Date();
  const diffInSeconds = Math.floor(
    (now.getTime() - lastSeenDate.getTime()) / 1000
  );

  if (diffInSeconds < 60) return "last seen just now";
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `last seen ${minutes === 1 ? "a minute" : `${minutes} minutes`} ago`;
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `last seen ${hours === 1 ? "an hour" : `${hours} hours`} ago`;
  }
  if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `last seen ${days === 1 ? "a day" : `${days} days`} ago`;
  }

  return `last seen on ${lastSeenDate.toLocaleDateString()}`;
};
