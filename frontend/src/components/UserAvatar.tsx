import React, { useState } from "react";
import { API_BASE_URL } from "../utils/imageCache/config";

interface UserAvatarProps {
  avatarUrl?: string | null;
  firstName: string;
  lastName: string;
  size?: number;
  className?: string;
}

const resolveAvatarUrl = (url?: string | null): string | null => {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_BASE_URL}${url}`;
};

const UserAvatar: React.FC<UserAvatarProps> = ({
  avatarUrl,
  firstName,
  lastName,
  className = "profile-image",
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const resolvedUrl = resolveAvatarUrl(avatarUrl);
  const showImage = resolvedUrl && !imgFailed;

  if (showImage) {
    return (
      <img
        src={resolvedUrl}
        alt={`${firstName}'s profile`}
        className={className}
        // Load the full image before painting (no bit-by-bit top-to-bottom reveal).
        // `decoding="async"` hands decoding off to a background thread so the UI
        // doesn't stutter, while the image still appears in one paint once ready.
        decoding="async"
        // If the image URL is broken (e.g. old absolute URL in DB),
        // fall through to the initials avatar silently — no broken image icon.
        onError={() => setImgFailed(true)}
      />
    );
  }

  // Initials fallback — already styled via .default-avatar in CSS
  return (
    <div className="default-avatar">
      {firstName?.[0]?.toUpperCase()}
      {lastName?.[0]?.toUpperCase()}
    </div>
  );
};

export default UserAvatar;
