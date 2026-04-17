import React, { useState } from "react";
import { IoClose, IoCloudDownloadOutline } from "react-icons/io5";
import { useCachedImage } from "../utils/imageCache";
import { useAuth } from "../contexts/AuthContext";

interface ImageViewerProps {
  imageUrl: string;
  fileName?: string;
  onClose: () => void;
}

const ImageViewer: React.FC<ImageViewerProps> = ({
  imageUrl,
  fileName,
  onClose,
}) => {
  const { token } = useAuth();
  const { cachedUrl } = useCachedImage(imageUrl, {
    token: token || undefined,
  });
  const [isLoading, setIsLoading] = useState(true);
  const handleDownload = async (): Promise<void> => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName || "image";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading image:", error);
    }
  };

  return (
    <div className="image-viewer-overlay">
      <div className="image-viewer-container">
        <button onClick={onClose} className="image-viewer-button close-button">
          <IoClose size={24} />
        </button>
        <button
          onClick={handleDownload}
          className="image-viewer-button download-button"
        >
          <IoCloudDownloadOutline size={24} />
        </button>

        {isLoading && (
          <div className="loading-backdrop">
            <div className="loading-spinner"></div>
          </div>
        )}
        <img
          src={cachedUrl}
          alt={fileName || "Full size image"}
          className="image-viewer-image"
          onLoad={() => setIsLoading(false)}
        />
      </div>
    </div>
  );
};

export default ImageViewer;
