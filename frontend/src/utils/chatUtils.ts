export const formatLastSeen = (lastSeen: string | Date | undefined) => {
  if (!lastSeen) return "Offline";

  const lastSeenDate = new Date(lastSeen);
  const now = new Date();
  const diffInSeconds = Math.floor(
    (now.getTime() - lastSeenDate.getTime()) / 1000
  );

  if (diffInSeconds < 60) return "last seen just now";
  if (diffInSeconds < 3600)
    return `last seen ${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400)
    return `last seen ${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 604800)
    return `last seen ${Math.floor(diffInSeconds / 86400)} days ago`;

  return `last seen on ${lastSeenDate.toLocaleDateString()}`;
};
