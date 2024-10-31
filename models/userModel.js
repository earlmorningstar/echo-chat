const userModel = {
  // Create a new user in the 'users' collection
  createUser: async (db, userData) => {
    try {
      const result = await db.collection("users").insertOne(userData);
      return { id: result.insertedId, email: userData.email }; // Only return the id and email, not password
    } catch (error) {
      console.error("Error creating user:", error);
      throw new Error("Failed to create user");
    }
  },

  // Finding a user by email
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
