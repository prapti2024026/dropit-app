import express from "express";
import cors from "cors";
import multer from "multer";
import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

import File from "./models/File.js";
import Logout from "./models/Logout.js";
import User from "./models/User.js";
import { deleteStored, openFile, saveFile } from "./storage.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
// Free MongoDB Atlas has 512 MB in total, so keep single files small there.
// On paid storage raise these with MAX_FILE_MB / RETENTION_DAYS in .env
const MAX_FILE_MB = Number(process.env.MAX_FILE_MB) || 50;
const MAX_FILE_SIZE = MAX_FILE_MB * 1024 * 1024;
const RETENTION_DAYS = Number(process.env.RETENTION_DAYS) || 7;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, "uploads"); // only used for files saved by older versions

// ---------- helpers ----------

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getFileCategory = (mimeType = "", name = "") => {
  const lower = name.toLowerCase();
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (
    mimeType.includes("pdf") ||
    mimeType.includes("document") ||
    mimeType.includes("word") ||
    mimeType.includes("sheet") ||
    mimeType.includes("presentation") ||
    mimeType.startsWith("text/")
  ) {
    return "document";
  }
  if (
    mimeType.includes("zip") ||
    mimeType.includes("rar") ||
    mimeType.includes("7z") ||
    mimeType.includes("tar") ||
    mimeType.includes("archive") ||
    /\.(zip|rar|7z|tar|gz)$/.test(lower)
  ) {
    return "archive";
  }
  return "other";
};

// SHA-256 of a file on disk, streamed so large files do not fill memory
const hashFile = (filePath) =>
  new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    fs.createReadStream(filePath)
      .on("error", reject)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", () => resolve(hash.digest("hex")));
  });

// Delete the stored bytes only when no history record still points to them
const removeStoredIfUnused = async (record) => {
  const remaining = await File.countDocuments({ filename: record.filename });
  if (remaining === 0) await deleteStored(record, uploadDir);
};

// Retention: free storage is small, so bytes are removed RETENTION_DAYS after delivery
// (or after upload, if nobody ever dropped the file). History rows stay, marked expired.
const cleanupExpired = async () => {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const old = await File.find({
    transferType: "send",
    expired: { $ne: true },
    $or: [
      { dropped: true, deliveredAt: { $lt: cutoff } },
      { dropped: { $ne: true }, uploadedAt: { $lt: cutoff } }
    ]
  });

  for (const record of old) {
    await deleteStored(record, uploadDir);
    await File.updateMany({ filename: record.filename }, { $set: { expired: true } });
  }
  if (old.length) console.log(`Retention cleanup: removed ${old.length} old files`);
};

const publicFile = (file) => ({
  id: file._id,
  originalName: file.originalName,
  mimeType: file.mimeType,
  size: file.size,
  fileCategory: file.fileCategory,
  isFolder: Boolean(file.isFolder),
  sha256: file.sha256 || null,
  expired: Boolean(file.expired),
  uploadedAt: file.uploadedAt
});

// RFC 5987 header so non-English file names download correctly
const contentDisposition = (name) => {
  const asciiFallback = name.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
};

// ---------- server ----------

