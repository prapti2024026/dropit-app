import { useEffect, useState } from "react";
import { Download, MoreVertical, PlusSquare, Share, Smartphone, X } from "lucide-react";
import { canPromptInstall, isInstalled, onInstallChange, platform, promptInstall } from "../lib/install";
import "./InstallButton.css";

const STEPS = {
  "ios-safari": {
    title: "Install on iPhone",
    steps: [
      { icon: Share, text: "Tap the Share button at the bottom of Safari." },
      { icon: PlusSquare, text: 'Scroll down and tap "Add to Home Screen".' },
      { icon: Smartphone, text: 'Tap "Add". DropIt opens from your Home Screen like an app.' }
    ]
  },
  "ios-other": {
    title: "Open in Safari first",
    steps: [
      { icon: Share, text: "On iPhone only Safari can install apps. Copy this page's link and open it in Safari." },
      { icon: PlusSquare, text: 'Then tap Share → "Add to Home Screen" → "Add".' }
    ]
  },
  "in-app": {
    title: "Open in Chrome first",
    steps: [
      { icon: MoreVertical, text: 'This page is open inside another app. Tap ⋮ and choose "Open in Chrome" (or "Open in browser").' },
      { icon: Download, text: 'Then tap "Install app" on DropIt again.' }
    ]
  },
  samsung: {
    title: "Install from Samsung Internet",
    steps: [
      { icon: MoreVertical, text: "Tap the menu (☰) at the bottom right." },
      { icon: PlusSquare, text: 'Tap "Add page to" → "Home screen" (or "Apps screen").' },
      { icon: Smartphone, text: "Tip: in Chrome the install is one tap with this same button." }
    ]
  },
  android: {
    title: "Install on Android",
    steps: [
      { icon: MoreVertical, text: "Tap ⋮ at the top right of Chrome." },
      { icon: Download, text: 'Tap "Install app". If you only see "Add to Home screen", tap it and then choose "Install" (not "Create shortcut").' },
      { icon: Smartphone, text: "If neither appears, reload the page once and wait a few seconds, then try again." }
    ]
  },
  desktop: {
    title: "Install on this computer",
    steps: [
      { icon: Download, text: "In Chrome or Edge, click the install icon at the right end of the address bar." },
      { icon: MoreVertical, text: 'Or open the ⋮ menu → "Cast, save and share" → "Install DropIt".' }
    ]
  }
};

// Shows nothing once DropIt runs as an installed app
const InstallButton = ({ className = "btn", label = "Install app" }) => {
  const [, refresh] = useState(0);
  const [help, setHelp] = useState(false);

  useEffect(() => onInstallChange(() => refresh((n) => n + 1)), []);

  if (isInstalled()) return null;

  const onClick = async () => {
    if (canPromptInstall()) {
      const outcome = await promptInstall();
      if (outcome !== "unavailable") return;
    }
    setHelp(true);
  };

  const guide = STEPS[platform()] || STEPS.desktop;

  return (
    <>
      <button type="button" className={`${className} install-btn`} onClick={onClick}>
        <Download size={18} /> {label}
      </button>
      {help && (
        <div className="install-overlay" role="dialog" aria-modal="true" aria-labelledby="install-title" onClick={() => setHelp(false)}>
          <div className="install-card" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="install-close" onClick={() => setHelp(false)} aria-label="Close">
              <X size={20} />
            </button>
            <span className="icon-tile trail">
              <Smartphone />
            </span>
            <h2 id="install-title">{guide.title}</h2>
            <ol>
              {guide.steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <li key={index}>
                    <span className="install-step-icon">
                      <Icon size={18} />
                    </span>
                    <span>{step.text}</span>
                  </li>
                );
              })}
            </ol>
            <button type="button" className="btn btn-trail" onClick={() => setHelp(false)}>
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default InstallButton;
