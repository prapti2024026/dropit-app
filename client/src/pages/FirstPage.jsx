import { useState } from "react";
import {
  Camera,
  CheckCircle2,
  FileVideo,
  FolderOpen,
  Grab,
  Hand,
  History,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import Login from "../components/Login";
import BrandMark from "../components/BrandMark";
import SiteFooter from "../components/SiteFooter";
import "./FirstPage.css";

const STEPS = [
  {
    tone: "trail",
    icon: FolderOpen,
    title: "Pick what to send",
    text: "Any file or a whole folder, then type the receiver's username.",
  },
  {
    tone: "grab",
    icon: Grab,
    title: "Grab it",
    text: "Show an open hand to your camera and close it into a fist.",
  },
  {
    tone: "drop",
    icon: Hand,
    title: "They drop it",
    text: "The receiver makes a fist and opens their hand. The file lands on their device.",
  },
];

const FEATURES = [
  {
    tone: "sun",
    icon: FolderOpen,
    title: "Any file, any folder",
    text: "Photos, PDFs, code, zip files. Folders are zipped for you.",
  },
  {
    tone: "grab",
    icon: FileVideo,
    title: "Big videos, 1 GB and more",
    text: "Up to 200 MB waits on the server; bigger files stream straight to the receiver.",
  },
  {
    tone: "leaf",
    icon: ShieldCheck,
    title: "Checked on arrival",
    text: "A SHA-256 fingerprint proves the file arrived unchanged.",
  },
  {
    tone: "sky",
    icon: Camera,
    title: "Camera stays private",
    text: "Your hand is read on your own device. Video never leaves it.",
  },
  { tone: "drop", icon: Smartphone, title: "Phone or laptop", text: "Works in the browser and installs like an app." },
  {
    tone: "trail",
    icon: History,
    title: "Full history",
    text: "See what you sent, what arrived, and cancel anything still waiting.",
  },
];

// The hero shows the whole idea in one picture: a file thrown from a grabbing hand to an open one
const ThrowStage = () => (
  <div className="stage" aria-hidden="true">
    <div className="stage-device sender">
      <span className="stage-hand grab">
        <Grab size={46} strokeWidth={1.9} />
      </span>
      <span className="stage-caption">Rahim grabs</span>
    </div>

    <svg className="stage-arc" viewBox="0 0 300 140" preserveAspectRatio="none">
      <defs>
        <linearGradient id="arcGradient" x1="0" x2="1">
          <stop offset="0" stopColor="#ff6b4a" />
          <stop offset="0.5" stopColor="#9d8cff" />
          <stop offset="1" stopColor="#22d3c5" />
        </linearGradient>
      </defs>
      <path
        d="M10 120 Q150 -40 290 120"
        fill="none"
        stroke="url(#arcGradient)"
        strokeWidth="3"
        strokeDasharray="2 10"
        strokeLinecap="round"
      />
    </svg>

    <div className="stage-file">
      <FileVideo size={22} />
      <span>trip.mp4</span>
    </div>

    <div className="stage-device receiver">
      <span className="stage-hand drop">
        <Hand size={46} strokeWidth={1.9} />
      </span>
      <span className="stage-caption">Nila drops</span>
    </div>
  </div>
);

const FirstPage = ({ onLogin }) => {
  const [authMode, setAuthMode] = useState(null); // null | "signin" | "signup"

  return (
    <div className="landing">
      <Login
        key={authMode || "closed"}
        isOpen={Boolean(authMode)}
        initialMode={authMode || "signin"}
        onClose={() => setAuthMode(null)}
        onLogin={onLogin}
      />

      <header className="landing-bar">
        <div className="landing-brand">
          <BrandMark size={52} />
          <span>DropIt</span>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => setAuthMode("signin")}>
          Sign in
        </button>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <h1>
              Grab a file here.
              <br />
              Drop it over there.
            </h1>
            <p className="hero-lead">
              DropIt sends files between any two accounts with a hand gesture. Close your hand to send, open it to
              receive. No cables, no links to copy.
            </p>
            <div className="hero-actions">
              <button type="button" className="btn btn-grab hero-cta" onClick={() => setAuthMode("signup")}>
                <Grab size={20} /> Create a free account
              </button>
              <button type="button" className="btn" onClick={() => setAuthMode("signin")}>
                I already have one
              </button>
            </div>
            <ul className="hero-facts">
              <li>
                <CheckCircle2 size={16} /> Free
              </li>
              <li>
                <CheckCircle2 size={16} /> Any file or folder
              </li>
              <li>
                <CheckCircle2 size={16} /> Verified with SHA-256
              </li>
            </ul>
          </div>
          <ThrowStage />
        </section>

        <section className="landing-section" aria-labelledby="how-title">
          <h2 id="how-title">How a transfer works</h2>
          <ol className="steps">
            {STEPS.map((step, index) => {
              const { tone, title, text } = step;
              const Icon = step.icon;
              return (
                <li key={title} className={`step ${tone}`}>
                  <span className={`icon-tile ${tone}`}>
                    <Icon />
                  </span>
                  <span className="step-number">{index + 1}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="landing-section" aria-labelledby="features-title">
          <h2 id="features-title">Made for everyday sharing</h2>
          <ul className="features">
            {FEATURES.map((feature) => {
              const { tone, title, text } = feature;
              const Icon = feature.icon;
              return (
                <li key={title} className="feature">
                  <span className={`icon-tile ${tone}`}>
                    <Icon />
                  </span>
                  <div>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="landing-cta">
          <h2>Try it with a friend in two minutes</h2>
          <p>Both of you sign up, one grabs, the other drops.</p>
          <button type="button" className="btn btn-grab hero-cta" onClick={() => setAuthMode("signup")}>
            <Grab size={20} /> Create a free account
          </button>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
};

export default FirstPage;
