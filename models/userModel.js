const bcrypt = require("bcrypt");

const userModel = {
  createUser: async (db, userData) => {
    const hashedPassword = await bcrypt.hash(userData.password, 10); 
    userData.password = hashedPassword; 
    try {
      const result = await db.collection("users").insertOne(userData);
      return {
        id: result.insertedId,
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
      }; 
    } catch (error) {
      console.error("Error creating user:", error);
      throw new Error("Failed to create user");
    }
  },

  findUserByEmail: async (db, email) => {
    try {
      const user = await db.collection("users").findOne({ email });
      return user;
    } catch (error) {
      console.error("Error finding user:", error);
      throw new Error("Failed to find user");
    }
  },

  setPasswordResetToken: async (db, email, resetToken) => {
    try {
      await db.collection("users").updateOne(
        { email },
        { $set: { resetToken, resetTokenExpiry: Date.now() + 3600000 } }
      );
    } catch (error) {
      console.error("Error setting password reset token:", error);
      throw new Error("Failed to set password reset token");
    }
  },

  findUserByResetToken: async (db, token) => {
    try {
      const user = await db.collection("users").findOne({
        resetToken: token,
        resetTokenExpiry: { $gt: Date.now() },
      });
      return user;
    } catch (error) {
      console.error("Error finding user by reset token:", error);
      throw new Error("Failed to find user by reset token");
    }
  },

  updateUserPassword: async (db, email, hashedPassword) => {
    try {
      await db.collection("users").updateOne(
        { email },
        { $set: { password: hashedPassword }, $unset: { resetToken: "", resetTokenExpiry: "" } }
      );
    } catch (error) {
      console.error("Error updating user password:", error);
      throw new Error("Failed to update password");
    }
  }
};

module.exports = userModel;
