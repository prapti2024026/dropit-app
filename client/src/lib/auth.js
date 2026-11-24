// Account rules for the sign-up form. They mirror server/auth.js; the server checks again.
import { API_URL } from "./api";

export const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._]{1,18}[a-z0-9])?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const PASSWORD_RULES = [
  { id: "length", test: (p) => p.length >= 8 && p.length <= 128, text: "At least 8 characters" },
  { id: "lower", test: (p) => /[a-z]/.test(p), text: "One lowercase letter" },
  { id: "upper", test: (p) => /[A-Z]/.test(p), text: "One uppercase letter" },
  { id: "number", test: (p) => /\d/.test(p), text: "One number" },
  { id: "symbol", test: (p) => /[^A-Za-z0-9]/.test(p), text: "One symbol (e.g. ! @ # $)" }
];

export const usernameProblem = (value) => {
  const username = value.trim().toLowerCase();
  if (!username) return "Username is required";
  if (username.length < 3 || username.length > 20) return "3-20 characters";
  if (!USERNAME_RE.test(username)) return "Use a-z, 0-9, dot or underscore; start and end with a letter or number";
  return null;
};

export const emailProblem = (value) => {
  const email = value.trim();
  if (!email) return "Email is required";
  if (!EMAIL_RE.test(email)) return "Enter a valid email address";
  return null;
};

export const passwordProblem = (password, { username = "", email = "" } = {}) => {
  if (!password) return "Password is required";
  if (PASSWORD_RULES.some((rule) => !rule.test(password))) return "Password does not meet all the rules";
  const lower = password.toLowerCase();
  const name = username.trim().toLowerCase();
  const local = email.trim().toLowerCase().split("@")[0];
  if ((name.length >= 3 && lower.includes(name)) || (local.length >= 3 && lower.includes(local))) {
    return "Password must not contain your username or email";
  }
  return null;
};

// 0-4 score for the strength bar: rules passed, plus a bonus for length
export const passwordScore = (password) => {
  if (!password) return 0;
  const passed = PASSWORD_RULES.filter((rule) => rule.test(password)).length;
  let score = passed <= 2 ? 1 : passed === 3 || passed === 4 ? 2 : 3;
  if (passed === PASSWORD_RULES.length && password.length >= 12) score = 4;
  return score;
};

export const STRENGTH_LABELS = ["", "Weak", "Fair", "Good", "Strong"];

// Public auth settings from the server (Google client ID). Cached for the page's lifetime.
let configPromise = null;
export const loadAuthConfig = () => {
  if (!configPromise) {
    configPromise = fetch(`${API_URL}/api/auth/config`)
      .then((response) => (response.ok ? response.json() : {}))
      .catch(() => ({}))
      .then((config) => {
        if (!config.googleClientId) configPromise = null; // try again next time the form opens
        return config;
      });
  }
  return configPromise;
};

// Google Identity Services script, loaded once on demand
let gisPromise = null;
export const loadGoogleScript = () => {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(window.google);
      script.onerror = () => {
        gisPromise = null;
        reject(new Error("Could not load Google sign-in"));
      };
      document.head.appendChild(script);
    });
  }
  return gisPromise;
};

export const saveSession = ({ token, user }) => {
  localStorage.setItem("token", token);
  localStorage.setItem("userId", user.id);
};
