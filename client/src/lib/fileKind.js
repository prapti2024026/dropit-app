import { File as FileIcon, FileArchive, FileAudio, FileImage, FileText, FileVideo, Folder } from "lucide-react";
import { categoryOf } from "./files";

// Icon and tile colour for each kind of file (tones match .icon-tile classes in index.css)
const KINDS = {
  image: { icon: FileImage, tone: "sky" },
  video: { icon: FileVideo, tone: "grab" },
  audio: { icon: FileAudio, tone: "trail" },
  pdf: { icon: FileText, tone: "grab" },
  text: { icon: FileText, tone: "sky" },
  document: { icon: FileText, tone: "sky" },
  archive: { icon: FileArchive, tone: "sun" },
  other: { icon: FileIcon, tone: "trail" }
};

export const fileKind = (mimeType, name, isFolder) =>
  isFolder ? { icon: Folder, tone: "sun" } : KINDS[categoryOf(mimeType, name)] || KINDS.other;
