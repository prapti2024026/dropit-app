import JSZip from "jszip";

// Must match the server's MAX_FILE_MB (50 MB on the free MongoDB storage)
export const MAX_UPLOAD_BYTES = (Number(import.meta.env.VITE_MAX_FILE_MB) || 50) * 1024 * 1024;
// Hashing reads the whole file into memory, so very large files rely on the server hash only
export const MAX_HASH_BYTES = 200 * 1024 * 1024;

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

// SHA-256 in the browser. Returns null when not possible (no HTTPS, or file too large).
export const sha256Hex = async (blob) => {
  if (!window.crypto?.subtle || blob.size > MAX_HASH_BYTES) return null;
  const buffer = await blob.arrayBuffer();
  const digest = await window.crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
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
