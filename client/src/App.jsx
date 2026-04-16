import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import axios from 'axios';

import HomePage from "./pages/HomePage";
import DropPage from "./pages/DropPage";
import HistoryPage from "./pages/HistoryPage";
import FirstPage from "./pages/FirstPage";
import GestureDetector from "./components/GestureDetector";

import { useState, useEffect } from "react";
import "./pages/FirstPage.css";

const AppContent = ({
  currentGesture,
  gestureConfidence,
  handleGesture,
  user,
  handleLogin,
  handleLogout
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user && location.pathname === '/') {
      navigate('/home', { replace: true });
      return;
    }

    if (!user && location.pathname !== '/') {
      navigate('/', { replace: true });
      return;
    }

    const validRoutes = ['/', '/home', '/drop', '/history'];

    if (!validRoutes.includes(location.pathname)) {
      navigate('/', { replace: true });
    }
  }, [location, navigate, user]);

  return (
    <>
      <GestureDetector onGesture={handleGesture} />

      <Routes>
        {/* Public route */}
        <Route
          path="/"
          element={<FirstPage onLogin={handleLogin} />}
        />

        {/* Protected routes */}
        <Route
          path="/home"
          element={
            user ? (
              <HomePage
                currentGesture={currentGesture}
                gestureConfidence={gestureConfidence}
                user={user}
                onLogout={handleLogout}
              />
            ) : (
              <Navigate to="/" />
            )
          }
        />

        <Route
          path="/drop"
          element={
            user ? (
              <DropPage
                currentGesture={currentGesture}
                gestureConfidence={gestureConfidence}
                user={user}
                onLogout={handleLogout}
              />
            ) : (
              <Navigate to="/" />
            )
          }
        />

        <Route
          path="/history"
          element={
            user ? (
              <HistoryPage
                user={user}
                onLogout={handleLogout}
              />
            ) : (
              <Navigate to="/" />
            )
          }
        />

        {/* fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};

const API_URL = import.meta.env.VITE_API_URL || 'https://dropit-final-4.onrender.com';

const App = () => {
  const [currentGesture, setCurrentGesture] = useState(null);
  const [gestureConfidence, setGestureConfidence] = useState(0);

  const [user, setUser] = useState(null);

  const handleGesture = (gesture, confidence) => {
    const normalizedGesture = gesture?.toString().trim().toLowerCase();
    setCurrentGesture(normalizedGesture);
    setGestureConfidence(confidence);
  };

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    
    if (!token || !userId) {
      // Clear any residual data
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      return;
    }

    const verifyUser = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/auth/verify`, {
          headers: {
            Authorization: token
          }
        });

        if (res.data && res.data.user) {
          setUser(res.data.user);
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('userId');
        }
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
      }
    };

    verifyUser();
  }, []);

  return (
    <BrowserRouter>
      <AppContent
        currentGesture={currentGesture}
        gestureConfidence={gestureConfidence}
        handleGesture={handleGesture}
        user={user}
        handleLogin={handleLogin}
        handleLogout={handleLogout}
      />
    </BrowserRouter>
  );
};

export default App;