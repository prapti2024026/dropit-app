import mongoose from "mongoose";

const fileSchema = new mongoose.Schema({
  filename: { type: String, required: true },      // storage key: GridFS id (new) or disk name in server/uploads (old records)
  originalName: { type: String, required: true },  // name shown to users
  path: { type: String },                          // kept for older records; files are NOT served publicly
  gridfsId: { type: mongoose.Schema.Types.ObjectId }, // where the bytes live in MongoDB (GridFS bucket "dropitFiles")
  size: { type: Number, required: true },
  mimeType: { type: String, required: true },      // e.g. image/png, application/pdf, application/zip

  // Owner of this history record (sender for "send" rows, receiver for "receive" rows)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  // The other person in the transfer
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
    enum: ["image", "video", "audio", "document", "archive", "other"],
    required: true
  },

  exchangedWith: { type: String },

  // True when the user picked a folder; the browser zipped it before upload
  isFolder: { type: Boolean, default: false },

  // "server": bytes stored in GridFS until dropped. "direct": streamed browser-to-browser (never stored here)
  mode: { type: String, enum: ["server", "direct"], default: "server" },

  // SHA-256 of the file contents (hex), computed by the server after upload
  sha256: { type: String },

  // For "receive" rows: the "send" row this delivery came from
  sourceFileId: { type: mongoose.Schema.Types.ObjectId, ref: "File" },

  uploadedAt: { type: Date, default: Date.now },

  // True once the stored bytes were removed by the retention cleanup (history row is kept)
  expired: { type: Boolean, default: false },

  // For "send" rows: false = waiting for the receiver's drop gesture, true = delivered
  dropped: { type: Boolean, default: false },
  deliveredAt: { type: Date }
});

fileSchema.index({ receiverId: 1, transferType: 1, dropped: 1, uploadedAt: 1 });
fileSchema.index({ userId: 1, uploadedAt: -1 });

export default mongoose.model("File", fileSchema);
