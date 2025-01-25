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
     sendError(res, 500, "Error uploading file", { error: error.message });
  }
};

//to serve files
const serveFile = async (req, res) => {
  try {
    const fileId = req.params.fileId;
    const token = req.query.token;

    if (!token) {
      // Attempt to serve file without strict token validation
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
        "Content-Disposition": `inline; filename="${
          file.metadata.originalname || file.fileName
        }"`,
        "Cache-Control": "no-cache",
      });

      return bucket.openDownloadStream(new ObjectId(fileId)).pipe(res);
    }

    // Existing token validation logic remains
    try {
      const cleanToken = token.split("?")[0];
      jwt.verify(cleanToken, process.env.JWT_SECRET);
    } catch (error) {
      console.error("Token Verification Error:", error);
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
      "Content-Disposition": `inline; filename="${
        file.metadata.originalname || file.fileName
      }"`,
      "Cache-Control": "no-cache",
    });

    bucket.openDownloadStream(new ObjectId(fileId)).pipe(res);
  } catch (error) {
    console.error("Error serving file:", error);
    if (!res.headersSent) {
      sendError(res, 500, "Error retrieving file", { error: error.message });
    }
  }
};

export { handleFileUpload, serveFile };
