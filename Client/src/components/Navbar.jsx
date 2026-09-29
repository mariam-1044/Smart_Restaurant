import "../styles/layout.css";
import { useLocation, useNavigate } from "react-router-dom";
import { FaUserCircle, FaSearch, FaPlus, FaFileExport } from "react-icons/fa";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { logout as apiLogout } from "../api/authApi";
import { fetchDashboardStats } from "../api/dashboardApi";
import NotificationBell from "./notifications/NotificationBell";

const TITLES = {
  "/dashboard": "Control Center",
  "/inventory": "Inventory",
  "/recipes": "Recipe Studio",
  "/report": "Reports",
  "/setting": "Settings",
  "/recommend": "Recommendations",
  "/sales": "Sales",
  "/order": "Ordering System",
  "/admin/menu": "Menu",
  "/admin/users": "Users",
  "/ai/forecast": "Demand Forecast",
  "/ai/pricing": "Dynamic Pricing",
  "/customers": "Customers",
  "/waste": "Waste Management",
};

export default function Navbar({
  inventoryItems = [],
  setFilteredItems,
  onAddItem,
  onExport,
  onExportFiltered,
  hasActiveFilter,
  searchTerm: externalSearchTerm,
  setSearchTerm: setExternalSearchTerm,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [localSearchTerm, setLocalSearchTerm] = useState("");
  const [loadingAction, setLoadingAction] = useState(false);

  const searchTerm = externalSearchTerm !== undefined ? externalSearchTerm : localSearchTerm;
  const setSearchTerm = setExternalSearchTerm || setLocalSearchTerm;

  const header = TITLES[location.pathname] || "Smart Restaurant";

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (setFilteredItems && inventoryItems.length > 0) {
      const filtered = inventoryItems.filter((item) =>
        item.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredItems(filtered);
    }
  };

  const handleLogout = async () => {
    setLoadingAction(true);
    try {
      await apiLogout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      logout();
      navigate("/");
      setLoadingAction(false);
    }
  };

  const handleRefreshStats = async () => {
    setLoadingAction(true);
    try {
      await fetchDashboardStats();
      window.location.reload();
    } catch (error) {
      console.error("Error refreshing stats:", error);
    } finally {
      setLoadingAction(false);
    }
  };

  const renderPageActions = () => {
    switch (location.pathname) {
      case "/dashboard":
        return (
          <button className="nav-btn" onClick={handleRefreshStats} disabled={loadingAction}>
            {loadingAction ? "Refreshing…" : "Refresh"}
          </button>
        );
      case "/inventory":
        return (
          <>
            <div className="nav-search-wrap">
              <FaSearch className="nav-search-icon" />
              <input
                type="text"
                value={searchTerm}
                className="search-input nav-search-input"
                onChange={handleSearch}
                placeholder="Search inventory…"
              />
            </div>
            {user?.role === "admin" && (
              <button className="nav-btn nav-btn-icon" onClick={onAddItem}>
                <FaPlus /> Add
              </button>
            )}
            <button className="nav-btn nav-btn-icon" onClick={onExport} disabled={loadingAction}>
              <FaFileExport /> {loadingAction ? "Exporting…" : "Export"}
            </button>
            {hasActiveFilter && (
              <button className="nav-btn nav-btn-icon" onClick={onExportFiltered} disabled={loadingAction}>
                <FaFileExport /> Filtered
              </button>
            )}
          </>
        );
      case "/sales":
        return (
          <button className="nav-btn" onClick={() => navigate("/order")}>
            New Order
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="navbar geatsu-navbar">
      <div className="nav-left">
        <span className="nav-kicker">Gusteau</span>
        <span className="nav-title">{header}</span>
      </div>
      <div className="nav-right">
        <div className="actions">{renderPageActions()}</div>
        {(user?.role === "admin" || user?.role === "staff") && (
          <div className="navbar-bell">
            <NotificationBell />
          </div>
        )}
        <div className="profile">
          <div className="user-info-nav">
            <div className="user-info-name">{user?.name || "User"}</div>
            <div className="user-info-role">{user?.role || "Staff"}</div>
          </div>
          <FaUserCircle
            className="profile-icon"
            onClick={() => setProfileOpen(!profileOpen)}
            title={user?.name || "User"}
          />
          {profileOpen && (
            <div className="profile-dropdown">
              <ul>
                <li onClick={() => { navigate("/setting"); setProfileOpen(false); }}>
                  Profile Settings
                </li>
                <li className="profile-dropdown-danger" onClick={() => { handleLogout(); setProfileOpen(false); }}>
                  {loadingAction ? "Logging out…" : "Logout"}
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .geatsu-navbar { padding: 14px 28px !important; gap: 16px; }
        .nav-left { display: flex; flex-direction: column; gap: 2px; }
        .nav-kicker {
          font-family: var(--font-heading);
          font-size: 10px; letter-spacing: 0.32em; text-transform: uppercase;
          color: var(--accent-gold);
          opacity: 0.85;
        }
        .nav-title { font-size: 22px !important; }

        .nav-search-wrap {
          position: relative; display: flex; align-items: center;
        }
        .nav-search-icon {
          position: absolute; left: 14px; pointer-events: none;
          color: var(--text-muted); font-size: 13px;
        }
        .nav-search-input {
          padding: 9px 14px 9px 36px !important; min-width: 240px;
        }

        .nav-btn-icon { display: inline-flex; align-items: center; gap: 6px; }
        .navbar-bell { display: flex; align-items: center; }

        .user-info-nav { text-align: right; line-height: 1.1; }
        .user-info-name { font-size: 13px; font-weight: 600; color: var(--text-primary); }
        .user-info-role {
          font-size: 11px; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.08em;
        }

        .profile-dropdown ul { list-style: none; padding: 6px; margin: 0; }
        .profile-dropdown li {
          padding: 10px 14px; cursor: pointer; font-size: 13px;
          border-radius: 8px; color: var(--text-primary);
          transition: background-color 160ms var(--ease-out-expo), color 160ms var(--ease-out-expo);
        }
        .profile-dropdown li:hover { background: var(--bg-elevated); }
        .profile-dropdown-danger { color: var(--accent-red) !important; }
        .profile-dropdown-danger:hover { background: rgba(215,38,56,0.12) !important; }

        @media (max-width: 768px) {
          .nav-search-input { min-width: 0; width: 100%; }
          .nav-left .nav-title { font-size: 18px !important; }
          .user-info-nav { display: none; }
        }
      `}</style>
    </div>
  );
}
