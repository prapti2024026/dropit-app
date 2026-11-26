import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Cloud,
  Download,
  History,
  Inbox,
  Loader2,
  Send,
  Trash2,
  XCircle,
  Zap
} from "lucide-react";

import "./Transfer.css";
import "./HistoryPage.css";
import NavBar from "../components/NavBar";
import SiteFooter from "../components/SiteFooter";
import { fileKind } from "../lib/fileKind";
import { API_URL, authHeaders, errorMessage } from "../lib/api";
import { formatSize, saveBlob } from "../lib/files";

const STATUS = {
  waiting: { label: "Waiting for drop", className: "waiting", icon: Clock },
  delivered: { label: "Delivered", className: "ok", icon: CheckCircle2 },
  received: { label: "Received", className: "received", icon: CheckCircle2 },
  expired: { label: "Removed from server", className: "expired", icon: Clock }
};

const toRow = (file) => {
  const sent = file.transferType === "send";
  const direct = file.mode === "direct";
  const date = new Date(file.deliveredAt || file.uploadedAt);
  let status = sent ? (file.dropped ? "delivered" : "waiting") : "received";
  if (!direct && file.expired) status = "expired";
  return {
    id: file._id,
    name: file.originalName,
    mimeType: file.mimeType,
    isFolder: Boolean(file.isFolder),
    size: file.size,
    when: date,
    direction: sent ? "sent" : "received",
    direct,
    status,
    canDownload: !direct && !file.expired,
    partner: file.receiverId?.username || "Unknown"
  };
};

const sameDay = (a, b) => a.toDateString() === b.toDateString();
const whenText = (date) => {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (sameDay(date, now)) return `Today, ${time}`;
  if (sameDay(date, yesterday)) return `Yesterday, ${time}`;
  return `${date.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}, ${time}`;
};

const FILTERS = [
  { id: "all", label: "All" },
  { id: "sent", label: "Sent", icon: ArrowUpRight },
  { id: "received", label: "Received", icon: ArrowDownLeft }
];

