import multer from "multer";
import { GridFSBucket } from "mongodb";
import { v4 as uuidv4 } from "uuid";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  },
});

//uploading file to gridfs
const uploadToGridFS = async (file, db) => {
  const bucket = new GridFSBucket(db);
  const fileName = `${uuidv4()}-${file.originalname}`;

  //upload stream
  const uploadStream = bucket.openUploadStream(fileName, {
    contentType: file.mimetype,
    metadata: {
      originalname: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    },
  });

  //upload fille
  return new Promise((resolve, reject) => {
    uploadStream.end(file.buffer, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve({
          fileId: uploadStream.id,
          fileName: fileName,
        });
      }
    });
  });
};

export { upload, uploadToGridFS };
