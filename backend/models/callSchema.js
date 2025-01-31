import mongoose, { Schema, Types } from "mongoose";
const { ObjectId } = Types;

const callSchema = new Schema(
  {
    initiator: { type: ObjectId, ref: "User", required: true },
    receiver: { type: ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["voice", "video"], required: true },
    status: {
      type: String,
      enum: ["missed", "completed", "rejected"],
      required: true,
    },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    duration: { type: Number },
    roomName: { type: String, required: true },
  },
  { timeStamps: true }
);

export default mongoose.model("Call", callSchema);
