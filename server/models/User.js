import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Hash password before saving
userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;

  const hash = await bcrypt.hash(this.password, 10);
  this.password = hash;
});

// Method to compare passwords
userSchema.methods.comparePassword = function(candidatePassword) {
  return new Promise((resolve, reject) => {
    // Check if password is hashed (bcrypt hashes start with $)
    if (this.password.startsWith('$')) {
      bcrypt.compare(candidatePassword, this.password, (err, isMatch) => {
        if (err) return reject(err);
        resolve(isMatch);
      });
    } else {
      // Plain text password (for existing users)
      resolve(candidatePassword === this.password);
    }
  });
};

const User = mongoose.model('User', userSchema);
export default User;