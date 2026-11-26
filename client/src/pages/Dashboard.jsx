import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Grab, Hand, History, Inbox, Send, Sparkles, Zap } from "lucide-react";

import "./Transfer.css";
import "./Dashboard.css";
import NavBar from "../components/NavBar";
import SiteFooter from "../components/SiteFooter";
import { API_URL, authHeaders } from "../lib/api";
import { formatSize } from "../lib/files";
import { fileKind } from "../lib/fileKind";
import { directInbox } from "../lib/p2p";

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const ACTIONS = [
  {
    to: "/home",
    tone: "grab",
    icon: Send,
    title: "Send",
    text: "Pick a file or folder, type who it is for, then GRAB it."
  },
  {
    to: "/drop",
    tone: "drop",
    icon: Inbox,
    title: "Receive",
    text: "See what is waiting for you and DROP it onto this device."
  },
  {
    to: "/history",
    tone: "trail",
    icon: History,
    title: "History",
    text: "Everything you sent and received, and anything still waiting."
  }
];

// Home for signed-in users: where to go next, what is waiting, and recent activity
const Dashboard = ({ user, onLogout }) => {
  const [waiting, setWaiting] = useState(null); // number of files waiting for me
  const [recent, setRecent] = useState(null);

  const load = useCallback(async () => {
    const [server, direct, files] = await Promise.allSettled([
      axios.get(`${API_URL}/api/incoming`, { headers: authHeaders() }).then((r) => r.data.count || 0),
      directInbox().then((d) => d.count || 0),
      axios.get(`${API_URL}/api/files`, { headers: authHeaders() }).then((r) => r.data.files || [])
    ]);
    setWaiting((server.value || 0) + (direct.value || 0));
    if (files.status === "fulfilled") setRecent(files.value.slice(0, 5));
    else setRecent([]);
  }, []);

  useEffect(() => {
    // Reading the inbox and history from the server is syncing with an external system
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [load]);

  const firstName = (user?.name || user?.username || "").split(" ")[0];

  return (
    <>
      <NavBar user={user} onLogout={onLogout} />

      <main className="app-page">
        <section className="welcome">
          <div>
            <p className="welcome-kicker">
              <Sparkles size={16} /> {greeting()}
            </p>
            <h1>Hi {firstName}, what are you sharing today?</h1>
            <p className="muted">
              Your username is <strong>@{user?.username}</strong>. Give it to friends so they can send you files.
            </p>
          </div>
          {waiting > 0 && (
            <Link to="/drop" className="waiting-banner">
              <span className="icon-tile drop">
                <Inbox />
              </span>
              <span>
                <strong>
                  {waiting === 1 ? "1 file is" : `${waiting} files are`} waiting for you
                </strong>
                <span>Open Receive and make the DROP gesture</span>
              </span>
              <ArrowRight size={20} />
            </Link>
          )}
        </section>

        <ul className="action-grid">
          {ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <li key={action.to}>
                <Link to={action.to} className={`action-card ${action.tone}`}>
                  <span className={`icon-tile ${action.tone}`}>
                    <Icon />
                  </span>
                  <span className="action-body">
                    <strong>
                      {action.title}
                      {action.to === "/drop" && waiting > 0 && <span className="count-badge">{waiting}</span>}
                    </strong>
                    <span>{action.text}</span>
                  </span>
                  <ArrowRight className="action-arrow" size={22} />
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="dash-grid">
          <section className="card">
            <div className="dash-card-head">
              <h2 className="card-title">Recent activity</h2>
              <Link to="/history" className="text-link" style={{ marginTop: 0 }}>
                See all <ArrowRight size={16} />
              </Link>
            </div>

            {recent === null ? (
              <p className="muted">Loading…</p>
            ) : recent.length === 0 ? (
              <div className="history-empty-mini">
                <p className="muted">No transfers yet. Send your first file to a friend.</p>
                <Link to="/home" className="btn btn-grab">
                  <Send size={16} /> Send a file
                </Link>
              </div>
            ) : (
              <ul className="recent-list">
                {recent.map((file) => {
                  const kind = fileKind(file.mimeType, file.originalName, file.isFolder);
                  const KindIcon = kind.icon;
                  const sent = file.transferType === "send";
                  return (
                    <li key={file._id}>
                      <span className={`icon-tile ${kind.tone}`}>
                        <KindIcon />
                      </span>
                      <span className="recent-body">
                        <strong title={file.originalName}>{file.originalName}</strong>
                        <span className={`direction ${sent ? "sent" : "received"}`}>
                          {sent ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                          {sent ? "To" : "From"} {file.receiverId?.username || "someone"} · {formatSize(file.size)}
                          {file.mode === "direct" && (
                            <>
                              {" "}
                              · <Zap size={12} /> Direct
                            </>
                          )}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="card how-card">
            <h2 className="card-title">The two gestures</h2>
            <div className="gesture-how">
              <span className="icon-tile grab">
                <Grab />
              </span>
              <div>
                <strong>GRAB to send</strong>
                <p className="muted">Show an open hand to the camera, then close it into a fist.</p>
              </div>
            </div>
            <div className="gesture-how">
              <span className="icon-tile drop">
                <Hand />
              </span>
              <div>
                <strong>DROP to receive</strong>
                <p className="muted">Make a fist, then open your hand.</p>
              </div>
            </div>
            <p className="muted small-note">
              Files up to 200 MB wait on the server for 7 days. Bigger ones go straight to the receiver, so both of you
              need to be online.
            </p>
          </section>
        </div>
      </main>

      <SiteFooter />
    </>
  );
};

export default Dashboard;
