# DropIt - Complete Setup Guide

## ✅ 1. SUPPORT MULTIPLE FILE TYPES (COMPLETED)

### What was changed:
- Created new `File` model (File.js) with support for all file types
- Added `fileCategory` field (image, video, document, archive, other)
- Added `mimeType` field to track file type
- Increased file upload limit to 500MB
- Created `getFileCategory()` helper function
- Updated upload, history, and drop routes to use the File model

### Supported File Types:
- **Images**: PNG, JPG, GIF, WebP, BMP
- **Videos**: MP4, MKV, AVI, MOV, WebM
- **Documents**: PDF, DOCX, XLSX, PPTX, TXT
- **Archives**: ZIP, RAR, 7Z, TAR
- **Other**: Any file up to 500MB

---

## ✅ 2. LOGOUT TRACKING (COMPLETED)

### What was added:
- Created `Logout` model to store logout records
- New endpoint: `POST /api/auth/logout`
- Tracks: userId, username, email, logout time, device info

### How to implement on client (Add to Login.jsx or NavBar.jsx):

```javascript
const handleLogout = async () => {
  const token = localStorage.getItem('token');
  
  try {
    await axios.post('http://localhost:5000/api/auth/logout', {}, {
      headers: { Authorization: token }
    });
    
    localStorage.removeItem('token');
    setUser(null);
    navigate('/');
  } catch (error) {
    console.error('Logout error:', error);
  }
};
```

---

## 📱 3. DEPLOYING ONLINE (MANDATORY FOR PRODUCTION)

### **Step A: Deploy Backend (Node.js Server)**

#### Option 1: **Railway.app** (Easiest - Recommended)
1. Sign up at https://railway.app
2. Connect your GitHub repository
3. Create new project → Select "Deploy from GitHub"
4. Railway auto-detects Node.js and installs dependencies
5. Set environment variables:
   ```
   MONGODB_URI=your_mongo_connection_string
   JWT_SECRET=your_jwt_secret
   PORT=5000
   ```
6. Railway gives you a public URL like: `https://yourdomain-production.up.railway.app`

#### Option 2: **Render.com**
1. Sign up at https://render.com
2. Create new "Web Service"
3. Connect GitHub repo
4. Set build command: `npm install`
5. Set start command: `node index.js`
6. Add same environment variables above

#### Option 3: **Heroku** (Free tier discontinued, uses credits)
1. Sign up at https://www.heroku.com
2. Install Heroku CLI
3. Run: `heroku login` and follow prompts
4. In server folder: `heroku create your-app-name`
5. Set env vars: `heroku config:set MONGODB_URI=...`
6. Deploy: `git push heroku main`

---

### **Step B: Deploy Frontend (React App)**

#### Option 1: **Vercel** (Easiest - Recommended)
1. Sign up at https://vercel.com (or login with GitHub)
2. Click "New Project"
3. Import your GitHub repo
4. Vercel auto-detects it's a Vite project
5. In Build Settings:
   - Framework: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
6. Add Environment Variables:
   ```
   VITE_API_URL=https://your-backend-railway-url.com
   VITE_RECEIVER_ID=id2
   ```
7. Click Deploy

#### Option 2: **Netlify**
1. Sign up at https://netlify.com
2. Click "Add new site" → "Import an existing project"
3. Select GitHub repo
4. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
5. Add environment variables in site settings
6. Deploy

#### Option 3: **GitHub Pages** (Free but limited)
1. Update `vite.config.js`:
   ```javascript
   export default defineConfig({
     base: '/DropIt/', // if using github.io/DropIt
     plugins: [react(), tailwindcss()],
   })
   ```
2. Add to `package.json` scripts:
   ```json
   "deploy": "npm run build && gh-pages -d dist"
   ```
3. Install: `npm install --save-dev gh-pages`
4. Run: `npm run deploy`

---

### **Step C: Update Client API URLs**

After deployment, update all hardcoded URLs in your client:

In `client/src/pages/HomePage.jsx`, `DropPage.jsx`, `HistoryPage.jsx`:
```javascript
// OLD (Development)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// The above now uses your .env file:
// VITE_API_URL=https://your-deployed-backend.com
```

In `client/src/components/Login.jsx`:
```javascript
// Change this line:
const res = await axios.post(
  `http://localhost:5000${endpoint}`,  // ❌ OLD
  payload
);

// To this:
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const res = await axios.post(
  `${API_URL}${endpoint}`,  // ✅ NEW
  payload
);
```

---

## 🔒 4. MANDATORY LOGIN ON BOTH DEVICES (ALREADY IMPLEMENTED)

Your system already has this protection:

✅ **Backend enforces authentication:**
- Upload route: `app.post("/api/upload", authenticate, ...)`
- History route: `app.get("/api/history", authenticate, ...)`
- Drop route: `app.get("/drop/:receiverId", authenticate, ...)`
- Logout route: `app.post("/api/auth/logout", authenticate, ...)`

✅ **Frontend checks login:**
- Protected routes redirect to `/` if not logged in
- Token is required for all API calls
- File transfers only work between authenticated users

✅ **How it works:**
1. User A logs in on Device 1 → Get JWT token
2. User B logs in on Device 2 → Get their JWT token
3. User A uploads file for User B using `exchangedWith: userId_B`
4. User B can only receive file by authenticating with their token
5. File is transferred only to User B's account

---

## 📋 CHECKLIST FOR GOING ONLINE

- [ ] **Backend**: Choose hosting (Railway/Render/Heroku)
- [ ] **Database**: MongoDB Atlas cluster created
- [ ] **Frontend**: Choose hosting (Vercel/Netlify)
- [ ] **Environment Variables**: Set in both backend and frontend
- [ ] **Update API_URL**: Change all hardcoded localhost URLs
- [ ] **Test Login**: Verify authentication works online
- [ ] **Test File Upload**: Upload a file and check if it's stored
- [ ] **Test File Transfer**: Share between two accounts
- [ ] **Enable HTTPS**: All cloud providers provide FREE HTTPS
- [ ] **Enable CORS**: Updated in server for your domain

---

## 🚀 QUICK START SEQUENCE

1. **Backend - Railway Deploy** (5 minutes)
2. **Frontend - Vercel Deploy** (5 minutes)
3. **Update API URLs** in client (2 minutes)
4. **Test the app** (5 minutes)

**Total: ~15 minutes to go online**

---

## 💾 DATABASE URLS YOU'LL NEED

Get from MongoDB Atlas:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/myDatabase?retryWrites=true&w=majority
```

---

Would you like me to help you deploy to any of these platforms? Just let me know which one you prefer!
