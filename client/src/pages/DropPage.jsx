import { ArrowDown } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

import './DropPage.css';
import SampleVideo from './Sample_video.mp4';
import facebookImg from './vecteezy_facebook-logo-png-facebook-icon-transparent-white-background_41643208.png';
import instagramImg from './vecteezy_instagram-logo-png-instagram-icon-transparent_18930413.png';
import linkedinImg from './vecteezy_linkedin-logo-png-linkedin-icon-transparent-png_18930480.png';
import twitterImg from './vecteezy_twitter-png-icon_16716486.png';
import NavBar from '../components/NavBar';

const DROP_COOLDOWN = 10000;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const CONFIDENCE_THRESHOLD = 0.7;

const DropPage = ({ currentGesture, gestureConfidence, user, onLogout }) => {
  const [receivedImage, setReceivedImage] = useState(null);
  const [isDropping, setIsDropping] = useState(false);
  const [hasDropped, setHasDropped] = useState(false);

  const lastDropTime = useRef(0);

  // 🔥 GET TOKEN
  const getToken = () => localStorage.getItem("token");

  const handleDrop = useCallback(async () => {
    if (isDropping || hasDropped) return;

    lastDropTime.current = Date.now();
    setIsDropping(true);

    try {
      const token = getToken();
      if (!token) {
        throw new Error('No auth token found. Please login and try again.');
      }

      let receiverId = localStorage.getItem('userId');

      if (!receiverId) {
        const verifyResponse = await axios.get(`${API_URL}/api/auth/verify`, {
          headers: {
            Authorization: token
          }
        });
        receiverId = verifyResponse.data.user?.id;
        if (receiverId) {
          localStorage.setItem('userId', receiverId);
        }
      }

      if (!receiverId) {
        throw new Error('Receiver ID not found. Please login again.');
      }

      const response = await axios.get(
        `${API_URL}/api/drop/${receiverId}`,
        {
          headers: {
            Authorization: token
          }
        }
      );

      const data = response.data;

      if (data.success && data.imagePath) {
        console.log(`${API_URL}${data.imagePath}`);

        setTimeout(() => {
          setReceivedImage(`${API_URL}${data.imagePath}`);
          setIsDropping(false);
          setHasDropped(true);
        }, 1000);

      } else {
        setTimeout(() => {
          setIsDropping(false);
          alert('No image available: ' + data.message);
        }, 2000);
      }

    } catch (error) {
      console.error(error);

      setTimeout(() => {
        setIsDropping(false);
        alert('Drop error: ' + error.message);
      }, 2000);
    }
  }, [isDropping, hasDropped]);

  useEffect(() => {
    const timeSinceLastDrop = Date.now() - lastDropTime.current;

    if (
      currentGesture === 'drop' &&
      gestureConfidence > CONFIDENCE_THRESHOLD &&
      !isDropping &&
      !hasDropped &&
      !receivedImage &&
      timeSinceLastDrop > DROP_COOLDOWN
    ) {
      handleDrop();
    }
  }, [
    currentGesture,
    gestureConfidence,
    isDropping,
    hasDropped,
    receivedImage,
    handleDrop
  ]);

  return (
    <>
      <NavBar isLoggedIn={Boolean(user)} onLogout={onLogout} />

      <video className="background-video" autoPlay loop muted playsInline>
        <source src={SampleVideo} type="video/mp4" />
      </video>

      <div className="background-overlay"></div>

      <div className="drop-page-container">

        {!receivedImage ? (
          <div className="drop-page-content">

            {currentGesture === 'drop' ? (
              <div className="drop-zone-area">
                <div className="drop-pulse-circle">
                  <div className="drop-pulse-inner"></div>
                </div>
              </div>
            ) : (
              <div className="glass-effect-drop">
                <h1 className="drop-page-title">Drop Zone</h1>
                <p className="drop-page-subtitle">
                  Make a <strong>"DROP"</strong> gesture
                </p>

                <div className="drop-zone-area">
                  <ArrowDown className="drop-zone-icon" />
                  <span className="drop-zone-text">
                    Waiting for drop gesture....
                  </span>
                </div>
              </div>
            )}

          </div>
        ) : (
          <div style={{ position: 'relative', width: '100%', height: '100vh' }}>

            {isDropping && (
              <div className="drop-dropping-overlay">
                <div className="drop-animate-ping"></div>
                <div className="drop-animate-bounce"></div>
              </div>
            )}

            <img
              src={receivedImage}
              alt="Received"
              className="drop-received-image"
            />

            <button
              onClick={() => {
                setReceivedImage(null);
                setHasDropped(false);
              }}
              className="drop-close-btn"
            >
              Close
            </button>

          </div>
        )}

      </div>

      {/* Footer unchanged */}
      <footer className="footer-section">
        <div className="footer-container">
          <section className="about-us-section">
            <div className="about-container">
              <div className="about-text">
                <h3>About DropIt</h3>
                <p>
                  DropIt is a revolutionary file-sharing platform powered by gesture recognition technology.
                  We enable touchless, high-speed file transfers with real-time tracking and device recognition.
                  Experience the future of secure and efficient file sharing.
                </p>
              </div>
            </div>
          </section>

          <div className="footer-content">
            <div className="footer-column">
              <h5>Features</h5>
              <ul className="footer-links">
                <li><a href="#gesture">Gesture Recognition</a></li>
                <li><a href="#transfer">High-Speed Transfer</a></li>
                <li><a href="#history">Transfer History</a></li>
                <li><a href="#security">Secure Sharing</a></li>
              </ul>
            </div>

            <div className="footer-column">
              <h5>Quick Links</h5>
              <ul className="footer-links">
                <li><a href="/">Home</a></li>
                <li><a href="/home">Upload</a></li>
                <li><a href="/drop">Drop</a></li>
                <li><a href="/history">History</a></li>
              </ul>
            </div>

            <div className="footer-column">
              <h5>Contact Us</h5>
              <div className="contact-info">
                <p><strong>Email:</strong> jamilahmed9500@gmail.com</p>
                <p><strong>Phone:</strong> +88001732856095</p>
                <p><strong>Address:</strong> PAJAMA TECH , Dhaka City</p>
              </div>
            </div>

            <div className="footer-column">
              <h5>Follow Us</h5>
              <div className="social-links">
                <a href="#facebook" className="social-icon">
                  <img src={facebookImg} alt="Facebook" />
                </a>
                <a href="#twitter" className="social-icon">
                  <img src={twitterImg} alt="Twitter" />
                </a>
                <a href="#linkedin" className="social-icon">
                  <img src={linkedinImg} alt="LinkedIn" />
                </a>
                <a href="#instagram" className="social-icon">
                  <img src={instagramImg} alt="Instagram" />
                </a>
              </div>
            </div>
          </div>

          <div className="footer-copyright">
            <p>&copy; 2026 DropIt. All Rights Reserved.</p>
          </div>
        </div>
      </footer>
    </>
  );
};

export default DropPage;