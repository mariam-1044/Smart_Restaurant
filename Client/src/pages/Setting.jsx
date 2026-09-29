import React, { useState, useEffect } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import {
  FaStore,
  FaGlobe,
  FaBell,
  FaLock,
  FaSave,
  FaMoon,
} from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../components/toast/ToastContext";
import { updateProfile, updatePassword } from "../api/authApi";
import Button from "../components/shared/Button";
import Card from "../components/shared/Card";
import Input from "../components/shared/Input";
import PageHeader from "../components/shared/PageHeader";

export default function Setting() {
  const { user, setUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const darkMode = theme === "dark";
  const toast = useToast();

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    avatar: user?.avatar || "",
    currency: "EGP",
    timezone: "GMT+02:00",
    orderAlerts: true,
    stockWarnings: true,
  });

  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        name: user.name || "",
        phone: user.phone || "",
        avatar: user.avatar || "",
      }));
    }
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSaveChanges = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        name: formData.name,
        phone: formData.phone,
        avatar: formData.avatar,
      };
      const data = await updateProfile(payload);
      if (data?.success) {
        const updatedUser = data.data?.user || data.data;
        if (updatedUser) setUser(updatedUser);
        toast.success("Profile updated");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save profile");
    } finally {
      setLoading(false);
    }
  };

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  const handleChangePassword = async (e) => {
    if (e) e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (!currentPassword || !newPassword) {
      toast.error("All password fields are required");
      return;
    }
    setPwLoading(true);
    try {
      const data = await updatePassword({ currentPassword, newPassword });
      if (data?.success) {
        toast.success("Password changed successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
      }
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data || {};
      const violations = data.violations || [];

      if (
        status === 401 &&
        typeof data.message === "string" &&
        data.message.toLowerCase().includes("current password")
      ) {
        toast.error("Current password is incorrect");
        setCurrentPassword("");
        return;
      }
      if (status === 400 && violations.length > 0) {
        const labels = {
          min_length: "at least 8 characters",
          missing_letter: "at least one letter",
          missing_digit: "at least one digit",
          same_as_current: "different from your current password",
        };
        const human = violations.map((v) => labels[v] || v).join("; ");
        toast.error(`Password must have: ${human}`);
        return;
      }
      toast.error(data.message || "Could not change password");
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="settings-container">
        <PageHeader
          kicker="Workspace"
          title="System Settings"
          subtitle="Manage your restaurant configuration and preferences."
          actions={
            <Button onClick={handleSaveChanges} loading={loading} iconLeft={<FaSave />}>
              {loading ? "Saving…" : "Save Changes"}
            </Button>
          }
        />

        <div className="settings-grid">
          <Card padding="p-6" className="settings-card">
            <SectionHeader icon={<FaStore />} title="User Profile" />
            <div className="settings-section-body">
              <Input
                label="Full Name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
              />
              <Input
                label="Email Address"
                value={user?.email || ""}
                disabled
                hint="Email is read-only and cannot be changed."
              />
              <Input
                label="Phone Number"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
              />
              <Input
                label="Avatar URL"
                name="avatar"
                value={formData.avatar}
                onChange={handleInputChange}
                placeholder="https://example.com/avatar.png"
              />
            </div>
          </Card>

          <Card padding="p-6" className="settings-card">
            <SectionHeader icon={<FaGlobe />} title="Localization & Theme" />
            <div className="settings-section-body">
              <div className="form-group">
                <label className="settings-label">Currency Symbol</label>
                <select
                  className="form-select settings-select"
                  name="currency"
                  value={formData.currency}
                  onChange={handleInputChange}
                >
                  <option value="EGP">EGP — Egyptian Pound</option>
                  <option value="USD">USD — US Dollar</option>
                  <option value="EUR">EUR — Euro</option>
                </select>
              </div>
              <div className="form-group">
                <label className="settings-label">Time Zone</label>
                <select
                  className="form-select settings-select"
                  name="timezone"
                  value={formData.timezone}
                  onChange={handleInputChange}
                >
                  <option value="GMT+02:00">(GMT+02:00) Cairo</option>
                  <option value="GMT+00:00">(GMT+00:00) UTC</option>
                </select>
              </div>
              <ToggleRow
                icon={<FaMoon />}
                label="Dark Mode (Neo Tokyo)"
                description="Switch between Gusteau Light and Gusteau Dark."
                checked={darkMode}
                onChange={toggleTheme}
              />
            </div>
          </Card>

          <Card padding="p-6" className="settings-card">
            <SectionHeader icon={<FaBell />} title="Notifications" />
            <div className="settings-section-body">
              <ToggleRow
                label="Order Alerts"
                description="Receive sound notifications for new orders."
                checked={formData.orderAlerts}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, orderAlerts: e.target.checked }))
                }
              />
              <ToggleRow
                label="Stock Warnings"
                description="Notify when ingredients are low."
                checked={formData.stockWarnings}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, stockWarnings: e.target.checked }))
                }
              />
            </div>
          </Card>

          <Card padding="p-6" className="settings-card">
            <SectionHeader icon={<FaLock />} title="Security" />
            <form onSubmit={handleChangePassword} className="settings-section-body">
              <Input
                type="password"
                label="Current Password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
              <Input
                type="password"
                label="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              <Input
                type="password"
                label="Confirm New Password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              <Button
                type="submit"
                variant="secondary"
                loading={pwLoading}
                className="settings-pw-btn"
              >
                {pwLoading ? "Updating…" : "Change Password"}
              </Button>
            </form>
          </Card>
        </div>
      </div>

      <style>{`
        .settings-container { padding: 28px; }
        .settings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
          gap: 22px;
        }
        .settings-card { display: flex; flex-direction: column; gap: 18px; }
        .settings-section-body { display: flex; flex-direction: column; gap: 16px; }
        .settings-label {
          font-family: var(--font-heading);
          font-size: 12px; font-weight: 600;
          letter-spacing: 0.06em; text-transform: uppercase;
          color: var(--text-muted);
          margin-bottom: 6px;
          display: block;
        }
        .settings-select {
          width: 100%;
          background: var(--bg-secondary);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 11px 12px;
          font-size: 14px;
          outline: none;
          transition: border-color 160ms var(--ease-out-expo), box-shadow 160ms var(--ease-out-expo);
        }
        [data-theme="dark"] .settings-select { background: rgba(255,255,255,0.03); }
        .settings-select:focus {
          border-color: var(--accent-gold);
          box-shadow: 0 0 0 3px rgba(155,226,45,0.18);
        }
        .settings-pw-btn { margin-top: 4px; align-self: flex-start; }
      `}</style>
    </DashboardLayout>
  );
}

