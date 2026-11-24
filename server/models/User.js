import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  // Public handle other people type to send you a file (lowercase, 3-20 chars)
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  // Accounts created with Google have no password until the owner sets one
  password: { type: String, required: function () { return !this.googleId; } },
  googleId: { type: String, unique: true, sparse: true },
  name: { type: String, trim: true },
  avatar: { type: String },
  authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
  emailVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  lastLoginAt: { type: Date }
});

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Method to compare passwords
userSchema.methods.comparePassword = function (candidatePassword) {
  return new Promise((resolve, reject) => {
    if (!this.password) return resolve(false); // Google-only account

    // Check if password is hashed (bcrypt hashes start with $)
    if (this.password.startsWith('$')) {
      bcrypt.compare(candidatePassword, this.password, (err, isMatch) => {
        if (err) return reject(err);
        resolve(isMatch);
      });
    } else {
      // Legacy account saved before hashing was added.
      // If the password matches, hash it now so it is never stored in plain text again.
      const isMatch = candidatePassword === this.password;
      if (!isMatch) return resolve(false);

      this.password = candidatePassword; // pre('save') hook hashes it
      this.save()
        .then(() => resolve(true))
        .catch(reject);
    }
  });
};

// What the app is allowed to see about a user
userSchema.methods.toPublic = function () {
  return {
    id: this._id,
    username: this.username,
    email: this.email,
    name: this.name || null,
    avatar: this.avatar || null,
    authProvider: this.authProvider || 'local',
    emailVerified: Boolean(this.emailVerified)
  };
};

const User = mongoose.model('User', userSchema);
export default User;
