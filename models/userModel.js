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
};

module.exports = userModel;
