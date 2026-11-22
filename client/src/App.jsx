import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import axios from 'axios';

import HomePage from "./pages/HomePage";
import DropPage from "./pages/DropPage";
import HistoryPage from "./pages/HistoryPage";
import FirstPage from "./pages/FirstPage";

import { useState, useEffect } from "react";
import "./pages/FirstPage.css";

// The camera + gesture detector now lives inside the Send (/home) and Drop (/drop) pages,
// so the camera is only on while one of those pages is open.
const AppContent = ({
  user,
  authReady,
  handleLogin,
  handleLogout
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Wait for the saved login to be checked, so reloading /drop or /history keeps you there
    if (!authReady) return;

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
  }, [location, navigate, user, authReady]);

  if (!authReady) return null;

  return (
    <>
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

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const App = () => {
  const [user, setUser] = useState(null);
  // Ready immediately when there is no saved login; otherwise after /api/auth/verify answers
  const [authReady, setAuthReady] = useState(
    () => !(localStorage.getItem('token') && localStorage.getItem('userId'))
  );

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
      } finally {
        setAuthReady(true);
      }
    };

    verifyUser();
  }, []);

  return (
    <BrowserRouter>
      <AppContent
        user={user}
        authReady={authReady}
        handleLogin={handleLogin}
        handleLogout={handleLogout}
      />
    </BrowserRouter>
  );
};

export default App;