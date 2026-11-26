// "Install app" support for the PWA.
// Chrome/Edge on Android and desktop fire `beforeinstallprompt` when DropIt can be installed;
// we keep that event so our own button can open the real install dialog.
// iPhone Safari has no such event, so the button shows the Share → Add to Home Screen steps.
let deferredPrompt = null;
const listeners = new Set();
const notify = () => listeners.forEach((listener) => listener());

export const captureInstallPrompt = () => {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // we show our own button instead of Chrome's mini bar
    deferredPrompt = event;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });
};

export const onInstallChange = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const canPromptInstall = () => Boolean(deferredPrompt);

// Opens the browser's install dialog. Resolves "accepted" | "dismissed" | "unavailable".
export const promptInstall = async () => {
  if (!deferredPrompt) return "unavailable";
  const event = deferredPrompt;
  deferredPrompt = null;
  event.prompt();
  const choice = await event.userChoice.catch(() => ({ outcome: "dismissed" }));
  notify();
  return choice.outcome;
};

export const isInstalled = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;

export const platform = () => {
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) {
    return /CriOS|FxiOS|EdgiOS/i.test(ua) ? "ios-other" : "ios-safari";
  }
  // Pages opened inside Facebook, Messenger, Instagram etc. cannot be installed
  if (/FBAN|FBAV|FB_IAB|Instagram|Messenger|Line\/|; wv\)/i.test(ua)) return "in-app";
  if (/SamsungBrowser/i.test(ua)) return "samsung";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
};