const HistoryPage = ({ user, onLogout }) => {
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState("all");
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/files`, { headers: authHeaders() });
      setRows(data.files.map(toRow));
    } catch (error) {
      setRows([]);
      setNotice(`Could not load history: ${errorMessage(error)}`);
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
        ? `Cancel sending "${item.name}"? The receiver will no longer be able to drop it.`
        : `Remove "${item.name}" from your history?`;
    if (!window.confirm(question)) return;
    setBusyId(item.id);
    try {
      await axios.delete(`${API_URL}/api/files/${item.id}`, { headers: authHeaders() });
      setRows((previous) => previous.filter((row) => row.id !== item.id));
    } catch (error) {
      setNotice(`Could not remove it: ${errorMessage(error)}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleDownload = async (item) => {
    setBusyId(item.id);
    try {
      const response = await axios.get(`${API_URL}/api/files/${item.id}/download`, {
        responseType: "blob",
        headers: authHeaders()
      });
      saveBlob(response.data, item.name);
    } catch (error) {
      setNotice(
        error?.response?.status === 410
          ? "This file was removed from the server after its storage period."
          : `Download failed: ${errorMessage(error)}`
      );
    } finally {
      setBusyId(null);
    }
  };

  const stats = useMemo(() => {
    const list = rows || [];
    return {
      sent: list.filter((row) => row.direction === "sent").length,
      received: list.filter((row) => row.direction === "received").length,
      waiting: list.filter((row) => row.status === "waiting").length
    };
  }, [rows]);

  const visible = (rows || []).filter((row) => filter === "all" || row.direction === filter);

  return (
    <>
      <NavBar user={user} onLogout={onLogout} />

      <main className="app-page">
        <div className="page-head">
          <span className="icon-tile trail">
            <History />
          </span>
          <div>
            <h1>History</h1>
            <p>Everything you sent and received. Cancel anything that is still waiting.</p>
          </div>
        </div>

        <div className="stat-row">
          <div className="stat">
            <span className="icon-tile grab">
              <Send />
            </span>
            <div>
              <strong>{stats.sent}</strong>
              <span>Sent</span>
            </div>
          </div>
          <div className="stat">
            <span className="icon-tile drop">
              <Inbox />
            </span>
            <div>
              <strong>{stats.received}</strong>
              <span>Received</span>
            </div>
          </div>
          <div className="stat">
            <span className="icon-tile sun">
              <Clock />
            </span>
            <div>
              <strong>{stats.waiting}</strong>
              <span>Waiting for drop</span>
            </div>
          </div>
        </div>

        <section className="card">
          <div className="history-toolbar">
            <div className="segmented" role="tablist" aria-label="Filter history">
              {FILTERS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={filter === id}
                  className={filter === id ? "active" : ""}
                  onClick={() => setFilter(id)}
                >
                  {Icon && <Icon size={16} />} {label}
                </button>
              ))}
            </div>
            <span className="muted">
              {visible.length} {visible.length === 1 ? "item" : "items"}
            </span>
          </div>

          {notice && (
            <div className="status error" role="alert" style={{ marginTop: 0, marginBottom: 14 }}>
              {notice}
            </div>
          )}

          {rows === null ? (
            <div className="history-empty">
              <Loader2 className="spin" size={28} />
              <p>Loading…</p>
            </div>
          ) : visible.length === 0 ? (
            <div className="history-empty">
              <span className="icon-tile trail">
                <History />
              </span>
              <p>No transfers here yet.</p>
              <Link to="/home" className="btn btn-grab">
                <Send size={16} /> Send your first file
              </Link>
            </div>
          ) : (
            <ul className="history-list">
              {visible.map((item) => {
                const { icon: KindIcon, tone } = fileKind(item.mimeType, item.name, item.isFolder);
                const status = STATUS[item.status];
                const StatusIcon = status.icon;
                return (
                  <li key={item.id} className="history-item">
                    <span className={`icon-tile ${tone}`}>
                      <KindIcon />
                    </span>
                    <div className="history-main">
                      <div className="history-name" title={item.name}>
                        {item.name}
                      </div>
                      <div className="history-meta">
                        <span className={`direction ${item.direction}`}>
                          {item.direction === "sent" ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                          {item.direction === "sent" ? `To ${item.partner}` : `From ${item.partner}`}
                        </span>
                        <span>{formatSize(item.size)}</span>
                        <span>{whenText(item.when)}</span>
                      </div>
                    </div>
                    <div className="history-chips">
                      <span className={`chip ${status.className}`}>
                        <StatusIcon size={13} /> {status.label}
                      </span>
                      {item.direct ? (
                        <span className="chip direct" title="Sent device to device, never stored on the server">
                          <Zap size={13} /> Direct
                        </span>
                      ) : (
                        <span className="chip server">
                          <Cloud size={13} /> Server
                        </span>
                      )}
                    </div>
                    <div className="history-actions">
                      {item.canDownload && (
                        <button
                          type="button"
                          className="icon-btn download"
                          onClick={() => handleDownload(item)}
                          disabled={busyId === item.id}
                          aria-label={`Download ${item.name}`}
                          title="Download"
                        >
                          {busyId === item.id ? <Loader2 className="spin" size={18} /> : <Download size={18} />}
                        </button>
                      )}
                      <button
                        type="button"
                        className="icon-btn danger"
                        onClick={() => handleDelete(item)}
                        disabled={busyId === item.id}
                        aria-label={item.status === "waiting" ? `Cancel ${item.name}` : `Remove ${item.name}`}
                        title={item.status === "waiting" ? "Cancel this transfer" : "Remove from history"}
                      >
                        {item.status === "waiting" ? <XCircle size={18} /> : <Trash2 size={18} />}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>

      <SiteFooter />
    </>
  );
};

export default HistoryPage;
