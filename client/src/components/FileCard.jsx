import { formatSize } from "../lib/files";
import { fileKind } from "../lib/fileKind";

// Compact card for any file type: coloured icon, name, size, and an optional note or badge
const FileCard = ({ name, size, mimeType, isFolder, note, badge }) => {
  const { icon: Icon, tone } = fileKind(mimeType, name, isFolder);
  return (
    <div className="file-card">
      <span className={`icon-tile ${tone}`}>
        <Icon />
      </span>
      <div className="file-card-body">
        <div className="file-card-name" title={name}>
          {name}
        </div>
        <div className="file-card-meta">
          {formatSize(size)}
          {isFolder ? " · folder (zip)" : ""}
        </div>
        {note && <div className="file-card-note">{note}</div>}
      </div>
      {badge}
    </div>
  );
};

export default FileCard;
