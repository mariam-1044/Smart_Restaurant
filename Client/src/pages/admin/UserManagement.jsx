import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import api from "../../api/axios";
import LoadingState from "../../components/shared/LoadingState";
import ErrorState from "../../components/shared/ErrorState";
import EmptyState from "../../components/shared/EmptyState";
import FilterPills from "../../components/shared/FilterPills";
import StatusBadge from "../../components/users/StatusBadge";
import RoleDropdown from "../../components/users/RoleDropdown";
import PageHeader from "../../components/shared/PageHeader";
import Card from "../../components/shared/Card";
import Button from "../../components/shared/Button";
import Skeleton from "../../components/shared/Skeleton";
import {
  FaUsers,
  FaUserShield,
  FaUserClock,
  FaUserSlash,
  FaSearch,
  FaCheck,
  FaTimes,
} from "react-icons/fa";

const ROLE_BADGES = {
  admin: { label: "Admin", color: "#D72638", bg: "rgba(215,38,56,0.12)", icon: "👑" },
  staff: { label: "Staff", color: "#3B82F6", bg: "rgba(59,130,246,0.12)", icon: "✦" },
  customer: { label: "Customer", color: "#10B981", bg: "rgba(16,185,129,0.12)", icon: "○" },
};

function avatarSeed(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join("");
}

