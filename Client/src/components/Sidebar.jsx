import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import "../styles/layout.css";
import logo from "../img/gusteau-logo.png";
import { SidebarData } from "./Data";
import { NavLink, useNavigate } from "react-router-dom";
import { FaSignOutAlt, FaAngleLeft, FaAngleRight } from "react-icons/fa";
import homePathForRole from "../utils/homePath";

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const filteredSidebarData = SidebarData.filter(
    (item) => !item.roles || item.roles.includes(user?.role)
  );

  return (
    <aside className={`sidebar geatsu-sidebar ${collapsed ? "is-collapsed" : ""}`}>
      <button
        type="button"
        className="sidebar-toggle"
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand" : "Collapse"}
      >
        {collapsed ? <FaAngleRight /> : <FaAngleLeft />}
      </button>

      <div
        className="logo geatsu-logo"
        role="button"
        tabIndex={0}
        title="Go to home"
        style={{ cursor: "pointer" }}
        onClick={() => navigate(homePathForRole(user?.role))}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") navigate(homePathForRole(user?.role));
        }}
      >
        <img src={logo} alt="Gusteau" />
        {!collapsed && <span className="smart-logo">Gusteau</span>}
      </div>

      <nav className="menu geatsu-menu">
        {filteredSidebarData.map((item, index) => (
          <NavLink
            to={item.path}
            key={index}
            title={item.heading}
            className={({ isActive }) =>
              `menu-item geatsu-menu-item ${isActive ? "active" : ""}`
            }
          >
            <item.icon className="menu-item-icon" />
            <span className="menu-item-label">{item.heading}</span>
          </NavLink>
        ))}
      </nav>

      <button className="logout-btn geatsu-logout-btn" onClick={logout} title="Logout">
        <span className="log-logo">
          <FaSignOutAlt />
        </span>
        {!collapsed && <span>Logout</span>}
      </button>

      <style>{`
        .geatsu-sidebar {
          width: 248px !important;
          padding: 18px 0 !important;
          gap: 0 !important;
          transition: width 320ms var(--ease-out-expo) !important;
          display: flex !important;
          flex-direction: column !important;
        }
        .geatsu-sidebar.is-collapsed { width: 84px !important; }
        .geatsu-sidebar.is-collapsed .menu-item-label { display: none; }
        .geatsu-sidebar.is-collapsed .geatsu-menu-item { justify-content: center; margin-left: 12px !important; margin-right: 12px !important; }
        .geatsu-sidebar.is-collapsed .geatsu-logo { justify-content: center; }

        .sidebar-toggle {
          position: absolute; top: 22px; right: -14px;
          width: 28px; height: 28px;
          background: var(--bg-secondary);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: all 220ms var(--ease-out-expo);
          z-index: 5;
          box-shadow: 0 4px 12px rgba(0,0,0,0.25);
        }
        .sidebar-toggle:hover {
          color: var(--accent-gold);
          border-color: var(--accent-gold);
        }

        .geatsu-logo {
          height: auto !important;
          padding: 10px 18px 24px;
          align-items: center !important;
          gap: 14px !important;
        }
        .geatsu-logo > img {
          width: 72px !important; height: 72px !important;
          border-radius: 14px;
          object-fit: contain;
          padding: 2px;
        }
        .geatsu-sidebar.is-collapsed .geatsu-logo > img {
          width: 52px !important; height: 52px !important;
        }
        .smart-logo {
          font-size: 26px !important;
          letter-spacing: 0.06em !important;
          text-transform: uppercase;
        }

        .geatsu-menu {
          margin-top: 26px !important;
          gap: 4px !important;
          padding: 0 14px !important;
        }
        .geatsu-menu-item {
          margin-left: 0 !important;
          height: 40px !important;
          font-size: 13px !important;
          font-weight: 500 !important;
          letter-spacing: 0.02em;
          padding-left: 14px !important;
          padding-right: 14px !important;
          gap: 12px !important;
        }
        .menu-item-icon {
          flex-shrink: 0;
          width: 16px; height: 16px;
        }
        .menu-item-label {
          font-size: 13px;
          opacity: 0.95;
        }

        .geatsu-logout-btn {
          margin-top: auto !important;
          margin: 12px 18px 18px !important;
          font-size: 13px !important;
          padding: 10px 14px !important;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px !important;
        }

        @media (max-width: 900px) {
          .sidebar-toggle { display: none; }
          .geatsu-sidebar { width: 100% !important; }
        }
      `}</style>
    </aside>
  );
};

export default Sidebar;
