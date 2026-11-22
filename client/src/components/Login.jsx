import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Login.css';

const Login = ({ isOpen, onClose, onLogin }) => {
  const [isSignUp, setIsSignUp] = useState(false);

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setErrorMsg('');
    setLoading(true);
    setSlow(false);
    // The free server sleeps after 15 min idle; tell the user if it is waking up
    const slowTimer = setTimeout(() => setSlow(true), 4000);

    try {
      const endpoint = isSignUp
        ? '/api/auth/register'
        : '/api/auth/login';

      const payload = isSignUp
        ? {
            username: formData.username.trim(),
            email: formData.email.trim().toLowerCase(),
            password: formData.password
          }
        : {
            usernameOrEmail: formData.username.trim(),
            password: formData.password
          };

      const res = await axios.post(
        `${API_URL}${endpoint}`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 90000
        }
      );

      localStorage.setItem('token', res.data.token);
      localStorage.setItem('userId', res.data.user.id);

      if (onLogin) {
        onLogin(res.data.user);
      }

      onClose();

    } catch (error) {
      console.error('Login/register error:', error);
      let message =
        error.response?.data?.message ||
        error.response?.data?.error;
      if (!message) {
        message = error.code === 'ECONNABORTED'
          ? 'Server did not respond. Please try again in a minute.'
          : 'Cannot reach the server. Check your internet and try again.';
      }
      if (message === 'Invalid credentials') {
        message = 'Wrong username/email or password. New here? Create an account first.';
      }
      setErrorMsg(message);
    } finally {
      clearTimeout(slowTimer);
      setLoading(false);
      setSlow(false);
    }
  };

  const status = (
    <>
      {loading && slow && (
        <p className="login-status">Server is waking up, this can take up to a minute...</p>
      )}
      {errorMsg && <p className="login-error" role="alert">{errorMsg}</p>}
    </>
  );

  const handleSignUpClick = () => { setIsSignUp(true); setErrorMsg(''); };
  const handleSignInClick = () => { setIsSignUp(false); setErrorMsg(''); };

  // Prevent body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="login-modal-overlay" onClick={onClose}>
      <div
        className="login-container-wrapper"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="login-close-btn" onClick={onClose}>✕</button>

        <div className={`login-form-container ${isSignUp ? 'right-panel-active' : ''}`}>

          {/* SIGN IN */}
          <div className="login-form sign-in-container">
            <form onSubmit={handleSubmit}>
              <h1>Login</h1>

              <span>Use your username or email to sign in</span>

              <div className="input-field">
                <i className="fas fa-user"></i>
                <input
                  type="text"
                  name="username"
                  placeholder="Email or Username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={formData.username}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="input-field">
                <i className="fas fa-lock"></i>
                <input
                  type="password"
                  name="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                  required
                />
              </div>

              <button type="submit" disabled={loading}>
                {loading && !isSignUp ? 'Please wait...' : 'Sign In'}
              </button>
              {!isSignUp && status}
              <p className="login-switch">
                No account?{' '}
                <button type="button" className="link-btn" onClick={handleSignUpClick}>
                  Create one
                </button>
              </p>
            </form>
          </div>

          {/* SIGN UP */}
          <div className="login-form sign-up-container">
            <form onSubmit={handleSubmit}>
              <h1>Create Account</h1>

              <span>Or use your email for registration</span>

              <div className="input-field">
                <i className="fas fa-user"></i>
                <input
                  type="text"
                  name="username"
                  placeholder="Username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={formData.username}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="input-field">
                <i className="fas fa-envelope"></i>
                <input
                  type="email"
                  name="email"
                  placeholder="Email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="input-field">
                <i className="fas fa-lock"></i>
                <input
                  type="password"
                  name="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  minLength={4}
                  required
                />
              </div>

              <button type="submit" disabled={loading}>
                {loading && isSignUp ? 'Please wait...' : 'Sign Up'}
              </button>
              {isSignUp && status}
              <p className="login-switch">
                Already have an account?{' '}
                <button type="button" className="link-btn" onClick={handleSignInClick}>
                  Sign in
                </button>
              </p>
            </form>
          </div>

          {/* OVERLAY */}
          <div className="overlay-container">
            <div className="overlay">

              <div className="overlay-panel overlay-left">
                <h1>Welcome Back!</h1>
                <p>To keep connected with us please login</p>
                <button className="ghost-btn" onClick={handleSignInClick}>
                  Sign In
                </button>
              </div>

              <div className="overlay-panel overlay-right">
                <h1>Hello, Friend!</h1>
                <p>Enter your details and start journey</p>
                <button className="ghost-btn" onClick={handleSignUpClick}>
                  Sign Up
                </button>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Login;