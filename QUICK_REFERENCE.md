# 🚀 DropIt - Quick Reference Card

## 📋 Setup Checklist

```
BEFORE STARTING:
☐ Install Node.js (if not already installed)
☐ Have MongoDB Atlas account ready
☐ Have code editor open (VS Code recommended)

STEP 1 - DATABASE (5 min)
☐ Go to mongodb.com/cloud/atlas
☐ Create free account
☐ Create M0 cluster (512MB free)
☐ Create database user
☐ Get connection string
☐ Allow 0.0.0.0/0 network access

STEP 2 - SERVER CONFIG (5 min)
☐ In server/ folder create .env file
☐ Add MONGODB_URI (from Atlas)
☐ Add JWT_SECRET (generate random)
☐ Check .env.example as reference
☐ Save file

STEP 3 - START SERVER (2 min)
☐ Open terminal in server/ folder
☐ Run: npm install
☐ Run: node index.js
☐ See "✅ MongoDB Connected"

STEP 4 - START CLIENT (2 min)
☐ Open NEW terminal in client/ folder
☐ Run: npm install
☐ Run: npm run dev
☐ Open http://localhost:5173

STEP 5 - TEST (5 min)
☐ Sign up with email/password
☐ Upload a file
☐ Check login/logout works
☐ Verify file in database
☐ Done! ✅
```

---

## 🔑 Key Commands

### Server
```bash
cd server
npm install          # Install dependencies
node index.js       # Start server
```

### Client
```bash
cd client
npm install         # Install dependencies
npm run dev        # Start dev server
npm run build      # Build for production
```

---

## 📁 Important Files

| File | Purpose |
|------|---------|
| `server/.env` | **YOU MUST CREATE THIS** - Put MongoDB credentials |
| `client/.env.local` | Already created - API URL configuration |
| `server/index.js` | Main server file with all routes |
| `server/models/File.js` | File upload model (supports all types) |
| `server/models/Logout.js` | Tracks user logouts |

---

## 🌍 URLs

| Service | URL |
|---------|-----|
| **Frontend** | http://localhost:5173 |
| **Backend** | http://localhost:5000 |
| **API** | http://localhost:5000/api/* |
| **MongoDB Atlas** | https://cloud.mongodb.com |

---

## 🔐 Security Tokens

**Get JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Example .env file:**
```
MONGODB_URI=mongodb+srv://user:pass@cluster0.abc.mongodb.net/DropItDB?retryWrites=true&w=majority
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
PORT=5000
CLIENT_ORIGIN=http://localhost:5173
```

---

## 🎯 Features Implemented

✅ Multi-file type support (500MB limit)
✅ Automatic file categorization
✅ Login with email OR username
✅ Logout database tracking
✅ JWT authentication
✅ Protected file operations
✅ Environment-based API URLs
✅ CORS security
✅ Gesture detection (UI ready)

---

## 🚀 Deploy Online (Optional)

| Step | Service | Time |
|------|---------|------|
| 1. Database | MongoDB Atlas (free) | 5 min |
| 2. Backend | Railway.app | 5 min |
| 3. Frontend | Vercel.com | 5 min |
| **Total** | | **15 min** |

See `DEPLOYMENT_GUIDE.md` for details

---

## 📞 Troubleshooting

| Problem | Solution |
|---------|----------|
| "Cannot connect to MongoDB" | Check .env MONGODB_URI, allow network access to Atlas |
| "Port 5000 in use" | Kill process or use different port |
| "Cannot find module" | Run `npm install` in that folder |
| "API connection failed" | Make sure server is running on port 5000 |
| "Logout not working" | Check token is valid, server is running |
| ".env file not working" | Restart server after creating/editing .env |
| "VITE_API_URL not found" | Check .env.local exists in client/ folder |

---

## 🗄️ Database Collections

### users
- email, username, password (hashed)

### files
- filename, originalName, path, size
- mimeType (e.g., "video/mp4")
- fileCategory (image, video, document, archive, other)
- userId, exchangedWith, uploadedAt, dropped

### logouts
- userId, username, email, logoutTime, deviceInfo

---

## 🔗 API Endpoints Quick List

```
Authentication:
  POST   /api/auth/register
  POST   /api/auth/login
  POST   /api/auth/logout        ← NEW

File Operations:
  POST   /api/upload
  GET    /api/history
  GET    /drop/:receiverId
  DELETE /api/files/:id

All file operations require authentication token
```

---

## ⚡ File Type Support

| Type | Examples | Max Size |
|------|----------|----------|
| Images | PNG, JPG, GIF, WebP | 500MB |
| Videos | MP4, MKV, MOV, AVI | 500MB |
| Documents | PDF, DOCX, XLSX, PPTX | 500MB |
| Archives | ZIP, RAR, 7Z, TAR | 500MB |
| Other | Any file format | 500MB |

---

## 📚 Documentation Guide

Start with **START_HERE.md** then read:
1. `SETUP_GUIDE.md` - Complete instructions
2. `MONGODB_SETUP.md` - Database help
3. `DEPLOYMENT_GUIDE.md` - Going online
4. `COMPLETE_SUMMARY.md` - Technical details
5. `CHANGE_LOG.md` - What was changed

---

## ✅ Success Indicators

You know it's working when:
- ✅ Server console shows "✅ MongoDB Connected"
- ✅ Client loads at http://localhost:5173
- ✅ Can register and login
- ✅ Can upload files
- ✅ Logout records in database
- ✅ Redirect on protected routes works

---

## 💾 Important: Create .env File!

**Location:** `server/.env`
**Content:**
```
MONGODB_URI=your_mongo_connection_string
JWT_SECRET=generate_from_command_above
PORT=5000
CLIENT_ORIGIN=http://localhost:5173
```

Without this file, the server won't work!

---

**Ready? Start with Step 1 in the checklist above! 🚀**
