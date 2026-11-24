// Account rules shared by the auth routes: input validation, password policy,
// Google ID-token checks, username generation and a small login rate limiter.
import { OAuth2Client } from "google-auth-library";

export const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._]{1,18}[a-z0-9])?$/; // 3-20 chars, no dot/underscore at the ends
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
export const normalizeUsername = (value) => String(value || "").trim().toLowerCase();

export const validateEmail = (email) => {
  if (!email) return "Email is required";
  if (email.length > 254 || !EMAIL_RE.test(email)) return "Enter a valid email address";
  return null;
};

export const validateUsername = (username) => {
  if (!username) return "Username is required";
  if (username.length < 3 || username.length > 20) return "Username must be 3-20 characters";
  if (!USERNAME_RE.test(username)) {
    return "Username can use lowercase letters, numbers, dot and underscore, and must start and end with a letter or number";
  }
  return null;
};

// Same rules the sign-up form shows as a checklist
export const PASSWORD_RULES = [
  { id: "length", test: (p) => p.length >= 8 && p.length <= 128, text: "8-128 characters" },
  { id: "lower", test: (p) => /[a-z]/.test(p), text: "a lowercase letter" },
  { id: "upper", test: (p) => /[A-Z]/.test(p), text: "an uppercase letter" },
  { id: "number", test: (p) => /\d/.test(p), text: "a number" },
  { id: "symbol", test: (p) => /[^A-Za-z0-9]/.test(p), text: "a symbol" }
];

export const validatePassword = (password, { username = "", email = "" } = {}) => {
  if (typeof password !== "string" || !password) return "Password is required";
  const missing = PASSWORD_RULES.filter((rule) => !rule.test(password)).map((rule) => rule.text);
  if (missing.length) return `Password needs ${missing.join(", ")}`;
  const lower = password.toLowerCase();
  const local = email.split("@")[0];
  if ((username && username.length >= 3 && lower.includes(username)) || (local && local.length >= 3 && lower.includes(local))) {
    return "Password must not contain your username or email";
  }
  return null;
};

// ---------- Google sign-in ----------

const googleClient = new OAuth2Client();

export const googleClientId = () => (process.env.GOOGLE_CLIENT_ID || "").trim();

// Checks the ID token the Google button gave the browser. Throws on anything suspicious.
export const verifyGoogleCredential = async (credential) => {
  const audience = googleClientId();
  if (!audience) throw Object.assign(new Error("Google sign-in is not configured on the server"), { status: 503 });
  if (!credential || typeof credential !== "string") throw Object.assign(new Error("Missing Google credential"), { status: 400 });

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience });
    payload = ticket.getPayload();
  } catch {
    throw Object.assign(new Error("Google sign-in failed. Please try again."), { status: 401 });
  }

  if (!payload?.sub || !payload.email) throw Object.assign(new Error("Google did not share an email address"), { status: 401 });
  if (!payload.email_verified) throw Object.assign(new Error("This Google email is not verified"), { status: 401 });

  return {
    googleId: payload.sub,
    email: normalizeEmail(payload.email),
    name: payload.name || "",
    avatar: payload.picture || ""
  };
};

// Turn "Rahim.Uddin+x@gmail.com" into a free username like "rahim.uddin" or "rahim.uddin7"
export const generateUsername = async (User, email, name = "") => {
  const fromEmail = email.split("@")[0].split("+")[0];
  let base = (fromEmail || name || "user").toLowerCase().replace(/[^a-z0-9._]/g, "").replace(/^[._]+|[._]+$/g, "");
  if (base.length < 3) base = `${base}user`.slice(0, 8);
  base = base.slice(0, 16).replace(/[._]+$/g, "");

  if (!(await User.exists({ username: base }))) return base;
  for (let i = 0; i < 20; i += 1) {
    const candidate = `${base}${Math.floor(10 + Math.random() * 9990)}`;
    if (!(await User.exists({ username: candidate }))) return candidate;
  }
  return `${base.slice(0, 10)}${Date.now().toString(36)}`;
};

// ---------- rate limit ----------

// In-memory limiter: fine for one free server instance. Blocks password guessing.
export const createRateLimiter = ({ windowMs = 15 * 60 * 1000, max = 10 } = {}) => {
  const hits = new Map();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }, windowMs);
  timer.unref?.();

  return {
    // Returns seconds to wait, or 0 if allowed
    check(key) {
      const now = Date.now();
      const entry = hits.get(key);
      if (!entry || entry.resetAt <= now) return 0;
      return entry.count >= max ? Math.ceil((entry.resetAt - now) / 1000) : 0;
    },
    fail(key) {
      const now = Date.now();
      const entry = hits.get(key);
      if (!entry || entry.resetAt <= now) hits.set(key, { count: 1, resetAt: now + windowMs });
      else entry.count += 1;
    },
    clear(key) {
      hits.delete(key);
    }
  };
};
