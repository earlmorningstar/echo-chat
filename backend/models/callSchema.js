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

export default Call;
