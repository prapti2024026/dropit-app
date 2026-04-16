import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
import User from './models/User.js';

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const users = await User.find().limit(20).select('username email createdAt');
    console.log(JSON.stringify(users, null, 2));
  } catch (err) {
    console.error('ERROR', err);
  } finally {
    await mongoose.disconnect();
  }
})();
