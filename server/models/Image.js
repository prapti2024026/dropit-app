import mongoose from "mongoose";

const imageSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  path: { type: String, required: true },
  size: { type: Number, required: true },

  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },

  receiverId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User"
  },

  type: { 
    type: String, 
    enum: ["send", "receive"], 
    required: true 
  },

  exchangedWith: { type: String },

  uploadedAt: { type: Date, default: Date.now },

  dropped: { type: Boolean, default: false }
});

export default mongoose.model("Image", imageSchema);