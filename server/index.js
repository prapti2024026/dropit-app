import express from "express";
import cors from "cors";
import multer from "multer";
import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import Image from "./models/Image.js";
import File from "./models/File.js";
import Logout from "./models/Logout.js";
import User from "./models/User.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    const jwtSecret = process.env.JWT_SECRET;

    if (!mongoUri) {
      throw new Error('MONGODB_URI is not set in server/.env');
    }

    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not set in server/.env');
    }

    mongoose.set('bufferCommands', false);

    mongoose.connection.on('connected', () => {
      console.log('? MongoDB Connected');
    });

    mongoose.connection.on('error', (err) => {
      console.error('? MongoDB connection error:', err.message || err);
    });

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000
    });

    const clientOrigins = [
      'http://localhost:5174',
      'http://127.0.0.1:5174',
      'http://localhost:5175',
      'http://127.0.0.1:5175',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:5176',
      'http://127.0.0.1:5176',
      'http://localhost:5177',
      'http://127.0.0.1:5177',
      'http://localhost:5178',
      'http://127.0.0.1:5178',
      'https://dropit69.netlify.app'
    ];

    const corsOptions = {
      origin: clientOrigins,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization']
    };

    app.use(cors(corsOptions));

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const uploadDir = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }

    app.use("/uploads", express.static(uploadDir));

    const authenticate = (req, res, next) => {
      const token = req.headers.authorization;

      if (!token) {
        return res.status(401).json({ message: "No token provided" });
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.id;
        next();
      } catch (err) {
        return res.status(401).json({ message: "Invalid token" });
      }
    };

    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const unique = Date.now() + "-" + file.originalname;
        cb(null, unique);
      }
    });

    const upload = multer({
      storage,
      limits: {
        fileSize: 500 * 1024 * 1024 // 500MB limit
      }
    });

    const getFileCategory = (mimeType) => {
      if (mimeType.startsWith('image/')) return 'image';
      if (mimeType.startsWith('video/')) return 'video';
      if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('word') || mimeType.includes('sheet')) {
        return 'document';
      }
      if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) {
        return 'archive';
      }
      return 'other';
    };

    const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    app.post("/api/auth/register", async (req, res) => {
      try {
        const { username, email, password } = req.body;

        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
          return res.status(400).json({ error: "User already exists" });
        }

        const user = new User({ username, email, password });
        await user.save();

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.json({
          token,
          user: {
            id: user._id,
            username: user.username,
            email: user.email
          }
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post("/api/auth/login", async (req, res) => {
      try {
        const { username, password, usernameOrEmail } = req.body;
        const identifier = (usernameOrEmail || username || '').trim();
        const escapedIdentifier = escapeRegex(identifier);

        const user = await User.findOne({
          $or: [
            { username: new RegExp(`^${escapedIdentifier}$`, 'i') },
            { email: new RegExp(`^${escapedIdentifier}$`, 'i') }
          ]
        });

        if (!user) {
          return res.status(400).json({ error: "Invalid credentials" });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
          return res.status(400).json({ error: "Invalid credentials" });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.json({
          token,
          user: {
            id: user._id,
            username: user.username,
            email: user.email
          }
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post("/api/auth/logout", authenticate, async (req, res) => {
      try {
        const user = await User.findById(req.userId);
        if (user) {
          const logout = new Logout({
            userId: user._id,
            username: user.username,
            email: user.email,
            deviceInfo: req.headers['user-agent']
          });
          await logout.save();
        }
        res.json({ message: "Logged out successfully" });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get("/api/auth/verify", authenticate, async (req, res) => {
      try {
        const user = await User.findById(req.userId);
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }
        res.json({
          user: {
            id: user._id,
            username: user.username,
            email: user.email
          }
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get("/api/auth/user/:username", authenticate, async (req, res) => {
      try {
        const { username } = req.params;
        const escapedUsername = escapeRegex(username);
        const user = await User.findOne({
          $or: [
            { username: new RegExp(`^${escapedUsername}$`, 'i') },
            { email: new RegExp(`^${escapedUsername}$`, 'i') }
          ]
        });
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }
        res.json({
          user: {
            id: user._id,
            username: user.username,
            email: user.email
          }
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post("/api/upload", authenticate, upload.single("file"), async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ success: false, message: "No file uploaded" });
        }

        const { type, exchangedWith } = req.body;
        const filePath = `/uploads/${req.file.filename}`;
        const fileCategory = getFileCategory(req.file.mimetype);

        const file = new File({
          filename: req.file.filename,
          originalName: req.file.originalname,
          path: filePath,
          size: req.file.size,
          mimeType: req.file.mimetype,
          userId: req.userId,
          receiverId: new mongoose.Types.ObjectId(exchangedWith),
          transferType: type || 'send',
          fileCategory,
          exchangedWith
        });

        await file.save();
        res.json({ success: true, message: "File uploaded successfully", file });
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });

    app.get("/api/files", authenticate, async (req, res) => {
      try {
        const files = await File.find({
          $or: [
            { userId: req.userId },
            { receiverId: req.userId }
          ]
        })
          .sort({ uploadedAt: -1 })
          .populate('userId', 'username email')
          .populate('receiverId', 'username email');

        res.json({ files });
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });

    app.delete("/api/files/:id", authenticate, async (req, res) => {
      try {
        const { id } = req.params;
        const file = await File.findOne({
          _id: id,
          $or: [
            { userId: req.userId },
            { receiverId: req.userId }
          ]
        });

        if (!file) {
          return res.status(404).json({ message: 'File not found' });
        }

        const filePath = file.path && file.path.startsWith('/uploads/')
          ? path.join(__dirname, file.path)
          : path.join(uploadDir, file.filename);

        const fileName = file.filename;

        await file.deleteOne();

        const remaining = await File.countDocuments({ filename: fileName });
        if (remaining === 0 && fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }

        res.json({ success: true, message: 'File deleted successfully' });
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });

    app.get("/api/drop/:receiverId", authenticate, async (req, res) => {
      try {
        const { receiverId } = req.params;
        const file = await File.findOne({ receiverId: new mongoose.Types.ObjectId(receiverId), transferType: 'send' }).sort({ uploadedAt: -1 });
        if (!file) {
          return res.json({ success: false, message: "No file available" });
        }

        const imagePath = file.path && file.path.startsWith("/uploads/")
          ? file.path
          : `/uploads/${file.filename}`;

        // 🔥 CREATE A HISTORY RECORD WHEN IMAGE IS RECEIVED
        try {
          const receivedFile = new File({
            filename: file.filename,
            originalName: file.originalName,
            path: file.path,
            size: file.size,
            mimeType: file.mimeType,
            userId: new mongoose.Types.ObjectId(receiverId), // receiver becomes the user in history
            receiverId: file.userId, // sender becomes the receiver field
            transferType: 'receive', // mark as received
            fileCategory: file.fileCategory,
            exchangedWith: file.userId.toString(),
            uploadedAt: new Date()
          });
          await receivedFile.save();
        } catch (historyError) {
          console.log('Note: Could not save receive history, but image was delivered:', historyError.message);
        }

        res.json({ success: true, imagePath });
      } catch (error) {
        res.status(500).json({ success: false, message: error.message });
      }
    });

    app.listen(PORT, () => {
      console.log(`?? Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("? DB Error:", err.message || err);
    process.exit(1);
  }
};

startServer();