function SectionHeader({ icon, title }) {
  return (
    <>
      <div className="settings-section-header">
        <span className="settings-section-icon">{icon}</span>
        <h2 className="settings-section-title">{title}</h2>
      </div>
      <style>{`
        .settings-section-header {
          display: flex; align-items: center; gap: 10px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--border-color);
        }
        .settings-section-icon {
          width: 36px; height: 36px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(155,226,45,0.12);
          color: var(--accent-gold);
          border-radius: 10px;
          font-size: 14px;
        }
        .settings-section-title {
          margin: 0;
          font-family: var(--font-heading);
          font-size: 16px; font-weight: 700;
          letter-spacing: 0.02em;
          color: var(--text-primary);
        }
      `}</style>
    </>
  );
}

function ToggleRow({ icon, label, description, checked, onChange }) {
  return (
    <>
      <label className="settings-toggle-row">
        <div className="settings-toggle-text">
          <span className="settings-toggle-label">
            {icon ? <span className="settings-toggle-icon">{icon}</span> : null}
            {label}
          </span>
          {description && <span className="settings-toggle-desc">{description}</span>}
        </div>
        <span className={`settings-switch ${checked ? "is-on" : ""}`}>
          <input type="checkbox" checked={checked} onChange={onChange} />
          <span className="settings-switch-thumb" />
        </span>
      </label>
      <style>{`
        .settings-toggle-row {
          display: flex; align-items: center; justify-content: space-between;
          gap: 14px; cursor: pointer; user-select: none;
          padding: 6px 0;
        }
        .settings-toggle-text { display: flex; flex-direction: column; gap: 2px; }
        .settings-toggle-label {
          display: inline-flex; align-items: center; gap: 8px;
          font-weight: 600; color: var(--text-primary); font-size: 14px;
        }
        .settings-toggle-icon { color: var(--accent-gold); display: inline-flex; }
        .settings-toggle-desc { font-size: 12px; color: var(--text-muted); }
        .settings-switch {
          position: relative; width: 44px; height: 24px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-color);
          border-radius: 999px;
          transition: background-color 200ms var(--ease-out-expo), border-color 200ms var(--ease-out-expo);
        }
        .settings-switch input { opacity: 0; width: 100%; height: 100%; cursor: pointer; }
        .settings-switch-thumb {
          position: absolute; top: 3px; left: 3px;
          width: 16px; height: 16px;
          background: var(--text-muted);
          border-radius: 50%;
          transition: transform 220ms var(--ease-out-expo), background-color 220ms var(--ease-out-expo);
        }
        .settings-switch.is-on {
          background: rgba(215,38,56,0.16);
          border-color: rgba(215,38,56,0.4);
        }
        .settings-switch.is-on .settings-switch-thumb {
          transform: translateX(20px);
          background: var(--accent-red);
          box-shadow: var(--glow-red);
        }
      `}</style>
    </>
  );
}
