import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeft,
  ArrowDownToLine,
  Cloud,
  Download,
  Hand,
  Inbox,
  Loader2,
  PackageCheck,
  Shield,
  ShieldAlert,
  ShieldCheck,
  X,
  Zap
} from "lucide-react";

import "./Transfer.css";
import NavBar from "../components/NavBar";
import SiteFooter from "../components/SiteFooter";
import GestureDetector from "../components/GestureDetector";
import FileCard from "../components/FileCard";
import { API_URL, authHeaders, errorMessage } from "../lib/api";
import { categoryOf, formatSize, saveBlob, sha256Hex } from "../lib/files";
import { directInbox, receiveDirect } from "../lib/p2p";

const POLL_MS = 3000;

const IntegrityBadge = ({ state }) => {
  if (state === "verified") {
    return (
      <span className="integrity ok">
        <ShieldCheck size={18} /> Verified: SHA-256 fingerprint matches the sender's
      </span>
    );
  }
  if (state === "mismatch") {
    return (
      <span className="integrity bad">
        <ShieldAlert size={18} /> Check FAILED: the file changed on the way. Ask for it again.
      </span>
    );
  }
  return (
    <span className="integrity skip">
      <Shield size={18} /> Fingerprint not checked on this device
    </span>
  );
};

// One inbox for both routes, oldest first
const mergeInbox = (serverFiles, directTransfers) =>
  [
    ...serverFiles.map((file) => ({
      key: `s-${file.id}`,
      route: "server",
      name: file.originalName,
      size: file.size,
      mimeType: file.mimeType,
      isFolder: file.isFolder,
      sender: file.sender,
      at: new Date(file.uploadedAt).getTime()
    })),
    ...directTransfers.map((transfer) => ({
      key: `d-${transfer.id}`,
      id: transfer.id,
      route: "direct",
      name: transfer.name,
      size: transfer.size,
      mimeType: transfer.mimeType,
      isFolder: transfer.isFolder,
      sender: transfer.sender,
      at: new Date(transfer.createdAt).getTime()
    }))
  ].sort((a, b) => a.at - b.at);

