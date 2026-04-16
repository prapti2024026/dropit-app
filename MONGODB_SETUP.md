# 📊 MongoDB Atlas Setup Guide

## ✨ Get Free Database Online in 5 Minutes

### Step 1: Create MongoDB Atlas Account
1. Go to https://www.mongodb.com/cloud/atlas
2. Click **"Sign Up"** (or **"Try Free"**)
3. Fill in email and password
4. Verify your email

### Step 2: Create a Cluster
1. Click **"Create"** on the dashboard
2. Choose **"FREE"** tier (M0 - 512MB storage)
3. Select **"AWS"** as provider
4. Choose a region closest to you
5. Click **"Create"**
6. Wait 2-3 minutes for cluster to be ready ⏳

### Step 3: Get Connection String
1. Click **"Connect"** button
2. Choose **"Drivers"** tab  
3. Select **"Node.js"** and version **4.0 or later**
4. Copy the connection string:
   ```
   mongodb+srv://username:password@cluster.mongodb.net/myDatabase?retryWrites=true&w=majority
   ```

### Step 4: Create Database User
1. On **"Drivers"** page, find **"Connection String"**
2. Click **"Create a Database User"** (if not done)
3. Username: `myuser` (or your choice)
4. Password: `mySecurePassword123` (or your password)
5. Click **"Autogenerate Secure Password"** (recommended)
6. Save these credentials!

### Step 5: Allow Network Access
1. Go to **"Network Access"** → **"IP Whitelist"**
2. Click **"Add IP Address"**
3. Click **"Allow Access from Anywhere"** (for development)
4. Click **"Confirm"**
5. For production, add only your server's IP

### Step 6: Add Connection String to Server

Create `.env` file in `server/` folder:
```
MONGODB_URI=mongodb+srv://myuser:mySecurePassword123@cluster0.abc123.mongodb.net/DropItDB?retryWrites=true&w=majority
JWT_SECRET=your_random_secret_key_here
PORT=5000
CLIENT_ORIGIN=http://localhost:5173
```

**Replace:**
- `myuser` with your username
- `mySecurePassword123` with your password
- `cluster0.abc123` with your actual cluster details

### Step 7: Test Connection
Run server:
```bash
cd server
npm install
node index.js
```

If you see in console:
```
✅ MongoDB connected successfully!
Server running on port 5000
```
✅ **Success!** Database is connected

---

## 📋 Troubleshooting

### "Connection refused"
- ✅ Check username/password in connection string
- ✅ Make sure IP whitelist includes your IP
- ✅ Click "Ping" in testing interface

### "Authentication failed"
- ✅ Verify exact password (copy/paste)
- ✅ Check for special characters (@, :, etc.)
- ✅ Consider resetting password

### "Cluster not ready"
- ⏳ Wait 5-10 minutes after creation
- ✅ Check cluster status in Atlas dashboard

### "ENOTFOUND cluster0"
- ✅ Ensure internet connection is working
- ✅ Check `MONGODB_URI` is correct
- ✅ No typos in domain name

---

## 🎯 Free Tier Limits

- **Storage:** 512 MB (plenty for testing)
- **RAM:** Shared
- **Data Transfer:** Unlimited within AWS region
- **Databases:** Unlimited
- **Collections:** Unlimited

**Upgrades:** Paid clusters start at ~$57/month for 2GB

---

## 📊 Monitor Your Database

1. Go to **"Collections"** tab on Atlas
2. View all stored data:
   - `users` → See all registered accounts
   - `files` → See all uploaded files with mimeType and fileCategory
   - `logouts` → See when users logged out (timestamp, device)

### Checking Logout Records
```javascript
// In MongoDB Atlas or MongoDB Compass:
db.logouts.find({}).pretty()

// Shows:
{
  _id: ObjectId(...),
  userId: "user123",
  username: "john",
  email: "john@example.com",
  logoutTime: ISODate("2024-01-15T10:30:00Z"),
  deviceInfo: "Mozilla/5.0...",
}
```

---

## 🔒 Security Best Practices

### For Development
✅ OK to use "Allow from Anywhere" (0.0.0.0/0)
✅ Start with weak passwords (since it's local)
✅ No sensitive data in test database

### For Production  
⚠️ **MUST have:**
- ✅ Whitelist only your server's IP
- ✅ Strong passwords (30+ characters)
- ✅ Environment variables stored securely
- ✅ Consider database encryption (paid tier)
- ✅ Regular backups enabled

---

## 💰 Cost Estimate

**With MongoDB Atlas Free Tier + Railway Backend:**
- MongoDB Atlas: **$0/month** (free tier, 512MB)
- Railway Backend: **$5-10/month** (pay as you go)
- Vercel Frontend: **$0/month** (free tier)
- **Total: ~$5-10/month** for production

---

## 🚀 Next Steps

1. ✅ Create MongoDB Atlas account
2. ✅ Create free cluster  
3. ✅ Get connection string
4. ✅ Add to server `.env`
5. ✅ Test server connection
6. ✅ Deploy everything to Railway/Vercel

**You now have a real online database!** 🎉