const startServer = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    const jwtSecret = process.env.JWT_SECRET;

    if (!mongoUri) throw new Error("MONGODB_URI is not set in server/.env");
    if (!jwtSecret) throw new Error("JWT_SECRET is not set in server/.env");

    mongoose.set("bufferCommands", false);
    mongoose.connection.on("connected", () => console.log("MongoDB connected"));
    mongoose.connection.on("error", (err) => console.error("MongoDB connection error:", err.message || err));

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000
    });

    // One-time cleanup for uploads made before the waiting/delivered status existed.
    // Old versions never marked files as dropped, so without this every old upload
    // would suddenly appear in the receiver's inbox. (New uploads always have a sha256.)
    const migrated = await File.updateMany(
      { transferType: "send", dropped: { $ne: true }, sha256: { $exists: false } },
      { $set: { dropped: true } }
    );
    if (migrated.modifiedCount) {
      console.log(`Marked ${migrated.modifiedCount} older uploads as delivered`);
    }

    // Allowed front-end origins. Add more with CLIENT_ORIGIN=a,b,c in .env
    const clientOrigins = [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5174",
      "http://localhost:5175",
      "http://127.0.0.1:5175",
      "http://localhost:5176",
      "http://127.0.0.1:5176",
      "http://localhost:5177",
      "http://127.0.0.1:5177",
      "http://localhost:5178",
      "http://127.0.0.1:5178",
      "http://localhost:4173", // vite preview (PWA testing)
      "https://dropit69.netlify.app",
      // Capacitor native app shells (Android / iOS)
      "capacitor://localhost",
      "http://localhost",
      "https://localhost",
      ...(process.env.CLIENT_ORIGIN || "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
    ];

    app.use(
      cors({
        origin: clientOrigins,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization"],
        exposedHeaders: ["Content-Disposition", "Content-Length", "X-File-SHA256", "X-File-Name"]
      })
    );

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // NOTE: files are NOT served as a static folder.
    // They can only be fetched through the authenticated download route below.

    // Health check: used by Render, and by the app to wake a sleeping free server
    app.get("/api/health", (req, res) => {
      res.json({ ok: true, maxFileBytes: MAX_FILE_SIZE, retentionDays: RETENTION_DAYS });
    });

    const authenticate = (req, res, next) => {
      const header = req.headers.authorization || "";
      const token = header.startsWith("Bearer ") ? header.slice(7) : header;

      if (!token) return res.status(401).json({ message: "No token provided" });

      try {
        const decoded = jwt.verify(token, jwtSecret);
        req.userId = decoded.id;
        next();
      } catch {
        return res.status(401).json({ message: "Invalid token" });
      }
    };

    // Uploads land in the system temp folder first, then move into MongoDB (GridFS)
    const storage = multer.diskStorage({
      destination: (req, file, cb) => cb(null, os.tmpdir()),
      filename: (req, file, cb) => {
        // Random disk name; the real name is kept in the database
        const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 16);
        cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`);
      }
    });

    const upload = multer({
      storage,
      limits: { fileSize: MAX_FILE_SIZE },
      defParamCharset: "utf8" // keep Bangla and other non-English file names intact
    });

    // ---------- auth ----------

    app.post("/api/auth/register", async (req, res) => {
      try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
          return res.status(400).json({ error: "Username, email and password are required" });
        }

        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) return res.status(400).json({ error: "User already exists" });

        const user = new User({ username, email, password });
        await user.save();

        const token = jwt.sign({ id: user._id }, jwtSecret, { expiresIn: "7d" });
        res.json({ token, user: { id: user._id, username: user.username, email: user.email } });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post("/api/auth/login", async (req, res) => {
      try {
        const { username, password, usernameOrEmail } = req.body;
        const identifier = (usernameOrEmail || username || "").trim();
        const escapedIdentifier = escapeRegex(identifier);

        const user = await User.findOne({
          $or: [
            { username: new RegExp(`^${escapedIdentifier}$`, "i") },
            { email: new RegExp(`^${escapedIdentifier}$`, "i") }
          ]
        });

        if (!user) return res.status(400).json({ error: "Invalid credentials" });

        const isMatch = await user.comparePassword(password || "");
        if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

        const token = jwt.sign({ id: user._id }, jwtSecret, { expiresIn: "7d" });
        res.json({ token, user: { id: user._id, username: user.username, email: user.email } });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post("/api/auth/logout", authenticate, async (req, res) => {
      try {
        const user = await User.findById(req.userId);
        if (user) {
          await new Logout({
            userId: user._id,
            username: user.username,
            email: user.email,
            deviceInfo: req.headers["user-agent"]
          }).save();
        }
        res.json({ message: "Logged out successfully" });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get("/api/auth/verify", authenticate, async (req, res) => {
      try {
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json({ user: { id: user._id, username: user.username, email: user.email } });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get("/api/auth/user/:username", authenticate, async (req, res) => {
      try {
        const escapedUsername = escapeRegex(req.params.username);
        const user = await User.findOne({
          $or: [
            { username: new RegExp(`^${escapedUsername}$`, "i") },
            { email: new RegExp(`^${escapedUsername}$`, "i") }
          ]
        });
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json({ user: { id: user._id, username: user.username, email: user.email } });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // ---------- send (grab) ----------

    app.post("/api/upload", authenticate, (req, res) => {
      upload.single("file")(req, res, async (uploadError) => {
        if (uploadError) {
          const tooBig = uploadError.code === "LIMIT_FILE_SIZE";
          return res.status(tooBig ? 413 : 400).json({
            success: false,
            message: tooBig ? `File is larger than ${MAX_FILE_MB} MB` : uploadError.message
          });
        }

        if (!req.file) {
          return res.status(400).json({ success: false, message: "No file uploaded" });
        }

        const storedPath = req.file.path; // temporary file
        const discard = () => fs.existsSync(storedPath) && fs.unlinkSync(storedPath);

        try {
          const { exchangedWith, sha256: clientHash, isFolder } = req.body;

          if (!exchangedWith || !mongoose.Types.ObjectId.isValid(exchangedWith)) {
            discard();
            return res.status(400).json({ success: false, message: "A valid receiver is required" });
          }

          const receiver = await User.findById(exchangedWith).select("_id username");
          if (!receiver) {
            discard();
            return res.status(404).json({ success: false, message: "Receiver not found" });
          }

          // Integrity: the server's hash is the reference value.
          // If the browser also sent a hash, they must match, otherwise the upload was corrupted.
          const serverHash = await hashFile(storedPath);
          if (clientHash && clientHash.toLowerCase() !== serverHash) {
            discard();
            return res.status(422).json({
              success: false,
              message: "Integrity check failed: the uploaded file does not match the original. Please try again."
            });
          }

          const mimeType = req.file.mimetype || "application/octet-stream";
          const gridfsId = await saveFile(storedPath, {
            originalName: req.file.originalname,
            mimeType,
            ownerId: req.userId
          });
          discard(); // the temporary copy is no longer needed

          const file = await new File({
            filename: String(gridfsId),
            gridfsId,
            originalName: req.file.originalname,
            size: req.file.size,
            mimeType,
            userId: req.userId,
            receiverId: receiver._id,
            transferType: "send",
            fileCategory: getFileCategory(req.file.mimetype, req.file.originalname),
            exchangedWith: receiver._id.toString(),
            isFolder: isFolder === "true" || isFolder === true,
            sha256: serverHash,
            dropped: false
          }).save();

          res.json({
            success: true,
            message: `Waiting for ${receiver.username} to drop it`,
            file: { ...publicFile(file), receiver: receiver.username }
          });
        } catch (error) {
          discard();
          res.status(500).json({ success: false, message: error.message });
        }
      });
    });

    // ---------- receive (drop) ----------

    // Files waiting for the logged-in user. The Drop page polls this to show "incoming file from X".
    app.get("/api/incoming", authenticate, async (req, res) => {
      try {
        const pending = await File.find({
          receiverId: req.userId,
          transferType: "send",
          dropped: false,
          expired: { $ne: true }
        })
          .sort({ uploadedAt: 1 })
          .populate("userId", "username");

        res.json({
          count: pending.length,
          files: pending.map((file) => ({
            ...publicFile(file),
            sender: file.userId?.username || "Unknown"
          }))
        });
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });

    // Deliver the oldest waiting file exactly once.
    const dropHandler = async (req, res) => {
      try {
        // Old clients called /api/drop/:receiverId — only allow it for yourself
        if (req.params.receiverId && req.params.receiverId !== String(req.userId)) {
          return res.status(403).json({ success: false, message: "You can only receive your own files" });
        }

        // Atomic: two quick drop gestures can never deliver the same file twice
        const sent = await File.findOneAndUpdate(
          { receiverId: req.userId, transferType: "send", dropped: false, expired: { $ne: true } },
          { $set: { dropped: true, deliveredAt: new Date() } },
          { sort: { uploadedAt: 1 }, returnDocument: "after" }
        ).populate("userId", "username");

        if (!sent) {
          return res.json({ success: false, message: "No file is waiting for you" });
        }

        const received = await new File({
          filename: sent.filename,
          gridfsId: sent.gridfsId,
          originalName: sent.originalName,
          path: sent.path,
          size: sent.size,
          mimeType: sent.mimeType,
          userId: req.userId,                // receiver owns this history row
          receiverId: sent.userId._id,       // partner = sender
          transferType: "receive",
          fileCategory: sent.fileCategory,
          exchangedWith: sent.userId._id.toString(),
          isFolder: sent.isFolder,
          sha256: sent.sha256,
          sourceFileId: sent._id,
          dropped: true,
          deliveredAt: sent.deliveredAt
        }).save();

        res.json({
          success: true,
          file: { ...publicFile(received), sender: sent.userId?.username || "Unknown" }
        });
      } catch (error) {
        res.status(500).json({ success: false, message: error.message });
      }
    };

    app.post("/api/drop", authenticate, dropHandler);
    app.get("/api/drop", authenticate, dropHandler);
    app.get("/api/drop/:receiverId", authenticate, dropHandler);

    // ---------- history ----------

    // Each user only sees their own rows: "send" rows they created and "receive" rows they dropped
    app.get("/api/files", authenticate, async (req, res) => {
      try {
        const files = await File.find({ userId: req.userId })
          .sort({ uploadedAt: -1 })
          .populate("userId", "username email")
          .populate("receiverId", "username email");

        res.json({ files });
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });

    app.get("/api/files/:fileId/download", authenticate, async (req, res) => {
      try {
        const { fileId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(fileId)) {
          return res.status(400).json({ message: "Invalid file id" });
        }

        // Only the owner of the history row can download it
        const file = await File.findOne({ _id: fileId, userId: req.userId });
        if (!file) return res.status(404).json({ message: "File not found or access denied" });

        const stream = await openFile(file, uploadDir);
        if (!stream) {
          return file.expired
            ? res.status(410).json({ message: `This file was removed ${RETENTION_DAYS} days after delivery to save space` })
            : res.status(404).json({ message: "File not found on server" });
        }

        res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
        res.setHeader("Content-Disposition", contentDisposition(file.originalName));
        res.setHeader("Content-Length", file.size);
        res.setHeader("X-File-Name", encodeURIComponent(file.originalName));
        if (file.sha256) res.setHeader("X-File-SHA256", file.sha256);

        stream.on("error", () => {
          if (!res.headersSent) res.status(500).json({ message: "Error reading file" });
        });
        stream.pipe(res);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });

    // Delete a history row. Deleting a "send" row that is still waiting = cancel the transfer.
    app.delete("/api/files/:id", authenticate, async (req, res) => {
      try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
          return res.status(400).json({ message: "Invalid file id" });
        }

        const file = await File.findOne({ _id: id, userId: req.userId });
        if (!file) return res.status(404).json({ message: "File not found" });

        const wasPending = file.transferType === "send" && !file.dropped;

        await file.deleteOne();
        await removeStoredIfUnused(file);

        res.json({
          success: true,
          message: wasPending ? "Transfer cancelled" : "File deleted successfully"
        });
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });

    cleanupExpired().catch((error) => console.error("Retention cleanup failed:", error.message));
    setInterval(() => {
      cleanupExpired().catch((error) => console.error("Retention cleanup failed:", error.message));
    }, 60 * 60 * 1000);

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} (max file ${MAX_FILE_MB} MB, kept ${RETENTION_DAYS} days)`);
    });
  } catch (err) {
    console.error("Startup error:", err.message || err);
    process.exit(1);
  }
};

startServer();