const DropPage = ({ user, onLogout }) => {
  const [inbox, setInbox] = useState([]);
  // idle → receiving (server) | connecting/streaming/verifying (direct) → received   (or error)
  const [phase, setPhase] = useState("idle");
  const [progress, setProgress] = useState({ ratio: 0, bytesPerSecond: 0, secondsLeft: null });
  const [message, setMessage] = useState("");
  const [received, setReceived] = useState(null); // { meta, blob, url, integrity }
  const busy = useRef(false);

  const loadInbox = useCallback(async () => {
    const [server, direct] = await Promise.allSettled([
      axios.get(`${API_URL}/api/incoming`, { headers: authHeaders() }).then((r) => r.data.files || []),
      directInbox().then((d) => d.transfers || [])
    ]);
    // Keep the last known list on a network blip
    if (server.status === "rejected" && direct.status === "rejected") return;
    setInbox(mergeInbox(server.value || [], direct.value || []));
  }, []);

  useEffect(() => {
    if (phase !== "idle") return undefined;
    // Polling the server is syncing with an external system, which is what effects are for
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadInbox();
    const timer = setInterval(loadInbox, POLL_MS);
    return () => clearInterval(timer);
  }, [phase, loadInbox]);

  useEffect(() => () => received?.url && URL.revokeObjectURL(received.url), [received]);

  // A direct transfer streams into this tab: warn before closing it mid-way
  const streaming = ["connecting", "streaming", "verifying"].includes(phase);
  useEffect(() => {
    if (!streaming) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [streaming]);

  const receiveFromServer = async () => {
    setPhase("receiving");
    setMessage("Receiving…");
    const { data } = await axios.post(`${API_URL}/api/drop`, null, { headers: authHeaders() });
    if (!data.success) return false;

    const meta = data.file;
    setMessage(`Downloading ${meta.originalName} from ${meta.sender}…`);
    const started = performance.now();
    const response = await axios.get(`${API_URL}/api/files/${meta.id}/download`, {
      headers: authHeaders(),
      responseType: "blob",
      onDownloadProgress: (event) => {
        const total = event.total || meta.size;
        const seconds = Math.max(0.001, (performance.now() - started) / 1000);
        const bytesPerSecond = event.loaded / seconds;
        setProgress({
          ratio: total ? event.loaded / total : 0,
          bytesPerSecond,
          secondsLeft: bytesPerSecond ? (total - event.loaded) / bytesPerSecond : null
        });
      }
    });
    const blob = new Blob([response.data], { type: meta.mimeType || "application/octet-stream" });
    setPhase("verifying");
    setMessage("Checking the SHA-256 fingerprint…");
    const localHash = await sha256Hex(blob);
    const integrity = !localHash || !meta.sha256 ? "skipped" : localHash === meta.sha256 ? "verified" : "mismatch";
    setReceived({ meta: { ...meta, route: "server" }, blob, url: URL.createObjectURL(blob), integrity });
    return true;
  };

  const receiveStraight = async (id) => {
    setPhase("connecting");
    setMessage("Connecting directly to the sender…");
    const outcome = await receiveDirect({
      id,
      onStatus: (stage, transfer) => {
        if (stage === "receiving") {
          setPhase("streaming");
          setMessage(`Receiving ${transfer.name} straight from ${transfer.sender}…`);
        }
        if (stage === "verifying") {
          setPhase("verifying");
          setMessage("Checking the SHA-256 fingerprint…");
        }
      },
      onProgress: (p) => setProgress(p)
    });
    if (!outcome) return false;
    setReceived({ ...outcome, meta: { ...outcome.meta, route: "direct" }, url: URL.createObjectURL(outcome.blob) });
    return true;
  };

  const receive = useCallback(
    async (item) => {
      if (busy.current) return;
      busy.current = true;
      setProgress({ ratio: 0, bytesPerSecond: 0, secondsLeft: null });
      try {
        // The drop always asks the server, so it also works for files that arrived after the last check
        const next = item || inbox[0];
        let ok = next?.route === "direct" ? await receiveStraight(next.id) : await receiveFromServer();
        if (!ok && !next) ok = await receiveStraight(); // maybe a direct transfer just arrived
        if (ok) {
          setPhase("received");
          setMessage("");
        } else {
          setPhase("idle");
          setMessage("Nothing is waiting for you yet. Ask the sender to GRAB first.");
          loadInbox();
        }
      } catch (error) {
        setPhase("error");
        setMessage(`Receive failed: ${errorMessage(error)}`);
      } finally {
        busy.current = false;
      }
    },
    // receiveFromServer / receiveStraight only use state setters
    [inbox, loadInbox]
  );

  const handleGestureEvent = useCallback(
    (type) => {
      if (type === "drop" && phase === "idle") receive();
    },
    [phase, receive]
  );

  const close = () => {
    setReceived(null);
    setPhase("idle");
    setMessage("");
    setProgress({ ratio: 0, bytesPerSecond: 0, secondsLeft: null });
  };

  const armed = phase === "idle";
  const kind = received ? categoryOf(received.meta.mimeType, received.meta.originalName) : null;
  const percent = Math.round(progress.ratio * 100);

  return (
    <>
      <NavBar user={user} onLogout={onLogout} />

      <main className="app-page">
        <div className="page-head">
          <span className="icon-tile drop">
            <Inbox />
          </span>
          <div>
            <h1>Receive</h1>
            <p>Files sent to you wait here. Make a fist, then open your hand to DROP the next one.</p>
          </div>
        </div>

        <div className="app-grid">
          <div>
            {phase !== "received" ? (
              <section className="card">
                <h2 className="card-title">
                  <span className="step-badge drop">
                    <Inbox size={14} />
                  </span>
                  Waiting for you
                </h2>

                {inbox.length > 0 ? (
                  <ul className="inbox">
                    {inbox.map((item, index) => (
                      <li key={item.key} className={`inbox-item ${index === 0 ? "next" : ""}`}>
                        <FileCard
                          name={item.name}
                          size={item.size}
                          mimeType={item.mimeType}
                          isFolder={item.isFolder}
                          note={`From ${item.sender}${index === 0 ? " · next to drop" : ""}`}
                          badge={
                            item.route === "direct" ? (
                              <span className="chip direct" title="The sender is online and will stream it to you">
                                <Zap size={13} /> Direct
                              </span>
                            ) : (
                              <span className="chip server" title="Stored on the server until you drop it">
                                <Cloud size={13} /> Server
                              </span>
                            )
                          }
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="drop-target">
                    <span className="icon-tile drop">
                      <ArrowDownToLine />
                    </span>
                    <strong>Nothing here yet</strong>
                    <span className="muted">
                      When someone sends you a file it shows up here within a few seconds. Keep this page open.
                    </span>
                  </div>
                )}

                {phase === "idle" && message && <p className="muted" style={{ marginTop: 14 }}>{message}</p>}

                {["receiving", "connecting", "streaming", "verifying"].includes(phase) && (
                  <div className="status">
                    <div className="status-head">
                      <span className="icon-tile drop">
                        <Loader2 className="spin" />
                      </span>
                      <span>{message}</span>
                    </div>
                    <div className={`progress drop ${phase === "connecting" || phase === "verifying" ? "indeterminate" : ""}`}>
                      <div style={{ width: `${percent}%` }} />
                    </div>
                    {(phase === "receiving" || phase === "streaming") && (
                      <div className="progress-meta">
                        <span>{percent}%</span>
                        <span>
                          {progress.bytesPerSecond ? `${formatSize(progress.bytesPerSecond)}/s` : ""}
                          {progress.secondsLeft != null && Number.isFinite(progress.secondsLeft)
                            ? ` · ${Math.max(1, Math.round(progress.secondsLeft))} s left`
                            : ""}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {phase === "error" && (
                  <div className="status error" role="alert">
                    {message}
                    <div className="actions">
                      <button type="button" className="btn btn-sm" onClick={close}>
                        OK
                      </button>
                    </div>
                  </div>
                )}

                <div className="actions">
                  {armed && inbox.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-drop btn-big"
                      onClick={() => receive()}
                      title="Same transfer without the gesture (useful for comparison tests)"
                    >
                      <Download size={18} /> Receive without gesture
                    </button>
                  )}
                </div>
              </section>
            ) : (
              <section className="card">
                <div className="status-head" style={{ marginBottom: 16 }}>
                  <span className="icon-tile leaf">
                    <PackageCheck />
                  </span>
                  <div>
                    <h2 className="card-title" style={{ margin: 0 }}>
                      Received from {received.meta.sender}
                    </h2>
                    <p className="muted">
                      {received.meta.route === "direct" ? "Sent directly, device to device" : "Delivered through the server"}
                    </p>
                  </div>
                </div>

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

                <div className="actions">
                  <button
                    type="button"
                    className="btn btn-drop btn-big"
                    onClick={() => saveBlob(received.blob, received.meta.originalName)}
                  >
                    <Download size={18} /> Save to this device ({formatSize(received.meta.size)})
                  </button>
                  <button type="button" className="btn" onClick={close}>
                    <X size={16} /> Close
                  </button>
                </div>
              </section>
            )}

            <Link to="/home" className="text-link">
              <ArrowLeft size={16} /> Sending instead? Open Send
            </Link>
          </div>

          <div className="camera-column">
            <GestureDetector
              onEvent={handleGestureEvent}
              armed={armed}
              target="drop"
              hint="DROP = make a fist, then open your hand"
              armedText={
                inbox.length > 0
                  ? `${inbox[0].name} is waiting. Make a fist, then open your hand.`
                  : "Make a fist, then open your hand to receive."
              }
              idleText={phase === "received" ? "Save or close the file to drop the next one." : "Receiving…"}
            />
            <p className="muted" style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
              <Hand size={16} /> Your video stays on this device. Only the hand shape is used.
            </p>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
};

export default DropPage;
