import { useEffect, useRef, useState, useCallback } from "react";
import { Upload, Home, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import './HomePage.css';
import SampleVideo from './Sample_video.mp4';
import facebookImg from './vecteezy_facebook-logo-png-facebook-icon-transparent-white-background_41643208.png';
import instagramImg from './vecteezy_instagram-logo-png-instagram-icon-transparent_18930413.png';
import linkedinImg from './vecteezy_linkedin-logo-png-linkedin-icon-transparent-png_18930480.png';
import twitterImg from './vecteezy_twitter-png-icon_16716486.png';
import NavBar from '../components/NavBar';

const GRAB_COOLDOWN = 10000;
const USER_ID = import.meta.env.VITE_USER_ID || 'id1';
const API_URL = 'https://dropit-final-4.onrender.com';
const CONFIDENCE_THRESHOLD = 0.7;

const HomePage = ({ currentGesture, gestureConfidence, user, onLogout }) => {

  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [hasGrabbed, setHasGrabbed] = useState(false);
  const [receiverUsername, setReceiverUsername] = useState(import.meta.env.VITE_RECEIVER_USERNAME || '');

  const lastGrabTime = useRef(0);

  const [shouldGrab, setShouldGrab] = useState(false);

  const handleGrab = useCallback(async () => {
    if (!selectedImage || isGrabbing) return;

    if (!receiverUsername.trim()) {
      alert('Please enter a receiver username');
      return;
    }

    lastGrabTime.current = Date.now();
    setIsGrabbing(true);

    const token = localStorage.getItem('token');
    if (!token) {
      alert('Please login first');
      setIsGrabbing(false);
      return;
    }

    const receiver = receiverUsername.trim();
    
    try {
      const userResponse = await fetch(`${API_URL}/api/auth/user/${encodeURIComponent(receiver)}`, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Authorization': token
        }
      });
      
      if (!userResponse.ok) {
        if (userResponse.status === 401) {
          alert('Authentication failed. Please login again.');
        } else if (userResponse.status === 404) {
          alert('Receiver not found. Please check the username or email.');
        } else {
          const errorData = await userResponse.json().catch(() => ({}));
          alert('Unable to find receiver: ' + (errorData.error || userResponse.statusText));
        }
        setIsGrabbing(false);
        return;
      }
      
      const userData = await userResponse.json();
      const receiverUserId = userData.user?.id;

      if (!receiverUserId) {
        alert('Receiver lookup succeeded but no user ID was returned. Please try again.');
        setIsGrabbing(false);
        return;
      }

      const formData = new FormData();
      formData.append('file', selectedImage);
      formData.append('type', 'send');
      formData.append('exchangedWith', receiverUserId);

      const response = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        mode: 'cors',
        headers: {
          'Authorization': token
        },
        body: formData
      });
      
      const data = await response.json();

      if (data.success) {
        setHasGrabbed(true);
        setTimeout(() => {
          setIsGrabbing(false);
          setHasGrabbed(false);
        }, 2000);
      } else {
        setIsGrabbing(false);
        alert('Upload failed: ' + data.message);
      }
    } catch (error) {
      console.error(error);
      setIsGrabbing(false);
      alert('Upload error: ' + error.message);
    }
  }, [selectedImage, receiverUsername, isGrabbing]);

  useEffect(() => {
    const timeSinceLastGrab = Date.now() - lastGrabTime.current;
    let grabTimeout;

    if (currentGesture === 'grab' &&
      gestureConfidence > CONFIDENCE_THRESHOLD &&
      selectedImage &&
      !isGrabbing &&
      !hasGrabbed &&
      timeSinceLastGrab > GRAB_COOLDOWN
    ) {
      grabTimeout = window.setTimeout(() => {
        setShouldGrab(true);
      }, 0);
    }

    return () => {
      if (grabTimeout) {
        clearTimeout(grabTimeout);
      }
    };
  }, [currentGesture, gestureConfidence, selectedImage, isGrabbing, hasGrabbed]);

  useEffect(() => {
    if (!shouldGrab) return;

    const executeGrab = async () => {
      await handleGrab();
      setShouldGrab(false);
    };

    executeGrab();
  }, [shouldGrab, handleGrab]);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      setHasGrabbed(false);
      lastGrabTime.current = 0;

      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      }
      reader.readAsDataURL(file);
    }
  }

  const handleCancelImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setHasGrabbed(false);
    lastGrabTime.current = 0;
  }

  return (
    <>
      <NavBar isLoggedIn={Boolean(user)} onLogout={onLogout} />
      <video className="background-video" autoPlay loop muted playsInline>
        <source src={SampleVideo} type="video/mp4" />
      </video>
      <div className="background-overlay"></div>
      <div className="home-page-container">
      {
        !imagePreview ? (
          <div className="home-page-content glass-effect-home">
            <h1 className="home-page-title">
              Image Transfer
            </h1>
            <p className="home-page-subtitle">
              Select an image, then make a <strong>"GRAB"</strong> gesture
            </p>
            
            {/* Receiver Username Input */}
            <div className="receiver-input-container">
              <label htmlFor="receiver-username" className="receiver-label">
                Send to Username:
              </label>
              <input
                id="receiver-username"
                type="text"
                value={receiverUsername}
                onChange={(e) => setReceiverUsername(e.target.value)}
                placeholder="Enter receiver's username"
                className="receiver-input"
                required
              />
            </div>

            <label className="home-upload-area">
              <Upload className="home-upload-icon" />
              <span className="home-upload-text">Click to select image</span>
              <input type="file" className="hidden" accept="image/*" onChange={handleImageSelect} />
            </label>
          </div>
        ) : (
          <div className="relative w-full h-screen">
            <img src={imagePreview} alt="Selected Image" className="w-full h-full object-contain" />
            {
              !isGrabbing && (
                <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-4">
                  <button
                    onClick={handleCancelImage}
                    className="glass-btn glass-btn-cancel"
                  >
                    Cancel & Upload Another
                  </button>
                  <Link
                    to="/"
                    className="glass-btn glass-btn-home"
                  >
                    <Home className="w-5 h-5" />
                    Go Home
                  </Link>
                </div>
              )
            }
            {
              isGrabbing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                  <div className="animate-ping absolute w-96 h-96 rounded-full bg-white opacity-75"></div>
                  <div className="animate-pulse absolute w-64 h-64 rounded-full bg-white opacity-75"></div>
                  <div className="animate-bounce absolute w-32 h-32 rounded-full bg-white opacity-75"></div>
                </div>
              )
            }
          </div>
        )
      }
      </div>

      {/* Footer Section */}
      <footer className="footer-section">
        <div className="footer-container">
          {/* About Section */}
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

          {/* Footer Content */}
          <div className="footer-content">
            {/* Featured Section */}
            <div className="footer-column">
              <h5>Features</h5>
              <ul className="footer-links">
                <li><a href="#gesture">Gesture Recognition</a></li>
                <li><a href="#transfer">High-Speed Transfer</a></li>
                <li><a href="#tracking">Real-Time Tracking</a></li>
                <li><a href="#history">Transfer History</a></li>
                <li><a href="#security">Secure Transfer</a></li>
              </ul>
            </div>

            {/* Quick Links */}
            <div className="footer-column">
              <h5>Quick Links</h5>
              <ul className="footer-links">
                <li><a href="#home">Home</a></li>
                <li><a href="#upload">Upload Files</a></li>
                <li><a href="#receive">Receive Files</a></li>
                <li><a href="#history">History</a></li>
                <li><a href="#settings">Settings</a></li>
              </ul>
            </div>

            {/* Contact Section */}
            <div className="footer-column">
              <h5>Contact Us</h5>
              <div className="contact-info">
                <p><strong>Email:</strong> jamilahmed9500@gmail.com</p>
                <p><strong>Phone:</strong> +88001732856095</p>
                <p><strong>Address:</strong> PAJAMA TECH , Dhaka City</p>
              </div>
            </div>

            {/* Social Links */}
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

          {/* Copyright Section */}
          <div className="footer-copyright">
            <p>&copy; 2026 DropIt. All Rights Reserved.</p>
          </div>
        </div>
      </footer>
    </>
  )
}

export default HomePage