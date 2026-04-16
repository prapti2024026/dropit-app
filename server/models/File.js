import mongoose from "mongoose";

const fileSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  path: { type: String, required: true },
  size: { type: Number, required: true },
  mimeType: { type: String, required: true }, // e.g., image/png, application/pdf, video/mp4

  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },

  receiverId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User"
  },

  transferType: { 
    type: String, 
    enum: ["send", "receive"], 
    required: true 
  },

  fileCategory: {
    type: String,
    enum: ["image", "video", "document", "archive", "other"],
    required: true
  },

  exchangedWith: { type: String },

  uploadedAt: { type: Date, default: Date.now },

  dropped: { type: Boolean, default: false }
});

export default mongoose.model("File", fileSchema);
