import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  ArrowRight,
  AtSign,
  CheckCircle2,
  Cloud,
  FileUp,
  FolderUp,
  Loader2,
  Send,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  UserX,
  X,
  Zap
} from "lucide-react";

import "./Transfer.css";
import NavBar from "../components/NavBar";
import SiteFooter from "../components/SiteFooter";
import GestureDetector from "../components/GestureDetector";
import FileCard from "../components/FileCard";
import { API_URL, authHeaders, errorMessage, getServerLimits, onServerLimits } from "../lib/api";
import { MAX_UPLOAD_BYTES, categoryOf, formatSize, sha256Hex, zipFolder } from "../lib/files";
import { isDirectSupported, sendDirect } from "../lib/p2p";

// Seconds between the grab gesture and the actual send, so a wrong grab can be cancelled
const SEND_CONFIRM_SECONDS = 2;

const formatDuration = (seconds) => {
  if (seconds == null || !Number.isFinite(seconds)) return "";
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} s left`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min ${Math.round(seconds % 60)} s left`;
};

// Files up to the server limit wait on the server (receiver can drop later).
// Bigger files go straight from this browser to the receiver's (both must be online).
const routeFor = (size, limit) => (size > limit ? "direct" : "server");

const CountdownRing = ({ value }) => {
  const radius = 27;
  const length = 2 * Math.PI * radius;
  return (
    <span className="countdown-ring" aria-hidden="true">
      <svg viewBox="0 0 64 64">
        <circle className="track" cx="32" cy="32" r={radius} />
        <circle
          className="bar"
          cx="32"
          cy="32"
          r={radius}
          strokeDasharray={length}
          strokeDashoffset={length * (1 - value / SEND_CONFIRM_SECONDS)}
        />
      </svg>
      <b>{value}</b>
    </span>
  );
};

