import { MongoClient } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("MONGODB_URI is not defineed in the .env file");
}
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

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

export { connectToDatabase, client };
