import mongoose, { Schema, Types } from "mongoose";
const { ObjectId } = Types;

const callSchema = new Schema(
  {
    initiator: { type: ObjectId, ref: "User", required: true },
    receiver: { type: ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["voice", "video"], required: true },
    status: {
      type: String,
      enum: ["initiated", "missed", "completed", "rejected"],
      default: "initiated",
      required: true,
    },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    duration: { type: Number },
    roomName: { type: String, required: true },
  },
  {
    timestamps: true,
    bufferCommands: false,
  }
);

callSchema.index({ initiator: 1, receiver: 1 });
callSchema.index({ roomName: 1 }, { unique: true });

const Call = mongoose.model.Call || mongoose.model("Call", callSchema);

const ensureCollection = async () => {
  try {
    // Checking if collection exists
    const collections = await mongoose.connection.db
      .listCollections({ name: "calls" })
      .toArray();

    if (collections.length === 0) {
      // Collection doesn't exist, create it
      await mongoose.connection.db.createCollection("calls", {
        validator: {
          $jsonSchema: {
            bsonType: "object",
            required: ["initiator", "receiver", "type", "status", "roomName"],
            properties: {
              initiator: { bsonType: "objectId" },
              receiver: { bsonType: "objectId" },
              type: { enum: ["voice", "video"] },
              status: {
                enum: ["initiated", "missed", "completed", "rejected"],
              },
              roomName: { bsonType: "string" },
            },
          },
        },
      });

      // Create indexes after collection is created
      await Call.createIndexes();
      console.log(`Calls collection created with indexes`);
    }
  } catch (error) {
    console.error("Error ensuring calls collection");
    throw error;
  }
};

export { Call as default, ensureCollection };
