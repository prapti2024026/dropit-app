import JSZip from "jszip";
import { createSHA256 } from "hash-wasm";

// Must match the server's MAX_FILE_MB (200 MB by default)
export const MAX_UPLOAD_BYTES = (Number(import.meta.env.VITE_MAX_FILE_MB) || 200) * 1024 * 1024;
// Files are hashed in pieces of this size, so even large videos never sit in memory twice
const HASH_CHUNK_BYTES = 8 * 1024 * 1024;

export const formatSize = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
};

export const categoryOf = (mimeType = "", name = "") => {
  const lower = name.toLowerCase();
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "application/pdf" || lower.endsWith(".pdf")) return "pdf";
  if (mimeType.startsWith("text/") || /\.(txt|md|csv|json|log)$/.test(lower)) return "text";
  if (/zip|rar|7z|tar|gzip/.test(mimeType) || /\.(zip|rar|7z|tar|gz)$/.test(lower)) return "archive";
  if (/word|document|sheet|excel|presentation|powerpoint/.test(mimeType)) return "document";
  return "other";
};

// SHA-256 in the browser, read in 8 MB pieces (works for big videos on phones too).
// onProgress(0..1) is optional. Returns null if hashing is not possible on this device.
export const sha256Hex = async (blob, onProgress) => {
  try {
    const hasher = await createSHA256();
    hasher.init();
    for (let offset = 0; offset < blob.size; offset += HASH_CHUNK_BYTES) {
      const piece = await blob.slice(offset, offset + HASH_CHUNK_BYTES).arrayBuffer();
      hasher.update(new Uint8Array(piece));
      onProgress?.(Math.min(1, (offset + HASH_CHUNK_BYTES) / blob.size));
    }
    return hasher.digest("hex");
  } catch (error) {
    console.warn("SHA-256 not available:", error);
    return null;
  }
};

// Zip the files chosen with <input webkitdirectory>, keeping the folder structure
export const zipFolder = async (fileList, onProgress) => {
  const files = Array.from(fileList);
  if (files.length === 0) return null;

  const folderName = files[0].webkitRelativePath?.split("/")[0] || "folder";
  const zip = new JSZip();
  files.forEach((file) => zip.file(file.webkitRelativePath || file.name, file));

  const blob = await zip.generateAsync(
    { type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } },
    (meta) => onProgress?.(meta.percent / 100)
  );

  return {
    file: new File([blob], `${folderName}.zip`, { type: "application/zip" }),
    folderName,
    count: files.length
  };
};

// Save a Blob to the device with its original name
export const saveBlob = (blob, name) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 1000);
};
