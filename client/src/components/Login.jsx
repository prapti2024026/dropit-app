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

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const endpoint = isSignUp
        ? '/api/auth/register'
        : '/api/auth/login';

      const payload = isSignUp
        ? formData
        : {
            usernameOrEmail: formData.username,
            password: formData.password
          };

      const res = await axios.post(
        `${API_URL}${endpoint}`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json'
          }
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
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Error occurred';
      alert(message);
    }
  };

  const handleSignUpClick = () => setIsSignUp(true);
  const handleSignInClick = () => setIsSignUp(false);

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
                  required
                />
              </div>

              <button type="submit">Sign In</button>
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
                  required
                />
              </div>

              <button type="submit">Sign Up</button>
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