import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { History, House, Inbox, LogOut, Send } from "lucide-react";
import BrandMark from "./BrandMark";
import { API_URL } from "../lib/api";
import "./NavBar.css";

// Each section keeps its colour everywhere: Send = coral, Receive = aqua, History = violet
const LINKS = [
  { to: "/dashboard", label: "Home", icon: House, tone: "home" },
  { to: "/home", label: "Send", icon: Send, tone: "grab" },
  { to: "/drop", label: "Receive", icon: Inbox, tone: "drop" },
  { to: "/history", label: "History", icon: History, tone: "trail" },
];

const initialOf = (user) => (user?.name || user?.username || "?").trim().charAt(0).toUpperCase();

const NavBar = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    setMenuOpen(false);
    const token = localStorage.getItem("token");
    try {
      await fetch(`${API_URL}/api/auth/logout`, { method: "POST", headers: { Authorization: token } });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem("token");
      onLogout?.();
      navigate("/");
    }
  };

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/dashboard" className="topbar-brand" aria-label="DropIt home">
            <BrandMark size={46} />
            <span>DropIt</span>
          </NavLink>

          <nav className="topbar-links" aria-label="Main">
            {LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) => `topbar-link ${link.tone} ${isActive ? "active" : ""}`}
                >
                  <span className="topbar-link-icon">
                    <Icon size={18} strokeWidth={2.2} />
                  </span>
                  {link.label}
                </NavLink>
              );
            })}
          </nav>

          <div className="topbar-user">
            <button
              type="button"
              className="avatar-btn"
              onClick={() => setMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Account menu"
            >
              {user?.avatar ? (
                <img src={user.avatar} alt="" referrerPolicy="no-referrer" />
              ) : (
                <span>{initialOf(user)}</span>
              )}
            </button>
            {menuOpen && (
              <>
                <button
                  type="button"
                  className="menu-backdrop"
                  aria-label="Close menu"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="account-menu" role="menu">
                  <div className="account-menu-head">
                    <strong>{user?.name || user?.username}</strong>
                    <span>@{user?.username}</span>
                  </div>
                  <button type="button" role="menuitem" className="account-menu-item" onClick={handleLogout}>
                    <LogOut size={17} /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Phones: app-style tab bar at the bottom, within thumb reach */}
      <nav className="tabbar" aria-label="Main">
        {LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `tabbar-link ${link.tone} ${isActive ? "active" : ""}`}
            >
              <span className="tabbar-icon">
                <Icon size={21} strokeWidth={2.2} />
              </span>
              {link.label}
            </NavLink>
          );
        })}
      </nav>
    </>
  );
};

export default NavBar;
