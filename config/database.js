const { MongoClient } = require("mongodb");
require("dotenv").config(); 

const uri = process.env.MONGODB_URI; 
const client = new MongoClient(uri);

async function connectToDatabase() {
  try {
    await client.connect();
    console.log("Connected successfully to MongoDB");
    return client.db("javascriptforpractice"); 
  } catch (error) {
    console.error("Failed to connect to MongoDB", error);
    process.exit(1); 
  }
}

module.exports = { connectToDatabase, client };
