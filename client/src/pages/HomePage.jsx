import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, FolderUp, Send, X, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import axios from "axios";

import "./HomePage.css";
import "./Transfer.css";
import SampleVideo from "./Sample_video.mp4";
import NavBar from "../components/NavBar";
import SiteFooter from "../components/SiteFooter";
import GestureDetector from "../components/GestureDetector";
import FileCard from "../components/FileCard";
import { API_URL, authHeaders, errorMessage } from "../lib/api";
import { MAX_UPLOAD_BYTES, categoryOf, formatSize, sha256Hex, zipFolder } from "../lib/files";

// Seconds between the grab gesture and the actual upload, so a wrong grab can be cancelled
const SEND_CONFIRM_SECONDS = 3;

const HomePage = ({ user, onLogout }) => {
  const [selected, setSelected] = useState(null); // { file, isFolder, folderName, count, previewUrl }
  const [receiverUsername, setReceiverUsername] = useState(import.meta.env.VITE_RECEIVER_USERNAME || "");

  // idle -> preparing -> countdown -> uploading -> sent  (or back to idle / error)
  const [phase, setPhase] = useState("idle");
  const [countdown, setCountdown] = useState(SEND_CONFIRM_SECONDS);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [receiver, setReceiver] = useState(null); // { id, username }

  const countdownTimer = useRef(null);
  const uploadAbort = useRef(null);

  // Free the preview's object URL when the selection changes or the page closes
  useEffect(() => () => selected?.previewUrl && URL.revokeObjectURL(selected.previewUrl), [selected]);

  useEffect(() => () => clearInterval(countdownTimer.current), []);

  const resetTransfer = () => {
    clearInterval(countdownTimer.current);
    uploadAbort.current?.abort();
    setPhase("idle");
    setProgress(0);
    setMessage("");
    setReceiver(null);
  };

  const clearSelection = () => {
    resetTransfer();
    setSelected(null);
  };

  const pickFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setMessage(`"${file.name}" is ${formatSize(file.size)}. The limit is ${formatSize(MAX_UPLOAD_BYTES)}.`);
      setPhase("error");
      return;
    }
    resetTransfer();
    const kind = categoryOf(file.type, file.name);
    const previewUrl = kind === "image" || kind === "video" ? URL.createObjectURL(file) : null;
    setSelected({ file, isFolder: false, previewUrl });
  };

  const pickFolder = async (event) => {
    const files = event.target.files;
    if (!files?.length) return;
    resetTransfer();
    setPhase("preparing");
    setMessage("Zipping folder…");
    try {
      const zipped = await zipFolder(files, (ratio) => setProgress(ratio));
      event.target.value = "";
      if (zipped.file.size > MAX_UPLOAD_BYTES) {
        setPhase("error");
        setMessage(`The zipped folder is ${formatSize(zipped.file.size)}. The limit is ${formatSize(MAX_UPLOAD_BYTES)}.`);
        return;
      }
      setSelected({ file: zipped.file, isFolder: true, folderName: zipped.folderName, count: zipped.count });
      setPhase("idle");
      setMessage("");
      setProgress(0);
    } catch (error) {
      setPhase("error");
      setMessage(`Could not zip the folder: ${errorMessage(error)}`);
    }
  };

  const upload = useCallback(
    async (target) => {
      if (!selected) return;
      setPhase("uploading");
      setProgress(0);
      setMessage("Checking file integrity…");

      try {
        const hash = await sha256Hex(selected.file);
        const form = new FormData();
        form.append("file", selected.file);
        form.append("exchangedWith", target.id);
        form.append("isFolder", String(selected.isFolder));
        if (hash) form.append("sha256", hash);

        uploadAbort.current = new AbortController();
        setMessage(`Sending to ${target.username}…`);

        const { data } = await axios.post(`${API_URL}/api/upload`, form, {
          headers: authHeaders(),
          signal: uploadAbort.current.signal,
          onUploadProgress: (event) => event.total && setProgress(event.loaded / event.total)
        });

        if (!data.success) throw new Error(data.message);
        setPhase("sent");
        setMessage(`Sent. Waiting for ${target.username} to make the DROP gesture.`);
      } catch (error) {
        if (axios.isCancel(error)) return;
        setPhase("error");
        setMessage(`Upload failed: ${errorMessage(error)}`);
      }
    },
    [selected]
  );

  // Step 1 of sending: find the receiver, then start the cancel window
  const startSend = useCallback(
    async ({ skipCountdown = false } = {}) => {
      if (!selected || phase !== "idle") return;

      const name = receiverUsername.trim();
      if (!name) {
        setPhase("error");
        setMessage("Enter the receiver's username or email first.");
        return;
      }

      setPhase("preparing");
      setMessage("Finding receiver…");
      try {
        const { data } = await axios.get(`${API_URL}/api/auth/user/${encodeURIComponent(name)}`, {
          headers: authHeaders()
        });
        const target = { id: data.user.id, username: data.user.username };
        setReceiver(target);

        if (skipCountdown) {
          upload(target);
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
            upload(target);
          }
        }, 1000);
      } catch (error) {
        setPhase("error");
        setMessage(
          error?.response?.status === 404
            ? `No user called "${name}". Check the username or email.`
            : `Could not find receiver: ${errorMessage(error)}`
        );
      }
    },
    [selected, phase, receiverUsername, upload]
  );

  const handleGestureEvent = useCallback(
    (type) => {
      if (type === "grab") startSend();
    },
    [startSend]
  );

  const armed = Boolean(selected && receiverUsername.trim() && phase === "idle");
  const kind = selected ? categoryOf(selected.file.type, selected.file.name) : null;
  const previewUrl = selected?.previewUrl;

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
        armedText="Ready: open your hand, then close it into a fist to send."
        idleText={!selected ? "Pick a file or folder to arm the grab gesture." : "Enter a receiver to arm the grab gesture."}
        hint="GRAB = open hand → fist"
      />

      <div className="home-page-container">
        <div className="home-page-content glass-effect-home transfer-card">
          <h1 className="home-page-title">Send a File</h1>
          <p className="home-page-subtitle">
            Choose any file or folder, then make a <strong>GRAB</strong> gesture
          </p>

          <div className="receiver-input-container">
            <label htmlFor="receiver-username" className="receiver-label">Send to (username or email):</label>
            <input
              id="receiver-username"
              type="text"
              value={receiverUsername}
              onChange={(event) => setReceiverUsername(event.target.value)}
              placeholder="Receiver's username"
              className="receiver-input"
              disabled={phase !== "idle" && phase !== "error"}
              autoComplete="off"
            />
          </div>

          {!selected ? (
            <div className="picker-row">
              <label className="home-upload-area picker">
                <Upload className="home-upload-icon" />
                <span className="home-upload-text">Choose file</span>
                <input type="file" className="hidden" onChange={pickFile} />
              </label>
              <label className="home-upload-area picker">
                <FolderUp className="home-upload-icon" />
                <span className="home-upload-text">Choose folder</span>
                <input type="file" className="hidden" webkitdirectory="" directory="" multiple onChange={pickFolder} />
              </label>
            </div>
          ) : (
            <div className="selected-preview">
              {kind === "image" && previewUrl && <img src={previewUrl} alt={selected.file.name} className="preview-media" />}
              {kind === "video" && previewUrl && <video src={previewUrl} className="preview-media" controls muted playsInline />}
              <FileCard
                name={selected.isFolder ? `${selected.folderName}/` : selected.file.name}
                size={selected.file.size}
                mimeType={selected.file.type}
                isFolder={selected.isFolder}
                note={selected.isFolder ? `${selected.count} files, sent as ${selected.file.name}` : null}
              />
            </div>
          )}

          {phase === "countdown" && receiver && (
            <div className="transfer-status countdown">
              <div className="countdown-number">{countdown}</div>
              <p>Sending to <strong>{receiver.username}</strong>…</p>
              <button type="button" className="transfer-btn danger" onClick={resetTransfer}>
                <X size={16} /> Cancel
              </button>
            </div>
          )}

          {(phase === "uploading" || phase === "preparing") && (
            <div className="transfer-status">
              <p>{message}</p>
              <div className="progress"><div style={{ width: `${Math.round(progress * 100)}%` }} /></div>
              {phase === "uploading" && (
                <button type="button" className="transfer-btn danger" onClick={resetTransfer}>
                  <X size={16} /> Stop
                </button>
              )}
            </div>
          )}

          {phase === "sent" && (
            <div className="transfer-status success">
              <CheckCircle2 className="status-icon" />
              <p>{message}</p>
              <p className="muted">You can cancel it from History until it is dropped.</p>
            </div>
          )}

          {phase === "error" && message && <div className="transfer-status error"><p>{message}</p></div>}

          <div className="transfer-actions">
            {selected && phase === "idle" && (
              <button
                type="button"
                className="transfer-btn secondary"
                onClick={() => startSend({ skipCountdown: true })}
                title="Same transfer without the gesture (useful for comparison tests)"
              >
                <Send size={16} /> Send without gesture
              </button>
            )}
            {selected && phase !== "uploading" && (
              <button type="button" className="transfer-btn" onClick={clearSelection}>
                {phase === "sent" ? "Send another" : "Choose a different file"}
              </button>
            )}
            {phase === "error" && !selected && (
              <button type="button" className="transfer-btn" onClick={resetTransfer}>OK</button>
            )}
            {phase === "error" && selected && (
              <button type="button" className="transfer-btn" onClick={resetTransfer}>Try again</button>
            )}
            <Link to="/drop" className="transfer-link">Receiving instead? Go to Drop →</Link>
          </div>
        </div>
      </div>

      <SiteFooter />
    </>
  );
};

export default HomePage;