const HomePage = ({ user, onLogout }) => {
  const [selected, setSelected] = useState(null); // { file, isFolder, folderName, count, previewUrl, route }
  const [receiverUsername, setReceiverUsername] = useState(import.meta.env.VITE_RECEIVER_USERNAME || "");
  const [dragging, setDragging] = useState(false);
  // The server says how big a stored file may be; until it answers, use the built-in default
  const [serverLimit, setServerLimit] = useState(() => getServerLimits()?.maxFileBytes || MAX_UPLOAD_BYTES);
  useEffect(() => onServerLimits((limits) => setServerLimit(limits.maxFileBytes)), []);

  // idle → preparing → countdown → (server) uploading → sent
  //                              → (direct) waiting → connecting → streaming → verifying → delivered
  const [phase, setPhase] = useState("idle");
  const [countdown, setCountdown] = useState(SEND_CONFIRM_SECONDS);
  const [progress, setProgress] = useState({ ratio: 0, bytesPerSecond: 0, secondsLeft: null });
  const [message, setMessage] = useState("");
  const [receiver, setReceiver] = useState(null);
  const [result, setResult] = useState(null);

  const countdownTimer = useRef(null);
  const uploadAbort = useRef(null);
  const directJob = useRef(null);
  const hashJob = useRef(null); // { file, promise } so the SHA-256 is ready before the grab

  // Look the receiver up while typing, so the grab can start sending at once
  const [lookup, setLookup] = useState({ state: "idle", name: "", user: null }); // idle | checking | found | missing

  useEffect(() => {
    const name = receiverUsername.trim();
    if (!name) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLookup({ state: "idle", name: "", user: null });
      return undefined;
    }
    setLookup({ state: "checking", name, user: null });
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const { data } = await axios.get(`${API_URL}/api/auth/user/${encodeURIComponent(name)}`, {
          headers: authHeaders(),
          signal: controller.signal
        });
        setLookup({ state: "found", name, user: { id: data.user.id, username: data.user.username } });
      } catch (error) {
        if (axios.isCancel(error)) return;
        setLookup({ state: error?.response?.status === 404 ? "missing" : "idle", name, user: null });
      }
    }, 450);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [receiverUsername]);

  // Free the preview's object URL when the selection changes or the page closes
  useEffect(() => () => selected?.previewUrl && URL.revokeObjectURL(selected.previewUrl), [selected]);
  useEffect(
    () => () => {
      clearInterval(countdownTimer.current);
      directJob.current?.cancel();
    },
    []
  );

  // A direct transfer needs this tab open: warn before closing it
  const directActive = ["waiting", "connecting", "streaming", "verifying"].includes(phase);
  useEffect(() => {
    if (!directActive) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [directActive]);

  const resetTransfer = () => {
    clearInterval(countdownTimer.current);
    uploadAbort.current?.abort();
    directJob.current?.cancel();
    directJob.current = null;
    setPhase("idle");
    setProgress({ ratio: 0, bytesPerSecond: 0, secondsLeft: null });
    setMessage("");
    setReceiver(null);
    setResult(null);
  };

  const clearSelection = () => {
    resetTransfer();
    setSelected(null);
  };

  const fail = (text) => {
    setPhase("error");
    setMessage(text);
  };

  const choose = (file, extra = {}) => {
    const route = routeFor(file.size, serverLimit);
    if (route === "direct" && !isDirectSupported()) {
      fail(`"${file.name}" is ${formatSize(file.size)}. This browser cannot send files over ${formatSize(serverLimit)}.`);
      return;
    }
    const kind = categoryOf(file.type, file.name);
    // Previews of very big videos are fine: the browser streams them from disk
    const previewUrl = !extra.isFolder && (kind === "image" || kind === "video") ? URL.createObjectURL(file) : null;
    setSelected({ file, isFolder: false, previewUrl, route, ...extra });
    // Server route: compute the fingerprint now so the grab can start the upload at once
    hashJob.current = route === "server" ? { file, promise: sha256Hex(file).catch(() => null) } : null;
  };

  const pickFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    resetTransfer();
    choose(file);
  };

  const pickFolder = async (event) => {
    const files = event.target.files;
    if (!files?.length) return;
    resetTransfer();
    setPhase("preparing");
    setMessage("Zipping folder…");
    try {
      const zipped = await zipFolder(files, (ratio) => setProgress((p) => ({ ...p, ratio })));
      event.target.value = "";
      setPhase("idle");
      setMessage("");
      setProgress({ ratio: 0, bytesPerSecond: 0, secondsLeft: null });
      choose(zipped.file, { isFolder: true, folderName: zipped.folderName, count: zipped.count });
    } catch (error) {
      fail(`Could not zip the folder: ${errorMessage(error)}`);
    }
  };

  const onDropFile = (event) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    resetTransfer();
    choose(file);
  };

  // ---------- route 1: through the server ----------
  const uploadToServer = useCallback(
    async (target) => {
      setPhase("uploading");
      setProgress({ ratio: 0, bytesPerSecond: 0, secondsLeft: null });
      setMessage("Checking file integrity…");
      try {
        const job = hashJob.current?.file === selected.file ? hashJob.current.promise : sha256Hex(selected.file);
        const hash = await job;
        const form = new FormData();
        form.append("file", selected.file);
        form.append("exchangedWith", target.id);
        form.append("isFolder", String(selected.isFolder));
        if (hash) form.append("sha256", hash);

        uploadAbort.current = new AbortController();
        setMessage(`Uploading for ${target.username}…`);
        const started = performance.now();

        const { data } = await axios.post(`${API_URL}/api/upload`, form, {
          headers: authHeaders(),
          signal: uploadAbort.current.signal,
          onUploadProgress: (event) => {
            if (!event.total) return;
            const seconds = Math.max(0.001, (performance.now() - started) / 1000);
            const bytesPerSecond = event.loaded / seconds;
            setProgress({
              ratio: event.loaded / event.total,
              bytesPerSecond,
              secondsLeft: bytesPerSecond ? (event.total - event.loaded) / bytesPerSecond : null
            });
          }
        });

        if (!data.success) throw new Error(data.message);
        setPhase("sent");
        setMessage(`Sent. ${target.username} can DROP it any time in the next 7 days.`);
      } catch (error) {
        if (axios.isCancel(error)) return;
        fail(`Upload failed: ${errorMessage(error)}`);
      }
    },
    [selected]
  );

  // ---------- route 2: straight to the receiver's browser ----------
  const sendStraight = useCallback(
    (target) => {
      setPhase("waiting");
      setMessage(`Waiting for ${target.username} to open Receive and make the DROP gesture…`);
      const job = sendDirect({
        file: selected.file,
        name: selected.file.name,
        isFolder: selected.isFolder,
        receiver: target,
        onStatus: (stage) => {
          if (stage === "connecting") {
            setPhase("connecting");
            setMessage(`${target.username} dropped. Connecting directly…`);
          }
          if (stage === "sending") {
            setPhase("streaming");
            setMessage(`Sending straight to ${target.username}…`);
          }
          if (stage === "verifying") {
            setPhase("verifying");
            setMessage("Waiting for the receiver to confirm the SHA-256 fingerprint…");
          }
        },
        onProgress: (p) => setProgress(p)
      });
      directJob.current = job;
      job.promise
        .then((outcome) => {
          directJob.current = null;
          setResult(outcome);
          setPhase("delivered");
          setMessage(`${selected.file.name} arrived on ${target.username}'s device.`);
        })
        .catch((error) => {
          directJob.current = null;
          if (error.message === "cancelled") return;
          fail(`Direct transfer failed: ${errorMessage(error)}`);
        });
    },
    [selected]
  );

  const deliver = useCallback(
    (target) => (selected.route === "direct" ? sendStraight(target) : uploadToServer(target)),
    [selected, sendStraight, uploadToServer]
  );

  // The grab: find the receiver, then give a short window to cancel
  const startSend = useCallback(
    async ({ skipCountdown = false } = {}) => {
      if (!selected || phase !== "idle") return;
      const name = receiverUsername.trim();
      if (!name) {
        fail("Type the receiver's username or email first.");
        return;
      }
      try {
        let target = lookup.state === "found" && lookup.name === name ? lookup.user : null;
        if (!target) {
          setPhase("preparing");
          setMessage("Finding receiver…");
          const { data } = await axios.get(`${API_URL}/api/auth/user/${encodeURIComponent(name)}`, {
            headers: authHeaders()
          });
          target = { id: data.user.id, username: data.user.username };
        }
        setReceiver(target);

        if (skipCountdown) {
          deliver(target);
          return;
        }
        setPhase("countdown");
        setCountdown(SEND_CONFIRM_SECONDS);
        let left = SEND_CONFIRM_SECONDS;
        clearInterval(countdownTimer.current);
        countdownTimer.current = setInterval(() => {
          left -= 1;
          setCountdown(left);
          if (left <= 0) {
            clearInterval(countdownTimer.current);
            deliver(target);
          }
        }, 1000);
      } catch (error) {
        fail(
          error?.response?.status === 404
            ? `No user called "${name}". Check the username or email.`
            : `Could not find the receiver: ${errorMessage(error)}`
        );
      }
    },
    [selected, phase, receiverUsername, deliver, lookup]
  );

  const handleGestureEvent = useCallback(
    (type) => {
      if (type === "grab") startSend();
    },
    [startSend]
  );

  const armed = Boolean(selected && receiverUsername.trim() && lookup.state !== "missing" && phase === "idle");
  const kind = selected ? categoryOf(selected.file.type, selected.file.name) : null;
  const busy = !["idle", "error", "sent", "delivered"].includes(phase);
  const showProgress = ["uploading", "streaming", "preparing"].includes(phase);

  return (
    <>
      <NavBar user={user} onLogout={onLogout} />

      <main className="app-page">
        <div className="page-head">
          <span className="icon-tile grab">
            <Send />
          </span>
          <div>
            <h1>Send a file</h1>
            <p>Choose who it is for and what to send, then GRAB it in front of your camera.</p>
          </div>
        </div>

        <div className="app-grid">
          <div>
            <section className="card">
              <div className="card-section">
                <label className="card-title" htmlFor="receiver-username">
                  <span className="step-badge">1</span> Who is it for?
                </label>
                <div className="field-input">
                  <AtSign size={20} />
                  <input
                    id="receiver-username"
                    type="text"
                    value={receiverUsername}
                    onChange={(event) => setReceiverUsername(event.target.value)}
                    placeholder="Receiver's username or email"
                    disabled={busy}
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  {lookup.state === "checking" && <Loader2 size={18} className="spin" />}
                  {lookup.state === "found" && <UserCheck size={18} color="var(--ok)" />}
                  {lookup.state === "missing" && <UserX size={18} color="var(--bad)" />}
                </div>
                <p className={`receiver-status ${lookup.state}`} aria-live="polite">
                  {lookup.state === "found" && `${lookup.user.username} found`}
                  {lookup.state === "missing" && "No user with that username or email"}
                </p>
              </div>

              <div className="card-section">
                <h2 className="card-title">
                  <span className="step-badge">2</span> What are you sending?
                </h2>

                {!selected ? (
                  <div
                    className="pickers"
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDropFile}
                  >
                    <label className={`picker ${dragging ? "dragging" : ""}`}>
                      <span className="icon-tile grab">
                        <FileUp />
                      </span>
                      <strong>Choose file</strong>
                      <span className="muted">Any type · or drag it here</span>
                      <input type="file" onChange={pickFile} disabled={busy} aria-label="Choose a file to send" />
                    </label>
                    <label className="picker folder">
                      <span className="icon-tile sun">
                        <FolderUp />
                      </span>
                      <strong>Choose folder</strong>
                      <span className="muted">Zipped for you</span>
                      <input
                        type="file"
                        webkitdirectory=""
                        directory=""
                        multiple
                        onChange={pickFolder}
                        disabled={busy}
                        aria-label="Choose a folder to send"
                      />
                    </label>
                  </div>
                ) : (
                  <div>
                    {kind === "image" && selected.previewUrl && (
                      <img src={selected.previewUrl} alt={selected.file.name} className="preview-media" />
                    )}
                    {kind === "video" && selected.previewUrl && (
                      <video src={selected.previewUrl} className="preview-media" controls muted playsInline />
                    )}
                    <FileCard
                      name={selected.isFolder ? `${selected.folderName}/` : selected.file.name}
                      size={selected.file.size}
                      mimeType={selected.file.type}
                      isFolder={selected.isFolder}
                      note={selected.isFolder ? `${selected.count} files, sent as ${selected.file.name}` : null}
                      badge={
                        !busy && phase !== "sent" && phase !== "delivered" ? (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={clearSelection}>
                            <X size={16} /> Change
                          </button>
                        ) : null
                      }
                    />
                    {selected.route === "server" ? (
                      <p className="route server">
                        <Cloud size={18} />
                        <span>
                          Waits safely on the server for up to 7 days, so the receiver can DROP it whenever they
                          like.
                        </span>
                      </p>
                    ) : (
                      <p className="route direct">
                        <Zap size={18} />
                        <span>
                          Over {formatSize(serverLimit)}, so it goes <strong>directly</strong> to the receiver's
                          device. They should have Receive open, and keep this tab open until it arrives.
                        </span>
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* ---------- status ---------- */}
              {phase === "countdown" && receiver && (
                <div className="status countdown">
                  <CountdownRing value={countdown} />
                  <p>
                    Sending to <strong>{receiver.username}</strong>…
                  </p>
                  <button type="button" className="btn btn-danger" onClick={resetTransfer}>
                    <X size={16} /> Cancel
                  </button>
                </div>
              )}

              {["waiting", "connecting", "verifying"].includes(phase) && (
                <div className="status">
                  <div className="status-head">
                    <span className="icon-tile drop">
                      <Loader2 className="spin" />
                    </span>
                    <span>{message}</span>
                  </div>
                  <div className="progress indeterminate drop">
                    <div />
                  </div>
                  <p className="muted">Keep this tab open.</p>
                  <div className="actions">
                    <button type="button" className="btn btn-danger btn-sm" onClick={resetTransfer}>
                      <X size={16} /> Cancel
                    </button>
                  </div>
                </div>
              )}

              {showProgress && (
                <div className="status">
                  <div className="status-head">
                    <span>{message}</span>
                  </div>
                  <div className="progress">
                    <div style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
                  </div>
                  {phase !== "preparing" && (
                    <div className="progress-meta">
                      <span>
                        {Math.round(progress.ratio * 100)}% · {formatSize(progress.ratio * (selected?.file.size || 0))} of{" "}
                        {formatSize(selected?.file.size || 0)}
                      </span>
                      <span>
                        {progress.bytesPerSecond ? `${formatSize(progress.bytesPerSecond)}/s · ` : ""}
                        {formatDuration(progress.secondsLeft)}
                      </span>
                    </div>
                  )}
                  {phase !== "preparing" && (
                    <div className="actions">
                      <button type="button" className="btn btn-danger btn-sm" onClick={resetTransfer}>
                        <X size={16} /> Stop
                      </button>
                    </div>
                  )}
                </div>
              )}

              {phase === "sent" && (
                <div className="status success">
                  <div className="status-head">
                    <span className="icon-tile leaf">
                      <CheckCircle2 />
                    </span>
                    <span>{message}</span>
                  </div>
                  <p className="muted">You can cancel it from History until it is dropped.</p>
                </div>
              )}

              {phase === "delivered" && (
                <div className="status success">
                  <div className="status-head">
                    <span className={`icon-tile ${result?.verified ? "leaf" : "grab"}`}>
                      {result?.verified ? <ShieldCheck /> : <ShieldAlert />}
                    </span>
                    <span>{message}</span>
                  </div>
                  <p className="muted">
                    {result?.verified
                      ? "The receiver's SHA-256 fingerprint matches yours: the file arrived unchanged."
                      : "The receiver's fingerprint did not match. Please send it again."}
                  </p>
                </div>
              )}

              {phase === "error" && message && (
                <div className="status error" role="alert">
                  {message}
                </div>
              )}

              <div className="actions">
                {selected && phase === "idle" && (
                  <button
                    type="button"
                    className="btn btn-grab btn-big"
                    onClick={() => startSend({ skipCountdown: true })}
                    disabled={!receiverUsername.trim() || lookup.state === "missing"}
                    title="Same transfer without the gesture (useful for comparison tests)"
                  >
                    <Send size={18} /> Send without gesture
                  </button>
                )}
                {(phase === "sent" || phase === "delivered") && (
                  <button type="button" className="btn btn-grab btn-big" onClick={clearSelection}>
                    <FileUp size={18} /> Send another
                  </button>
                )}
                {phase === "error" && (
                  <button type="button" className="btn" onClick={resetTransfer}>
                    {selected ? "Try again" : "OK"}
                  </button>
                )}
              </div>
            </section>

            <Link to="/drop" className="text-link">
              Receiving instead? Open Receive <ArrowRight size={16} />
            </Link>
          </div>

          <div className="camera-column">
            <GestureDetector
              onEvent={handleGestureEvent}
              armed={armed}
              target="grab"
              hint="GRAB = open hand, then close it into a fist"
              armedText="Ready. Open your hand, then close it into a fist to send."
              idleText={
                !selected
                  ? "Pick a file or folder first. The grab turns on after that."
                  : lookup.state === "missing"
                    ? "That receiver does not exist. Check the username."
                    : !receiverUsername.trim()
                      ? "Type who it is for to turn on the grab."
                      : "Busy with the current transfer."
              }
            />
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
};

export default HomePage;
