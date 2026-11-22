import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, Download, ShieldCheck, ShieldAlert, Shield, Inbox } from "lucide-react";
import { Link } from "react-router-dom";
import axios from "axios";

import "./DropPage.css";
import "./Transfer.css";
import SampleVideo from "./Sample_video.mp4";
import NavBar from "../components/NavBar";
import SiteFooter from "../components/SiteFooter";
import GestureDetector from "../components/GestureDetector";
import FileCard from "../components/FileCard";
import { API_URL, authHeaders, errorMessage } from "../lib/api";
import { categoryOf, formatSize, saveBlob, sha256Hex } from "../lib/files";

const POLL_MS = 4000;

const IntegrityBadge = ({ state }) => {
  if (state === "verified") {
    return <span className="integrity ok"><ShieldCheck size={16} /> Integrity verified (SHA-256 match)</span>;
  }
  if (state === "mismatch") {
    return <span className="integrity bad"><ShieldAlert size={16} /> Integrity check FAILED — the file changed in transit</span>;
  }
  return <span className="integrity skip"><Shield size={16} /> Integrity not checked here (needs HTTPS and a file under 200 MB)</span>;
};

const DropPage = ({ user, onLogout }) => {
  const [incoming, setIncoming] = useState({ count: 0, files: [] });
  // idle -> receiving -> received   (or error)
  const [phase, setPhase] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [received, setReceived] = useState(null); // { meta, blob, url, integrity }
  const busy = useRef(false);

  const loadIncoming = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/incoming`, { headers: authHeaders() });
      setIncoming({ count: data.count, files: data.files });
    } catch {
      // keep the last known state; a network blip should not clear the inbox
    }
  }, []);

  // Poll for waiting files while the page is open and idle
  useEffect(() => {
    if (phase !== "idle") return undefined;
    // Fetching from the server is syncing with an external system, which is what effects are for
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadIncoming();
    const timer = setInterval(loadIncoming, POLL_MS);
    return () => clearInterval(timer);
  }, [phase, loadIncoming]);

  useEffect(() => () => received?.url && URL.revokeObjectURL(received.url), [received]);

  const receive = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setPhase("receiving");
    setProgress(0);
    setMessage("Receiving…");

    try {
      const { data } = await axios.post(`${API_URL}/api/drop`, null, { headers: authHeaders() });
      if (!data.success) {
        setPhase("idle");
        setMessage(data.message || "No file is waiting for you");
        return;
      }

      const meta = data.file;
      setMessage(`Downloading ${meta.originalName} from ${meta.sender}…`);
      const response = await axios.get(`${API_URL}/api/files/${meta.id}/download`, {
        headers: authHeaders(),
        responseType: "blob",
        onDownloadProgress: (event) => setProgress(event.total ? event.loaded / event.total : 0)
      });

      const blob = new Blob([response.data], { type: meta.mimeType || "application/octet-stream" });
      setMessage("Verifying integrity…");
      const localHash = await sha256Hex(blob);
      const integrity = !localHash || !meta.sha256 ? "skipped" : localHash === meta.sha256 ? "verified" : "mismatch";

      setReceived({ meta, blob, url: URL.createObjectURL(blob), integrity });
      setPhase("received");
      setMessage("");
    } catch (error) {
      setPhase("error");
      setMessage(`Drop failed: ${errorMessage(error)}`);
    } finally {
      busy.current = false;
    }
  }, []);

  const handleGestureEvent = useCallback(
    (type) => {
      if (type === "drop" && phase === "idle" && incoming.count > 0) receive();
    },
    [phase, incoming.count, receive]
  );

  const close = () => {
    setReceived(null);
    setPhase("idle");
    setMessage("");
    setProgress(0);
  };

  const armed = phase === "idle" && incoming.count > 0;
  const next = incoming.files[0];
  const kind = received ? categoryOf(received.meta.mimeType, received.meta.originalName) : null;

  return (
    <>
      <NavBar isLoggedIn={Boolean(user)} onLogout={onLogout} />
      <video className="background-video" autoPlay loop muted playsInline>
        <source src={SampleVideo} type="video/mp4" />
      </video>
      <div className="background-overlay"></div>

      <GestureDetector
        onEvent={handleGestureEvent}
        armed={armed}
        armedText="Ready: make a fist, then open your hand to drop."
        idleText="Nothing waiting yet. The drop gesture is off until a file arrives."
        hint="DROP = fist → open hand"
      />

      <div className="drop-page-container">
        {phase !== "received" ? (
          <div className="drop-page-content transfer-card">
            <h1 className="drop-page-title">Drop Zone</h1>

            {incoming.count > 0 ? (
              <>
                <p className="drop-page-subtitle">
                  <Inbox size={18} className="inline-icon" />{" "}
                  {incoming.count === 1 ? "1 file is" : `${incoming.count} files are`} waiting for you
                </p>
                {next && (
                  <FileCard
                    name={next.originalName}
                    size={next.size}
                    mimeType={next.mimeType}
                    isFolder={next.isFolder}
                    note={`From ${next.sender}`}
                  />
                )}
                <p className="drop-page-subtitle">Make a <strong>DROP</strong> gesture to receive it</p>
              </>
            ) : (
              <div className="drop-zone-area">
                <ArrowDown className="drop-zone-icon" />
                <span className="drop-zone-text">Waiting for someone to send you a file…</span>
              </div>
            )}

            {phase === "receiving" && (
              <div className="transfer-status">
                <p>{message}</p>
                <div className="progress"><div style={{ width: `${Math.round(progress * 100)}%` }} /></div>
              </div>
            )}

            {phase === "error" && (
              <div className="transfer-status error">
                <p>{message}</p>
                <button type="button" className="transfer-btn" onClick={close}>OK</button>
              </div>
            )}

            {phase === "idle" && message && <p className="muted">{message}</p>}

            <div className="transfer-actions">
              {armed && (
                <button
                  type="button"
                  className="transfer-btn secondary"
                  onClick={receive}
                  title="Same transfer without the gesture (useful for comparison tests)"
                >
                  <Download size={16} /> Receive without gesture
                </button>
              )}
              <Link to="/home" className="transfer-link">Sending instead? Go to Send →</Link>
            </div>
          </div>
        ) : (
          <div className="drop-page-content transfer-card received-view">
            <h1 className="drop-page-title">Received</h1>
            <p className="drop-page-subtitle">From <strong>{received.meta.sender}</strong></p>

            {kind === "image" && <img src={received.url} alt={received.meta.originalName} className="preview-media" />}
            {kind === "video" && <video src={received.url} className="preview-media" controls playsInline />}
            {kind === "audio" && <audio src={received.url} controls className="preview-audio" />}
            {kind === "pdf" && <iframe src={received.url} title={received.meta.originalName} className="preview-frame" />}

            <FileCard
              name={received.meta.originalName}
              size={received.meta.size}
              mimeType={received.meta.mimeType}
              isFolder={received.meta.isFolder}
              note={received.meta.isFolder ? "Folder sent as a zip. Unzip it after saving." : null}
            />
            <IntegrityBadge state={received.integrity} />

            <div className="transfer-actions">
              <button
                type="button"
                className="transfer-btn primary"
                onClick={() => saveBlob(received.blob, received.meta.originalName)}
              >
                <Download size={16} /> Save {formatSize(received.meta.size)}
              </button>
              <button type="button" className="transfer-btn" onClick={close}>Close</button>
            </div>
          </div>
        )}
      </div>

      <SiteFooter />
    </>
  );
};

export default DropPage;
