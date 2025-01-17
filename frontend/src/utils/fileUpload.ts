import api from "./api";
import { API_BASE_URL } from "./config";

interface UploadResponse {
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export const uploadFile = async (
  formData: FormData
): Promise<UploadResponse> => {
  const response = await api.post(`${API_BASE_URL}/api/uploads/upload`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

export const formatFileSize = (bytes?: number): string => {
  if (!bytes) return "0 B";

  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};
