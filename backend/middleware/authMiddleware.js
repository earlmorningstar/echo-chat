import jwt from "jsonwebtoken";

const authenticateUser = (req, res, next) => {
  let token = req.headers.authorization?.split(" ")[1] || req.query.token;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized access" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

export default authenticateUser;
