// File storage for DropIt.
//
// Files are kept inside MongoDB using GridFS, not on the server's disk.
// Free hosting (e.g. Render free) wipes the disk on every restart, but the database survives,
// so storing files there keeps them safe until they are delivered.
//
// Older records created before this change point to server/uploads on disk; those still work locally.
import fs from "fs";
import path from "path";
import mongoose from "mongoose";

const BUCKET = "dropitFiles";

const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: BUCKET });

const toObjectId = (id) => (id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(String(id)));

// Copy a temporary upload into GridFS. Returns the new GridFS id.
export const saveFile = (tmpPath, { originalName, mimeType, ownerId }) =>
  new Promise((resolve, reject) => {
    const upload = bucket().openUploadStream(originalName, {
      metadata: { mimeType, ownerId: String(ownerId) }
    });
    fs.createReadStream(tmpPath)
      .on("error", reject)
      .pipe(upload)
      .on("error", reject)
      .on("finish", () => resolve(upload.id));
  });

// Readable stream of a stored file, or null if it no longer exists
export const openFile = async (record, legacyDir) => {
  if (record.gridfsId) {
    const found = await bucket().find({ _id: toObjectId(record.gridfsId) }).limit(1).toArray();
    return found.length ? bucket().openDownloadStream(toObjectId(record.gridfsId)) : null;
  }
  // Legacy: file saved on the server's disk by older versions
  const diskPath = path.join(legacyDir, path.basename(record.filename || ""));
  return record.filename && fs.existsSync(diskPath) ? fs.createReadStream(diskPath) : null;
};

export const deleteStored = async (record, legacyDir) => {
  if (record.gridfsId) {
    try {
      await bucket().delete(toObjectId(record.gridfsId));
    } catch (error) {
      if (!/FileNotFound|not found/i.test(error.message)) throw error;
    }
    return;
  }
  const diskPath = path.join(legacyDir, path.basename(record.filename || ""));
  if (record.filename && fs.existsSync(diskPath)) fs.unlinkSync(diskPath);
};

// Total bytes currently stored in GridFS (used to stay inside the free 512 MB database)
export const storedBytes = async () => {
  const [row] = await mongoose.connection.db
    .collection(`${BUCKET}.files`)
    .aggregate([{ $group: { _id: null, total: { $sum: "$length" } } }])
    .toArray();
  return row?.total || 0;
};
