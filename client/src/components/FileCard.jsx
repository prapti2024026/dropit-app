import { File as FileIcon, FileArchive, FileAudio, FileImage, FileText, FileVideo, Folder } from "lucide-react";
import { categoryOf, formatSize } from "../lib/files";

const ICONS = {
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
  pdf: FileText,
  text: FileText,
  document: FileText,
  archive: FileArchive,
  other: FileIcon
};

// Compact card for any file type: icon, name, size, and an optional note
const FileCard = ({ name, size, mimeType, isFolder, note }) => {
  const Icon = isFolder ? Folder : ICONS[categoryOf(mimeType, name)] || FileIcon;
  return (
    <div className="file-card">
      <Icon className="file-card-icon" />
      <div className="file-card-body">
        <div className="file-card-name" title={name}>{name}</div>
        <div className="file-card-meta">
          {formatSize(size)}
          {isFolder ? " · folder (zip)" : mimeType ? ` · ${mimeType}` : ""}
        </div>
        {note && <div className="file-card-note">{note}</div>}
      </div>
    </div>
  );
};

export default FileCard;
