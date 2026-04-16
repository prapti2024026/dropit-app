import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, LogOut, User } from 'lucide-react';
import Login from './Login';
import './NavBar.css';

const NavBar = ({ isLoggedIn = false, onLogin, onLogout }) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      console.log('Searching for:', searchQuery);
      // Add search functionality here
    }
  };

  const handleLogout = async () => {
    setShowUserMenu(false);
    const token = localStorage.getItem('token');
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': token
        }
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local state
      localStorage.removeItem('token');
      if (onLogout) {
        onLogout();
      }
      navigate('/');
    }
  };

  return (
    <nav className="navbar-container">
      <div className="navbar-content">
        {/* Logo/Brand */}
        <div className="navbar-brand">
          <div className="brand-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="14" fill="url(#gradient)" stroke="#fff" strokeWidth="2"/>
              <path d="M16 8V16M16 16L12 12M16 16L20 12" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 20H20" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
              <defs>
                <linearGradient id="gradient" x1="0" y1="0" x2="32" y2="32">
                  <stop offset="0%" stopColor="#6366f1"/>
                  <stop offset="100%" stopColor="#8b5cf6"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="brand-text">DropIt</span>
        </div>

        {/* Search Bar */}
        <form className="navbar-search" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="search-btn">
            <Search size={20} />
          </button>
        </form>

        {/* Navigation Links */}
        <div className="navbar-links">
          <button
            className="nav-link"
            onClick={() => navigate('/home')}
          >
            Home
          </button>
          <button
            className="nav-link"
            onClick={() => navigate('/home')}
          >
            Upload
          </button>
          <button
            className="nav-link"
            onClick={() => navigate('/drop')}
          >
            Drop
          </button>
          <button
            className="nav-link"
            onClick={() => navigate('/history')}
          >
            History
          </button>
        </div>

        {/* User Actions */}
        <div className="navbar-actions">
          {!isLoggedIn && (
            <button
              className="login-btn"
              onClick={() => setIsLoginModalOpen(true)}
            >
              Login
            </button>
          )}
          {isLoggedIn && (
            <div className="user-menu">
              <button
                className="user-btn"
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                <User size={20} />
              </button>
              {showUserMenu && (
                <div className="user-menu-dropdown">
                  <button className="menu-item" onClick={handleLogout}>
                    <LogOut size={18} />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <Login
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLogin={(user) => {
          setIsLoginModalOpen(false);
          if (onLogin) onLogin(user);
        }}
      />
    </nav>
  );
};

export default NavBar;