function avatarColor(name) {
  if (!name) return "linear-gradient(135deg, #D72638, #C9A227)";
  const colors = [
    "linear-gradient(135deg, #D72638, #F97316)",
    "linear-gradient(135deg, #3B82F6, #06B6D4)",
    "linear-gradient(135deg, #10B981, #34D399)",
    "linear-gradient(135deg, #C9A227, #F59E0B)",
    "linear-gradient(135deg, #7C3AED, #A78BFA)",
    "linear-gradient(135deg, #BE185D, #F472B6)",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return colors[Math.abs(hash) % colors.length];
}

export default function UserManagement() {
  const [pageState, setPageState] = useState("loading");
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);

  async function load() {
    setPageState("loading");
    try {
      const r = await api.get("/auth/users");
      const data = r.data.data ?? r.data;
      setUsers(data);
      setPageState("ready");
    } catch {
      setPageState("error");
    }
  }
  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(() => {
    return {
      all: users.length,
      pending: users.filter((u) => u.status === "pending").length,
      approved: users.filter((u) => u.status === "approved").length,
      inactive: users.filter((u) => u.status === "inactive").length,
    };
  }, [users]);

  const FILTERS = [
    { value: "all", label: "All", count: counts.all },
    { value: "pending", label: "Pending", count: counts.pending },
    { value: "approved", label: "Active", count: counts.approved },
    { value: "inactive", label: "Inactive", count: counts.inactive },
  ];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = filter === "all" ? users : users.filter((u) => u.status === filter);
    if (term) {
      list = list.filter(
        (u) =>
          u.name?.toLowerCase().includes(term) ||
          u.email?.toLowerCase().includes(term)
      );
    }
    return list;
  }, [users, filter, search]);

  async function patchUser(u, body) {
    try {
      await api.patch(`/auth/users/${u._id}`, { ...body, __version: u.version });
      await load();
    } catch (err) {
      if (err.response?.status === 409) {
        setToast({ kind: "error", text: err.response.data.message });
        await load();
      } else {
        setToast({ kind: "error", text: "Update failed." });
      }
    }
  }

  return (
    <DashboardLayout>
      <div className="users-page">
        <PageHeader
          kicker="Access Control"
          title="Users"
          subtitle="Manage team members, customer accounts, roles, and approval status."
        />

        {pageState === "loading" && (
          <div className="users-skeleton">
            <Skeleton.Card />
            <Skeleton.Card />
          </div>
        )}

        {pageState === "error" && (
          <ErrorState message="Failed to load users." onRetry={load} />
        )}

        {pageState === "ready" && (
          <>
            <div className="users-stats-row">
              <UserStat
                icon={<FaUsers />}
                label="Total"
                value={counts.all}
                tone="red"
              />
              <UserStat
                icon={<FaUserShield />}
                label="Active"
                value={counts.approved}
                tone="green"
              />
              <UserStat
                icon={<FaUserClock />}
                label="Pending"
                value={counts.pending}
                tone="warn"
              />
              <UserStat
                icon={<FaUserSlash />}
                label="Inactive"
                value={counts.inactive}
                tone="neutral"
              />
            </div>

            <div className="users-toolbar">
              <div className="users-search">
                <FaSearch className="users-search-icon" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or email…"
                />
              </div>
              <FilterPills
                options={FILTERS}
                value={filter}
                onChange={(v) => setFilter(v ?? "all")}
              />
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                title="No users match this filter"
                message="Try a different filter or search term."
              />
            ) : (
              <Card padding="p-0" className="users-table-card">
                <div className="users-table-wrap">
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th className="users-th-actions">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((u) => (
                        <tr key={u._id} className="users-row">
                          <td>
                            <div className="users-cell-id">
                              <div
                                className="users-avatar"
                                style={{ background: avatarColor(u.name) }}
                              >
                                {avatarSeed(u.name)}
                              </div>
                              <div className="users-cell-id-text">
                                <span className="users-cell-name">{u.name}</span>
                                <span className="users-cell-email">{u.email}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="users-role-cell">
                              <span
                                className="users-role-chip"
                                style={{
                                  color: ROLE_BADGES[u.role]?.color,
                                  background: ROLE_BADGES[u.role]?.bg,
                                  border: `1px solid ${ROLE_BADGES[u.role]?.color}33`,
                                }}
                              >
                                {ROLE_BADGES[u.role]?.icon} {ROLE_BADGES[u.role]?.label || u.role}
                              </span>
                              <RoleDropdown
                                value={u.role}
                                onChange={(role) => patchUser(u, { role })}
                              />
                            </div>
                          </td>
                          <td>
                            <StatusBadge status={u.status} />
                          </td>
                          <td>
                            <div className="users-actions">
                              {u.status === "pending" && (
                                <>
                                  <button
                                    className="users-action-btn approve"
                                    onClick={() => patchUser(u, { status: "approved" })}
                                  >
                                    <FaCheck /> Approve
                                  </button>
                                  <button
                                    className="users-action-btn reject"
                                    onClick={() => patchUser(u, { status: "rejected" })}
                                  >
                                    <FaTimes /> Reject
                                  </button>
                                </>
                              )}
                              {u.status === "approved" && (
                                <button
                                  className="users-action-btn ghost"
                                  onClick={() => patchUser(u, { status: "inactive" })}
                                >
                                  Deactivate
                                </button>
                              )}
                              {u.status === "inactive" && (
                                <button
                                  className="users-action-btn approve"
                                  onClick={() => patchUser(u, { status: "approved" })}
                                >
                                  Reactivate
                                </button>
                              )}
                              {u.status === "rejected" && (
                                <button
                                  className="users-action-btn ghost"
                                  onClick={() => patchUser(u, { status: "pending" })}
                                >
                                  Re-open
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )}
      </div>

      {toast && <UserToast {...toast} onClose={() => setToast(null)} />}

      <style>{`
        .users-page { padding: 28px; display: flex; flex-direction: column; gap: 22px; }
        .users-skeleton { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }

        /* STATS --------------------------------------------------------- */
        .users-stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }

        /* TOOLBAR ------------------------------------------------------- */
        .users-toolbar {
          display: flex; align-items: center; justify-content: space-between;
          gap: 14px; flex-wrap: wrap;
        }
        .users-search {
          position: relative; display: flex; align-items: center; flex: 0 0 320px;
        }
        .users-search-icon {
          position: absolute; left: 14px; pointer-events: none;
          color: var(--text-muted); font-size: 13px;
        }
        .users-search input {
          width: 100%;
          padding: 10px 14px 10px 38px;
          border-radius: 999px;
          background: var(--bg-secondary);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
          font-size: 14px;
          outline: none;
          transition: border-color 160ms var(--ease-out-expo), box-shadow 160ms var(--ease-out-expo);
        }
        .users-search input:focus {
          border-color: var(--accent-gold);
          box-shadow: 0 0 0 3px rgba(155,226,45,0.18);
        }

        /* TABLE --------------------------------------------------------- */
        .users-table-card { padding: 0 !important; overflow: hidden; }
        .users-table-wrap { overflow-x: auto; }
        .users-table { width: 100%; border-collapse: collapse; }
        .users-table th {
          text-align: left;
          padding: 16px 18px;
          background: var(--bg-elevated);
          color: var(--text-muted);
          font-family: var(--font-heading);
          font-size: 11px;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          font-weight: 600;
          border-bottom: 1px solid var(--border-color);
        }
        .users-th-actions { text-align: right; }
        .users-table td {
          padding: 14px 18px;
          border-bottom: 1px solid var(--border-color);
          color: var(--text-secondary);
          font-size: 14px;
          vertical-align: middle;
        }
        .users-row { transition: background-color 160ms var(--ease-out-expo); }
        .users-row:hover { background: var(--bg-elevated); }
        .users-row:last-child td { border-bottom: 0; }

        .users-cell-id { display: flex; align-items: center; gap: 14px; min-width: 0; }
        .users-avatar {
          width: 42px; height: 42px;
          border-radius: 12px;
          flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          color: #fff;
          font-family: var(--font-heading);
          font-weight: 700;
          font-size: 14px;
          letter-spacing: 0.02em;
          box-shadow: 0 4px 14px rgba(0,0,0,0.18);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .users-cell-id-text { display: flex; flex-direction: column; min-width: 0; }
        .users-cell-name {
          font-family: var(--font-heading);
          font-weight: 600;
          color: var(--text-primary);
          font-size: 14px;
        }
        .users-cell-email {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 2px;
        }

        .users-role-cell { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .users-role-chip {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 4px 10px;
          border-radius: 999px;
          font-family: var(--font-heading);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.04em;
        }

        /* Action buttons */
        .users-actions { display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap; }
        .users-action-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 7px 14px;
          border-radius: 10px;
          font-family: var(--font-heading);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.04em;
          cursor: pointer;
          border: 1px solid transparent;
          transition: all 200ms var(--ease-out-expo);
        }
        .users-action-btn.approve {
          background: var(--accent-green);
          color: #fff;
          border-color: var(--accent-green);
        }
        .users-action-btn.approve:hover {
          box-shadow: var(--glow-green);
          transform: translateY(-1px);
        }
        .users-action-btn.reject {
          background: rgba(215,38,56,0.12);
          color: var(--accent-red);
          border-color: rgba(215,38,56,0.34);
        }
        .users-action-btn.reject:hover {
          background: var(--accent-red);
          color: #fff;
          box-shadow: var(--glow-red);
        }
        .users-action-btn.ghost {
          background: var(--bg-elevated);
          color: var(--text-secondary);
          border-color: var(--border-color);
        }
        .users-action-btn.ghost:hover {
          color: var(--text-primary);
          border-color: var(--text-primary);
        }

        @media (max-width: 1024px) {
          .users-stats-row { grid-template-columns: repeat(2, 1fr); }
          .users-search { flex: 1 1 100%; }
        }
        @media (max-width: 640px) {
          .users-stats-row { grid-template-columns: 1fr; }
        }
      `}</style>
    </DashboardLayout>
  );
}

function UserStat({ icon, label, value, tone = "red" }) {
  return (
    <>
      <div className={`user-stat user-stat-${tone}`}>
        <div className="user-stat-icon">{icon}</div>
        <div className="user-stat-text">
          <div className="user-stat-label">{label}</div>
          <div className="user-stat-value">{value}</div>
        </div>
      </div>
      <style>{`
        .user-stat {
          display: flex; align-items: center; gap: 14px;
          padding: 18px;
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-color);
          background: var(--bg-card);
          box-shadow: var(--shadow-soft);
          position: relative;
          overflow: hidden;
          transition: all 200ms var(--ease-out-expo);
        }
        .user-stat:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-elev);
        }
        .user-stat-icon {
          width: 44px; height: 44px;
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-size: 18px;
          flex-shrink: 0;
        }
        .user-stat-red .user-stat-icon { background: rgba(215,38,56,0.12); color: var(--accent-red); }
        .user-stat-green .user-stat-icon { background: rgba(16,185,129,0.12); color: var(--accent-green); }
        .user-stat-warn .user-stat-icon { background: rgba(245,158,11,0.14); color: #F59E0B; }
        .user-stat-neutral .user-stat-icon { background: var(--bg-elevated); color: var(--text-muted); }
        .user-stat-label {
          font-family: var(--font-heading);
          font-size: 11px; letter-spacing: 0.10em; text-transform: uppercase;
          color: var(--text-muted); font-weight: 600;
        }
        .user-stat-value {
          font-family: var(--font-heading);
          font-size: 22px; font-weight: 700;
          color: var(--text-primary); letter-spacing: -0.01em;
          margin-top: 2px;
        }
      `}</style>
    </>
  );
}

function UserToast({ kind, text, onClose }) {
  return (
    <>
      <div className={`user-toast user-toast-${kind}`} onClick={onClose} role="alert">
        {text}
      </div>
      <style>{`
        .user-toast {
          position: fixed; bottom: 22px; right: 22px;
          padding: 12px 18px;
          border-radius: 12px;
          color: #fff;
          font-family: var(--font-body);
          font-size: 14px;
          cursor: pointer;
          box-shadow: var(--shadow-elev);
          z-index: 9999;
          animation: userToastIn 220ms var(--ease-out-expo) both;
        }
        .user-toast-success { background: var(--accent-green); }
        .user-toast-error { background: var(--accent-red); }
        @keyframes userToastIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
