// config/db.js
const { MongoClient } = require('mongodb');
require('dotenv').config(); // Load environment variables

const uri = process.env.MONGODB_URI; // Retrieve URI from environment variables
const client = new MongoClient(uri);

async function connectToDatabase() {
    try {
        await client.connect();
        console.log("Connected successfully to MongoDB");
        return client.db("javascriptforpractice"); // replace "chatApp" with your actual database name
    } catch (error) {
        console.error("Failed to connect to MongoDB", error);
        process.exit(1); // exit on connection failure
    }
}

module.exports = { connectToDatabase, client };
