const mongoose = require('mongoose');

const uri = 'mongodb://localhost:27017/DropItDB';

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  createdAt: Date
});

const User = mongoose.model('User', userSchema, 'users');

async function run() {
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    const users = await User.find().limit(20).lean();
    console.log('USERS:');
    users.forEach(user => {
      console.log(`- Username: ${user.username}, Email: ${user.email}, Created: ${user.createdAt}`);
    });
  } catch (err) {
    console.error('ERR', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

run();