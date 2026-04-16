import mongoose from 'mongoose';

const uri = 'mongodb://localhost:27017/DropItDB';

const fileSchema = new mongoose.Schema({
  filename: String,
  originalName: String,
  path: String,
  size: Number,
  mimeType: String,
  userId: mongoose.Schema.Types.ObjectId,
  receiverId: mongoose.Schema.Types.ObjectId,
  transferType: String,
  fileCategory: String,
  exchangedWith: String,
  uploadedAt: Date,
  dropped: Boolean
});

const File = mongoose.model('TempFile', fileSchema, 'files');

const run = async () => {
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    const files = await File.find().limit(20).lean();
    console.log(JSON.stringify(files, null, 2));
  } catch (err) {
    console.error('ERR', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

run();
