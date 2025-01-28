import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { sendError, sendSuccess } from "../utils/response.js";

const renewToken = async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return sendError(res, 401, "No token provided");
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      ignoreExpiration: false,
    });

    const user = await req.db.collection("users").findOne({
      _id: new ObjectId(decoded.userId),
    });

    if (!user) {
      return sendError(res, 401, "User not found");
    }

    // Generate new token with same payload in loginUser
    const newToken = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isVerified: user.isVerified,
        avatarUrl: user.avatarUrl,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    return sendSuccess(res, 200, "Token renewed", { token: newToken });
  } catch (error) {
    return sendError(res, 500, "Server error during token renewal");
  }
};

const authenticateUser = async (req, res, next) => {
  let token = req.headers.authorization?.split(" ")[1] || req.query.token;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await req.db.collection("users").findOne({
      _id: new ObjectId(decoded.userId),
    });

    if (!user) {
      return sendError(res, 401, "User not found");
    }

    req.user = user;
    req.userId = decoded.userId;
    next();
  } catch {
    sendError(res, 401, "Unauthorized");
  }
};

export { renewToken, authenticateUser };
