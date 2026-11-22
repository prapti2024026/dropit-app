import { Trash2, Download, FileText, Folder, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import "./HistoryPage.css";

import SampleVideo from "./Sample_video.mp4";
import NavBar from "../components/NavBar";
import SiteFooter from "../components/SiteFooter";
import { API_URL, authHeaders, errorMessage } from "../lib/api";
import { formatSize, saveBlob } from "../lib/files";

const STATUS = {
  waiting: { label: "Waiting", className: "pending" },
  delivered: { label: "Delivered", className: "completed" },
  received: { label: "Received", className: "completed" },
  expired: { label: "Expired", className: "failed" }
};

const HistoryTable = ({ data, title, typeColor, onDownload, onDelete, busyId }) => (
  <div className="history-section">
    <div className="section-header">
      <h2 className={`section-title ${typeColor}`}>{title}</h2>
      <span className="section-count">{data.length} files</span>
    </div>

    {data.length > 0 ? (
      <table className="history-table">
        <thead>
          <tr>
            <th>File Name</th>
            <th>Partner</th>
            <th>Size</th>
            <th>Date & Time</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {data.map((item) => (
            <tr key={item.id} className="history-row">
              <td className="file-name">
                {item.isFolder ? <Folder size={18} className="file-icon" /> : <FileText size={18} className="file-icon" />}
                <span>{item.fileName}</span>
              </td>
              <td>{item.partnerName}</td>
              <td>{item.size}</td>
              <td>
                <div className="date-time">
                  <div>{item.transferDate}</div>
                  <div className="time">{item.transferTime}</div>
                </div>
              </td>
              <td>
                <span className={`status-badge ${STATUS[item.status].className}`}>{STATUS[item.status].label}</span>
              </td>
              <td className="actions">
                <button
                  type="button"
                  className="action-btn download-btn"
                  onClick={() => onDownload(item)}
                  disabled={busyId === item.id || item.status === "expired"}
                  title={item.status === "expired" ? "Removed after the storage period" : "Download this file"}
                >
                  <Download size={18} />
                </button>
                <button
                  type="button"
                  className="action-btn delete-btn"
                  onClick={() => onDelete(item)}
                  title={item.status === "waiting" ? "Cancel this transfer" : "Delete from history"}
                >
                  {item.status === "waiting" ? <XCircle size={18} /> : <Trash2 size={18} />}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : (
      <div className="empty-state-section">
        <FileText size={36} />
        <p>No {title.toLowerCase()}</p>
      </div>
    )}
  </div>
);

const toRow = (file) => {
  const sent = file.transferType === "send";
  const date = new Date(file.uploadedAt);
  return {
    id: file._id,
    fileName: file.originalName,
    isFolder: Boolean(file.isFolder),
    size: formatSize(file.size),
    transferDate: date.toLocaleDateString(),
    transferTime: date.toLocaleTimeString(),
    direction: sent ? "uploaded" : "received",
    status: file.expired ? "expired" : sent ? (file.dropped ? "delivered" : "waiting") : "received",
    partnerName: file.receiverId?.username || "Unknown",
    originalName: file.originalName
  };
};

const HistoryPage = ({ user, onLogout }) => {
  const [rows, setRows] = useState([]);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/files`, { headers: authHeaders() });
      setRows(data.files.map(toRow));
    } catch (error) {
      console.error("Error fetching history:", error);
    }
  }, []);

  useEffect(() => {
    // Loading history from the server is syncing with an external system
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) load();
  }, [user, load]);

  const handleDelete = async (item) => {
    const question =
      item.status === "waiting"
        ? `Cancel sending "${item.fileName}"? The receiver will no longer be able to drop it.`
        : `Delete "${item.fileName}" from your history?`;
    if (!window.confirm(question)) return;

    try {
      await axios.delete(`${API_URL}/api/files/${item.id}`, { headers: authHeaders() });
      setRows((previous) => previous.filter((row) => row.id !== item.id));
    } catch (error) {
      alert(`Could not delete: ${errorMessage(error)}`);
    }
  };

  const handleDownload = async (item) => {
    setBusyId(item.id);
    try {
      const response = await axios.get(`${API_URL}/api/files/${item.id}/download`, {
        responseType: "blob",
        headers: authHeaders()
      });
      saveBlob(response.data, item.originalName || item.fileName);
    } catch (error) {
      alert(
        error?.response?.status === 410
          ? "This file was removed from storage some days after delivery."
          : `Download failed: ${errorMessage(error)}`
      );
    } finally {
      setBusyId(null);
    }
  };

  const uploadedFiles = rows.filter((row) => row.direction === "uploaded");
  const receivedFiles = rows.filter((row) => row.direction === "received");

  return (
    <>
      <NavBar isLoggedIn={Boolean(user)} onLogout={onLogout} />
      <video className="background-video" autoPlay loop muted playsInline>
        <source src={SampleVideo} type="video/mp4" />
      </video>
      <div className="background-overlay"></div>

      <div className="history-page-container">
        <div className="history-content">
          <div className="history-header">
            <h1 className="history-title">Transfer History</h1>
            <p className="history-subtitle">Files you sent and files you received</p>
          </div>

          <HistoryTable
            data={uploadedFiles}
            title="Sent Files"
            typeColor="uploaded"
            onDownload={handleDownload}
            onDelete={handleDelete}
            busyId={busyId}
          />
          <HistoryTable
            data={receivedFiles}
            title="Received Files"
            typeColor="received"
            onDownload={handleDownload}
            onDelete={handleDelete}
            busyId={busyId}
          />

          {rows.length === 0 && (
            <div className="empty-state">
              <FileText size={48} />
              <p>No transfer history yet</p>
              <span>Your file transfers will appear here</span>
            </div>
          )}
        </div>
      </div>

      <SiteFooter />
    </>
  );
};

export default HistoryPage;
