import { GridFSBucket, ObjectId } from "mongodb";
import { uploadToGridFS } from "../config/storage.js";
import jwt from "jsonwebtoken";
import { sendError, sendSuccess } from "../utils/response.js";

const getMessageType = (mimetype) => {
  //check to see if it's an image
  if (mimetype.startsWith("image/")) {
    return "image";
  }
  return "file";
};

const handleFileUpload = async (req, res) => {
  try {
    if (!req.file) {
      return sendError(res, 400, "No file uploaded");
    }

    const fileData = await uploadToGridFS(req.file, req.db);

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    //create file url
    const fileUrl = `${baseUrl}/api/uploads/files/${fileData.fileId}`;

    //determine type based on mime
    const messageType = getMessageType(req.file.mimetype);

    sendSuccess(res, 200, "File uploaded successfully", {
      fileUrl,
      fileId: fileData.fileId,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      type: messageType,
    });
  } catch (error) {
    console.error("File upload error:", error);
    sendError(res, 500, "Error uploading file", { error: error.message });
  }
};

//to serve files
const serveFile = async (req, res) => {
  try {
    const fileId = req.params.fileId;
    const token = req.query.token;

    if (!token) {
      return sendError(res, 401, "Unauthorized access");
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.userId = decoded.userId;
    } catch (error) {
      return sendError(res, 401, "Invalid or expired token");
    }

    if (!ObjectId.isValid(fileId)) {
      return sendError(res, 400, "Invalid file ID format");
    }

    const bucket = new GridFSBucket(req.db);

    const file = await req.db
      .collection("fs.files")
      .findOne({ _id: new ObjectId(fileId) });

    if (!file) {
      return sendError(res, 404, "File not found");
    }

    res.set({
      "Content-Type": file.metadata.minetype || file.contentType,
      "Content-Length": file.length,
      "Content-Dsiposition": `inline; filename="${
        file.metadata.originalname || file.fileName
      }"`,
      "Cache-Control": "no-cache",
    });

    //stream file to response
    bucket.openDownloadStream(new ObjectId(fileId)).pipe(res);
  } catch (error) {
    console.error("Error serving file:", error);
    if (!res.headersSent) {
      sendError(res, 500, "Error retreiving file", { error: error.message });
    }
  }
};

export { handleFileUpload, serveFile };
