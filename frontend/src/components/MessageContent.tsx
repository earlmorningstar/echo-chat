import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useCachedImage } from "../utils/imageCache";
import ImageViewer from "../chatAppPages/ImageViewer";
import { AttachFile } from "@mui/icons-material";
import { IoCloudDownloadOutline } from "react-icons/io5";
import { formatFileSize } from "../utils/fileUpload";
import { Message, AuthUser } from "../types";
import UserAvatar from "./UserAvatar";

interface ChatMessage extends Message {
  sender: AuthUser;
  status?: "sent" | "delivered" | "read";
  metadata?: {
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    fileUrl?: string;
  };
}

//MessageContent shows a skeleton placeholder while the blob is
// being fetched, then renders the full image in one paint.
const MessageContent: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const { token } = useAuth();
  const [showImageViewer, setShowImageViewer] = useState(false);
  const { cachedUrl, isLoading } = useCachedImage(message.content, {
    token: token || undefined,
  });

  switch (message.type) {
    case "image":
      const fullSizeUrl = message.metadata?.fileUrl || cachedUrl;
      return (
        <>
          <div className="image-container">
            {isLoading || !cachedUrl ? (
              // Skeleton shown while blob is downloading — prevents top-to-bottom paint
              <div className="image-skeleton" aria-label="Loading image..." />
            ) : (
              <img
                src={cachedUrl}
                alt={message.metadata?.fileName || "Shared image"}
                className="message-image"
                // Decode off the main thread so it paints in one frame
                decoding="async"
                onClick={() => setShowImageViewer(true)}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            )}
          </div>
          {showImageViewer && fullSizeUrl && (
            <ImageViewer
              imageUrl={fullSizeUrl}
              fileName={message.metadata?.fileName}
              onClose={() => setShowImageViewer(false)}
            />
          )}
        </>
      );

    case "file": {
      const fileUrl = `${message.content}?token=${token}`;
      return (
        <a
          href={fileUrl}
          download={message.metadata?.fileName}
          className="file-attachment"
        >
          <AttachFile />
          <span className="file-name">{message.metadata?.fileName}</span>
          <span className="file-size">
            {formatFileSize(message.metadata?.fileSize)}{" "}
            <IoCloudDownloadOutline size={16} />
          </span>
        </a>
      );
    }

    default:
      return <>{message.content}</>;
  }
};

// ChatWindow header avatar section — drop-in replacement for the
// inline <img> block in ChatWindow.tsx's friend-avatar div.
export const FriendAvatar: React.FC<{
  avatarUrl?: string | null;
  firstName: string;
  lastName: string;
  status?: string;
}> = ({ avatarUrl, firstName, lastName, status }) => (
  <div className="friend-avatar">
    <UserAvatar
      avatarUrl={avatarUrl}
      firstName={firstName}
      lastName={lastName}
      className="profile-image"
    />
    <span className={`status-indicator ${status || "offline"}`} />
  </div>
);

export default MessageContent;
