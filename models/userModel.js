const { ObjectId } = require('mongodb');

const userModel = {
    createUser: async (db, userData) => {
        const result = await db.collection('users').insertOne(userData);
        return result.ops[0]; // Return the newly created user
    },
};

module.exports = userModel;
