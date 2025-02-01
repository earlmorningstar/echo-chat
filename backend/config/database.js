import mongoose from "mongoose";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("MONGODB_URI is not defined in the .env file");
}

const DB_NAME = "javascriptforpractice";

const connectionOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 30000,
};

const connectToDatabase = async () => {
  try {
    // Connect using MongoClient for native MongoDB operations
    const client = new MongoClient(uri, connectionOptions);
    await client.connect();

    // Connect to the specific database
    const db = client.db(DB_NAME);

    // Ensure we're connecting Mongoose to the same database
    const mongooseUri = uri.includes(DB_NAME) ? uri : `${uri}/${DB_NAME}`;

    // Close any existing Mongoose connections
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }

    // Connect Mongoose to the specific database
    await mongoose.connect(mongooseUri, {
      ...connectionOptions,
      dbName: DB_NAME,
    });

    console.log(`Connected successfully to MongoDB database: ${DB_NAME}`);

    // Set up event listeners on mongoose connection
    mongoose.connection.on("error", () => {
      console.error("MongoDB connection error");
    });

    mongoose.connection.on("disconnected", () => {
      console.log("MongoDB disconnected.");
    });

    mongoose.connection.on("reconnected", () => {
      console.log("MongoDB reconnected");
    });

    return db;
  } catch (error) {
    console.error("MongoDB connection error");
    throw error;
  }
};

const disconnectFromDatabase = async () => {
  try {
    await mongoose.connection.close();
    console.log("Disconnected from MongoDB");
  } catch (error) {
    console.error("Error disconnecting from MongoDB");
  }
};

export { connectToDatabase, disconnectFromDatabase };
