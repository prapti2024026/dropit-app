import { useCallback, useEffect, useId, useRef, useState } from "react";
import axios from "axios";
import { AtSign, Check, Eye, EyeOff, Loader2, Lock, Mail, User, X } from "lucide-react";
import BrandMark from "./BrandMark";
import { API_URL, authHeaders } from "../lib/api";
import {
  PASSWORD_RULES,
  STRENGTH_LABELS,
  emailProblem,
  loadAuthConfig,
  loadGoogleScript,
  passwordProblem,
  passwordScore,
  saveSession,
  usernameProblem
} from "../lib/auth";
import "./Login.css";

const EMPTY = { identifier: "", username: "", email: "", password: "", confirm: "" };

const friendlyError = (error) => {
  const message = error?.response?.data?.error || error?.response?.data?.message;
  if (message === "Invalid credentials") return "Incorrect username/email or password.";
  if (message) return message;
  if (error?.code === "ECONNABORTED") return "The server did not respond. Please try again in a minute.";
  return "Cannot reach the server. Check your internet connection and try again.";
};

// Text field with a label, a leading icon, optional show/hide and an inline message
const Field = ({ label, icon, error, hint, trailing, inputRef, ...input }) => {
  const id = useId();
  return (
    <div className={`auth-field ${error ? "has-error" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <div className="auth-input">
        {icon}
        <input id={id} ref={inputRef} aria-invalid={Boolean(error)} aria-describedby={`${id}-msg`} {...input} />
        {trailing}
      </div>
      <p id={`${id}-msg`} className={error ? "auth-msg error" : "auth-msg"}>
        {error || hint || ""}
      </p>
    </div>
  );
};

const PasswordToggle = ({ shown, onToggle }) => (
  <button
    type="button"
    className="auth-eye"
    onClick={onToggle}
    aria-label={shown ? "Hide password" : "Show password"}
    tabIndex={-1}
  >
    {shown ? <EyeOff size={18} /> : <Eye size={18} />}
  </button>
);

const Login = ({ isOpen, onClose, onLogin, initialMode = "signin" }) => {
  const [mode, setMode] = useState(initialMode); // signin | signup | username
  const [form, setForm] = useState(EMPTY);
  const [touched, setTouched] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  const [formError, setFormError] = useState("");
  const [usernameCheck, setUsernameCheck] = useState({ state: "idle", reason: "" }); // idle | checking | ok | taken
  const [googleState, setGoogleState] = useState("loading"); // loading | ready | off
  const [pendingSession, setPendingSession] = useState(null); // after a new Google sign-up

  const googleBox = useRef(null);
  const firstInput = useRef(null);
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setFormError("");
  };
  const touch = (key) => () => setTouched((current) => ({ ...current, [key]: true }));

  const switchMode = (next) => {
    setMode(next);
    setFormError("");
    setTouched({});
    setShowPassword(false);
    setForm((current) => ({ ...EMPTY, identifier: current.identifier, email: current.email }));
  };

  const finish = useCallback(
    (session) => {
      saveSession(session);
      onLogin?.(session.user);
      setForm(EMPTY);
      setPendingSession(null);
      setMode("signin");
      onClose?.();
    },
    [onLogin, onClose]
  );

  // Shared wrapper: spinner, "server is waking up" note and error text
  const run = useCallback(async (task) => {
    setLoading(true);
    setFormError("");
    const slowTimer = setTimeout(() => setSlow(true), 4000);
    try {
      await task();
    } catch (error) {
      console.error("Auth error:", error);
      setFormError(friendlyError(error));
    } finally {
      clearTimeout(slowTimer);
      setLoading(false);
      setSlow(false);
    }
  }, []);

  // ----- Google -----
  const handleGoogleCredential = useCallback(
    (response) =>
      run(async () => {
        const { data } = await axios.post(
          `${API_URL}/api/auth/google`,
          { credential: response.credential },
          { timeout: 90000 }
        );
        if (data.isNew) {
          // Let the new user confirm or change the username others will send files to
          saveSession(data);
          setPendingSession(data);
          setForm((current) => ({ ...current, username: data.user.username }));
          setUsernameCheck({ state: "ok", reason: "" });
          setMode("username");
          return;
        }
        finish(data);
      }),
    [run, finish]
  );

  useEffect(() => {
    if (!isOpen || mode === "username") return undefined;
    let cancelled = false;

    (async () => {
      const config = await loadAuthConfig();
      if (cancelled) return;
      if (!config.googleClientId) {
        setGoogleState("off");
        return;
      }
      try {
        const google = await loadGoogleScript();
        if (cancelled || !googleBox.current) return;
        google.accounts.id.initialize({
          client_id: config.googleClientId,
          callback: handleGoogleCredential,
          ux_mode: "popup",
          auto_select: false,
          cancel_on_tap_outside: true,
          context: modeRef.current === "signup" ? "signup" : "signin"
        });
        const width = Math.min(400, Math.max(220, Math.floor(googleBox.current.offsetWidth || 320)));
        googleBox.current.innerHTML = "";
        google.accounts.id.renderButton(googleBox.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "pill",
          text: mode === "signup" ? "signup_with" : "continue_with",
          logo_alignment: "left",
          width
        });
        setGoogleState("ready");
      } catch {
        if (!cancelled) setGoogleState("off");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, mode, handleGoogleCredential]);

  // ----- live username availability (sign-up and the post-Google step) -----
  useEffect(() => {
    if (!isOpen || (mode !== "signup" && mode !== "username")) return undefined;
    const name = form.username.trim().toLowerCase();
    if (!name || usernameProblem(name)) {
      // Syncing local status with the input; nothing to ask the server
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUsernameCheck({ state: "idle", reason: "" });
      return undefined;
    }
    if (mode === "username" && pendingSession && name === pendingSession.user.username) {
      setUsernameCheck({ state: "ok", reason: "" });
      return undefined;
    }
    setUsernameCheck({ state: "checking", reason: "" });
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const { data } = await axios.get(`${API_URL}/api/auth/username-available`, {
          params: { u: name },
          signal: controller.signal
        });
        setUsernameCheck({ state: data.available ? "ok" : "taken", reason: data.reason || "" });
      } catch (error) {
        if (!axios.isCancel(error)) setUsernameCheck({ state: "idle", reason: "" });
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [form.username, mode, isOpen, pendingSession]);

  // ----- modal behaviour: lock scroll, Esc to close, focus first field -----
  useEffect(() => {
    if (!isOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event) => {
      if (event.key === "Escape" && !loading && mode !== "username") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    const focusTimer = setTimeout(() => firstInput.current?.focus(), 50);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
      clearTimeout(focusTimer);
    };
  }, [isOpen, mode, loading, onClose]);

  if (!isOpen) return null;

  // ----- validation -----
  const errors = {
    identifier: !form.identifier.trim() ? "Enter your username or email" : null,
    signinPassword: !form.password ? "Enter your password" : null,
    username: usernameProblem(form.username) || (usernameCheck.state === "taken" ? usernameCheck.reason : null),
    email: emailProblem(form.email),
    password: passwordProblem(form.password, { username: form.username, email: form.email }),
    confirm: !form.confirm ? "Confirm your password" : form.confirm !== form.password ? "Passwords do not match" : null
  };
  const show = (key, errorKey = key) => (touched[key] ? errors[errorKey] : null);

  const submitSignIn = (event) => {
    event.preventDefault();
    setTouched({ identifier: true, password: true });
    if (errors.identifier || errors.signinPassword || loading) return;
    run(async () => {
      const { data } = await axios.post(
        `${API_URL}/api/auth/login`,
        { usernameOrEmail: form.identifier.trim(), password: form.password },
        { timeout: 90000 }
      );
      finish(data);
    });
  };

  const submitSignUp = (event) => {
    event.preventDefault();
    setTouched({ username: true, email: true, password: true, confirm: true });
    if (errors.username || errors.email || errors.password || errors.confirm || loading) return;
    run(async () => {
      const { data } = await axios.post(
        `${API_URL}/api/auth/register`,
        {
          username: form.username.trim().toLowerCase(),
          email: form.email.trim().toLowerCase(),
          password: form.password
        },
        { timeout: 90000 }
      );
      finish(data);
    });
  };

  const submitUsername = (event) => {
    event.preventDefault();
    setTouched({ username: true });
    if (errors.username || loading || !pendingSession) return;
    const name = form.username.trim().toLowerCase();
    if (name === pendingSession.user.username) {
      finish(pendingSession);
      return;
    }
    run(async () => {
      const { data } = await axios.patch(
        `${API_URL}/api/auth/me`,
        { username: name },
        { headers: authHeaders(), timeout: 90000 }
      );
      finish({ ...pendingSession, user: data.user });
    });
  };

  const score = passwordScore(form.password);
  const usernameTrailing =
    usernameCheck.state === "checking" ? (
      <Loader2 size={16} className="auth-spin auth-trail" aria-label="Checking" />
    ) : usernameCheck.state === "ok" && !usernameProblem(form.username) ? (
      <Check size={16} className="auth-trail ok" aria-label="Available" />
    ) : usernameCheck.state === "taken" ? (
      <X size={16} className="auth-trail bad" aria-label="Taken" />
    ) : null;

  const status = (
    <div aria-live="polite">
      {loading && slow && <p className="auth-note">The server is waking up. This can take up to a minute…</p>}
      {formError && (
        <p className="auth-alert" role="alert">
          {formError}
        </p>
      )}
    </div>
  );

  const submitLabel = (text) =>
    loading ? (
      <>
        <Loader2 size={18} className="auth-spin" /> Please wait…
      </>
    ) : (
      text
    );

  const googleSection = (
    <>
      <div className={`auth-google ${googleState}`}>
        <div ref={googleBox} className="auth-google-btn" />
        {googleState === "loading" && <div className="auth-google-placeholder">Loading Google sign-in…</div>}
      </div>
      {googleState !== "off" && (
        <div className="auth-divider">
          <span>or use your email</span>
        </div>
      )}
    </>
  );

  return (
    <div
      className="auth-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading && mode !== "username") onClose?.();
      }}
    >
      <div className="auth-card" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        {mode !== "username" && (
          <button type="button" className="auth-close" onClick={onClose} aria-label="Close" disabled={loading}>
            <X size={20} />
          </button>
        )}

        <div className="auth-brand">
          <BrandMark size={36} />
          <span>DropIt</span>
        </div>

        {mode === "username" ? (
          <form onSubmit={submitUsername} noValidate>
            <h2 id="auth-title">Choose your username</h2>
            <p className="auth-sub">
              Signed in as <strong>{pendingSession?.user.email}</strong>. People type your username to send you
              files.
            </p>
            <Field
              label="Username"
              icon={<AtSign size={18} aria-hidden="true" />}
              inputRef={firstInput}
              value={form.username}
              onChange={set("username")}
              onBlur={touch("username")}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={20}
              error={show("username")}
              hint="3-20 characters: a-z, 0-9, dot or underscore"
              trailing={usernameTrailing}
            />
            {status}
            <button type="submit" className="auth-submit" disabled={loading || usernameCheck.state === "checking"}>
              {submitLabel("Continue")}
            </button>
          </form>
        ) : (
          <>
            <h2 id="auth-title">{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
            <p className="auth-sub">
              {mode === "signin"
                ? "Sign in to send and receive files with a gesture."
                : "Use your Google account, or sign up with email and a strong password."}
            </p>

            <div className="auth-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signin"}
                className={mode === "signin" ? "active" : ""}
                onClick={() => switchMode("signin")}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signup"}
                className={mode === "signup" ? "active" : ""}
                onClick={() => switchMode("signup")}
              >
                Sign up
              </button>
            </div>

            {googleSection}

            {mode === "signin" ? (
              <form onSubmit={submitSignIn} noValidate>
                <Field
                  label="Username or email"
                  icon={<User size={18} aria-hidden="true" />}
                  inputRef={firstInput}
                  value={form.identifier}
                  onChange={set("identifier")}
                  onBlur={touch("identifier")}
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  error={show("identifier")}
                />
                <Field
                  label="Password"
                  icon={<Lock size={18} aria-hidden="true" />}
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={set("password")}
                  onBlur={touch("password")}
                  autoComplete="current-password"
                  error={show("password", "signinPassword")}
                  trailing={<PasswordToggle shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
                />
                {status}
                <button type="submit" className="auth-submit" disabled={loading}>
                  {submitLabel("Sign in")}
                </button>
                <p className="auth-switch">
                  New to DropIt?{" "}
                  <button type="button" onClick={() => switchMode("signup")}>
                    Create an account
                  </button>
                </p>
              </form>
            ) : (
              <form onSubmit={submitSignUp} noValidate>
                <Field
                  label="Username"
                  icon={<AtSign size={18} aria-hidden="true" />}
                  inputRef={firstInput}
                  value={form.username}
                  onChange={set("username")}
                  onBlur={touch("username")}
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={20}
                  error={show("username") || (usernameCheck.state === "taken" ? usernameCheck.reason : null)}
                  hint="Others type this to send you files"
                  trailing={usernameTrailing}
                />
                <Field
                  label="Email"
                  icon={<Mail size={18} aria-hidden="true" />}
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  onBlur={touch("email")}
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  error={show("email")}
                />
                <Field
                  label="Password"
                  icon={<Lock size={18} aria-hidden="true" />}
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={set("password")}
                  onBlur={touch("password")}
                  autoComplete="new-password"
                  maxLength={128}
                  error={
                    touched.password && errors.password !== "Password does not meet all the rules"
                      ? errors.password
                      : null
                  }
                  trailing={<PasswordToggle shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
                />

                {form.password && (
                  <div className="auth-strength" aria-live="polite">
                    <div className={`auth-meter s${score}`}>
                      {[1, 2, 3, 4].map((step) => (
                        <span key={step} className={score >= step ? "on" : ""} />
                      ))}
                    </div>
                    <span className={`auth-meter-label s${score}`}>{STRENGTH_LABELS[score]}</span>
                  </div>
                )}
                <ul className="auth-rules">
                  {PASSWORD_RULES.map((rule) => {
                    const ok = rule.test(form.password);
                    return (
                      <li key={rule.id} className={ok ? "ok" : touched.password ? "bad" : ""}>
                        {ok ? <Check size={14} /> : <span className="dot" />} {rule.text}
                      </li>
                    );
                  })}
                </ul>

                <Field
                  label="Confirm password"
                  icon={<Lock size={18} aria-hidden="true" />}
                  type={showPassword ? "text" : "password"}
                  value={form.confirm}
                  onChange={set("confirm")}
                  onBlur={touch("confirm")}
                  autoComplete="new-password"
                  maxLength={128}
                  error={show("confirm")}
                />
                {status}
                <button type="submit" className="auth-submit" disabled={loading}>
                  {submitLabel("Create account")}
                </button>
                <p className="auth-switch">
                  Already have an account?{" "}
                  <button type="button" onClick={() => switchMode("signin")}>
                    Sign in
                  </button>
                </p>
              </form>
            )}
          </>
        )}

        <p className="auth-legal">
          By continuing you agree to the{" "}
          <a href="/terms.html" target="_blank" rel="noopener noreferrer">
            Terms
          </a>{" "}
          and{" "}
          <a href="/privacy.html" target="_blank" rel="noopener noreferrer">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
};

export default Login;
