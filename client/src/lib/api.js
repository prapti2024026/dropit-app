export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const getToken = () => localStorage.getItem("token");

export const authHeaders = () => {
  const token = getToken();
  return token ? { Authorization: token } : {};
};

// Turn an axios/fetch error into one readable sentence
export const errorMessage = (error, fallback = "Something went wrong") =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.message ||
  fallback;

// Free hosting puts the server to sleep after ~15 idle minutes and the first request
// can take up to a minute. Pinging it as soon as the app opens hides most of that wait.
// The health reply also carries the server's real upload limit, so the site never
// sends a file through the server that the server would refuse.
let serverLimits = null;
const limitListeners = new Set();

export const wakeServer = () => {
  fetch(`${API_URL}/api/health`)
    .then((response) => (response.ok ? response.json() : null))
    .then((health) => {
      if (!health?.maxFileBytes) return;
      serverLimits = { maxFileBytes: health.maxFileBytes, retentionDays: health.retentionDays };
      limitListeners.forEach((listener) => listener(serverLimits));
    })
    .catch(() => {});
};

export const getServerLimits = () => serverLimits;
export const onServerLimits = (listener) => {
  limitListeners.add(listener);
  return () => limitListeners.delete(listener);
};

// While someone has DropIt open, ping every 5 minutes so the free server never falls asleep
// in the middle of a session (it sleeps after 15 idle minutes).
export const keepServerAwake = () => {
  wakeServer();
  setInterval(() => {
    if (document.visibilityState === "visible") wakeServer();
  }, 5 * 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") wakeServer();
  });
};
