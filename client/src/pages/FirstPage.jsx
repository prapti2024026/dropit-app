import React, { useState } from 'react';
import './FirstPage.css';
import SampleVideo from './Sample_video.mp4';

import Login from "../components/Login"; // 🔥 ADD THIS

const FirstPage = ({ onLogin }) => {
  // 🔥 login modal state
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  return (
    <div className="welcome-page-container">

      {/* LOGIN COMPONENT */}
      <Login
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLogin={onLogin}
      />

      <video className="welcome-background-video" autoPlay loop muted playsInline>
        <source src={SampleVideo} type="video/mp4" />
      </video>

      {/* Left Section */}
      <div className="welcome-left-section">
        <div className="welcome-content-box">

          <h1 className="welcome-main-title">
            <span className="welcome-title-highlight">DropIt</span>
          </h1>

          <p className="welcome-subtitle">
            Experience the Future of File Sharing with Gesture Recognition
          </p>

          {/* 🔥 CHANGE BUTTON */}
          <button
            className="welcome-cta-btn"
            onClick={() => setIsLoginOpen(true)}
          >
            <span className="btn-text">Share File Now</span>
            <span className="btn-icon">→</span>
          </button>

        </div>

        <div className="animated-card">
          <h2></h2>
          <p>
            Gesture <br />
            Touchless <br />
            High-Speed Transfer <br />
            Real-Time Tracking <br />
            Transfer History <br />
            Device Recognition <br />
            User-Friendly Interface <br />
          </p>
        </div>

      </div>
    </div>
  );
};

export default FirstPage;
