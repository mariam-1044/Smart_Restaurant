import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import api from "../api/axios";
import { aiCall } from "../api/aiCall";
import LoadingState from "../components/shared/LoadingState";
import ErrorState from "../components/shared/ErrorState";
import EmptyState from "../components/shared/EmptyState";
import DetailDrawer from "../components/shared/DetailDrawer";
import CustomerTagBadges from "../components/customers/CustomerTagBadges";
import PageHeader from "../components/shared/PageHeader";
import Card from "../components/shared/Card";
import Skeleton from "../components/shared/Skeleton";
import Badge from "../components/shared/Badge";
import {
  FaSearch,
  FaUserFriends,
  FaCoins,
  FaShoppingBag,
  FaHeart,
  FaPhone,
  FaCalendarAlt,
} from "react-icons/fa";

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

function avatarInitials(name) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}

export default function CustomerManagement() {
  const [pageState, setPageState] = useState("loading");
  const [customers, setCustomers] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [detailState, setDetailState] = useState("idle");
  const [detail, setDetail] = useState(null);
  const [recsState, setRecsState] = useState("idle");
  const [recs, setRecs] = useState([]);
  const [search, setSearch] = useState("");
  const [removingFavId, setRemovingFavId] = useState(null);
  const [favError, setFavError] = useState("");

  async function load() {
    setPageState("loading");
    try {
      const r = await api.get("/customers");
      const data = r.data.data ?? r.data;
      setCustomers(data);
      setPageState(data.length === 0 ? "empty" : "ready");
    } catch {
      setPageState("error");
    }
  }
  useEffect(() => {
    load();
  }, []);

  function loadDetail(id) {
    setDetailState("loading");
    return api
      .get(`/customers/${id}`)
      .then((r) => {
        setDetail(r.data.data ?? r.data);
        setDetailState("ready");
      })
      .catch(() => setDetailState("error"));
  }

  useEffect(() => {
    setFavError("");
    if (!openId) {
      setDetail(null);
      setRecs([]);
      setDetailState("idle");
      setRecsState("idle");
      return;
    }
    setRecsState("loading");
    loadDetail(openId);
    aiCall("get", `/v1/recommendations/${openId}`).then((res) => {
      if (!res.ok) {
        setRecsState(res.kind === "ai_unavailable" ? "ai-unavailable" : "error");
        return;
      }
      setRecs(res.data?.recommendations ?? []);
      setRecsState("ready");
    });
  }, [openId]);

  async function handleRemoveFavorite(dishId) {
    if (!openId || !dishId) return;
    setRemovingFavId(dishId);
    setFavError("");
    try {
      await api.delete(`/customers/${openId}/favorites/${dishId}`);
      await loadDetail(openId);
      await load(); // refresh the table's favoritesCount column
    } catch (err) {
      setFavError(err.response?.data?.message || "Couldn't remove that favorite.");
    } finally {
      setRemovingFavId(null);
    }
  }

  const stats = useMemo(() => {
    const total = customers.length;
    const totalSpend = customers.reduce((s, c) => s + (c.totalSpend ?? 0), 0);
    const totalOrders = customers.reduce((s, c) => s + (c.totalOrders ?? 0), 0);
    const highValue = customers.filter((c) => (c.tags ?? []).includes("High Value")).length;
    return { total, totalSpend, totalOrders, highValue };
  }, [customers]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter(
      (c) =>
        c.name?.toLowerCase().includes(term) ||
        c.phone?.toLowerCase().includes(term)
    );
  }, [customers, search]);

  return (
    <DashboardLayout>
      <div className="customers-page">
        <PageHeader
          kicker="Audience"
          title="Customers"
          subtitle="Track regulars, high-value diners, and at-risk customers — all in one view."
        />

        {pageState === "loading" && (
          <div className="customers-skeleton">
            <Skeleton.Card />
            <Skeleton.Card />
          </div>
        )}

        {pageState === "error" && (
          <ErrorState message="Failed to load customers." onRetry={load} />
        )}

        {pageState === "empty" && <EmptyState title="No customers yet" message="" />}

        {pageState === "ready" && (
          <>
            <div className="customers-stats-row">
              <CustomerStat
                icon={<FaUserFriends />}
                label="Total Customers"
                value={stats.total}
                tone="red"
              />
              <CustomerStat
                icon={<FaCoins />}
                label="Lifetime Revenue"
                value={`$${stats.totalSpend.toFixed(2)}`}
                tone="gold"
              />
              <CustomerStat
                icon={<FaShoppingBag />}
                label="Total Orders"
                value={stats.totalOrders}
                tone="info"
              />
              <CustomerStat
                icon={<FaHeart />}
                label="High Value"
                value={stats.highValue}
                tone="green"
              />
            </div>

            <div className="customers-toolbar">
              <div className="customers-search">
                <FaSearch className="customers-search-icon" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or phone…"
                />
              </div>
              <span className="customers-toolbar-meta">
                Showing {filtered.length} of {customers.length}
              </span>
            </div>

            <Card padding="p-0" className="customers-table-card">
              <div className="customers-table-wrap">
                <table className="customers-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Orders</th>
                      <th>Total Spend</th>
                      <th>Last Order</th>
                      <th>Favorites</th>
                      <th>Tags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => (
                      <tr
                        key={c._id}
                        className="customers-row"
                        onClick={() => setOpenId(c._id)}
                      >
                        <td>
                          <div className="customers-cell-id">
                            <div
                              className="customers-avatar"
                              style={{ background: avatarColor(c.name) }}
                            >
                              {avatarInitials(c.name)}
                            </div>
                            <div className="customers-cell-id-text">
                              <span className="customers-cell-name">{c.name}</span>
                              <span className="customers-cell-phone">
                                <FaPhone size={9} /> {c.phone}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="customers-cell-num">{c.totalOrders}</span>
                        </td>
                        <td>
                          <span className="customers-cell-spend">
                            ${(c.totalSpend ?? 0).toFixed(2)}
                          </span>
                        </td>
                        <td>
                          <span className="customers-cell-date">
                            {c.lastOrderAt
                              ? new Date(c.lastOrderAt).toLocaleDateString()
                              : "—"}
                          </span>
                        </td>
                        <td>
                          <Badge tone="gold" size="sm">
                            <FaHeart size={9} /> {c.favoritesCount ?? 0}
                          </Badge>
                        </td>
                        <td>
                          <CustomerTagBadges tags={c.tags ?? []} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>

      <DetailDrawer
        isOpen={!!openId}
        onClose={() => setOpenId(null)}
        title={detail?.name ?? "Customer"}
      >
        {detailState === "loading" && (
          <div className="drawer-loading">
            <Skeleton width="60%" height={20} />
            <div style={{ height: 14 }} />
            <Skeleton.Block lines={4} />
          </div>
        )}
        {detailState === "error" && (
          <ErrorState
            message="Failed to load customer."
            onRetry={() => setOpenId(openId)}
          />
        )}
        {detailState === "ready" && detail && (
          <div className="drawer-detail">
            <div className="drawer-hero">
              <div
                className="drawer-avatar"
                style={{ background: avatarColor(detail.name) }}
              >
                {avatarInitials(detail.name)}
              </div>
              <div>
                <h4 className="drawer-hero-name">{detail.name}</h4>
                <span className="drawer-hero-phone">
                  <FaPhone size={10} /> {detail.phone}
                </span>
              </div>
            </div>
            <div className="drawer-tags">
              <CustomerTagBadges tags={detail.tags ?? []} />
            </div>

            <section className="drawer-section">
              <h5 className="drawer-section-title">
                <FaShoppingBag /> Order history
              </h5>
              {(detail.orderHistory ?? []).length === 0 ? (
                <EmptyState title="No orders yet" message="" />
              ) : (
                <ul className="drawer-orders">
                  {detail.orderHistory.map((o) => (
                    <li key={o.orderId} className="drawer-order">
                      <div className="drawer-order-head">
                        <span className="drawer-order-time">
                          <FaCalendarAlt size={10} />{" "}
                          {new Date(o.placedAt).toLocaleString()}
                        </span>
                        <span className="drawer-order-total">
                          ${(o.total ?? 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="drawer-order-meta">
                        <Badge tone="info" size="sm">
                          {o.status}
                        </Badge>
                        <span className="drawer-order-items">
                          {(o.items ?? [])
                            .map((i) => `${i.dishName || "Dish"} × ${i.quantity}`)
                            .join(", ")}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="drawer-section">
              <h5 className="drawer-section-title">
                <FaHeart /> Favorites
              </h5>
              {favError && <p className="drawer-fav-error">{favError}</p>}
              {(detail.favorites ?? []).length === 0 ? (
                <p className="drawer-muted">No favorites yet.</p>
              ) : (
                <ul className="drawer-favs">
                  {detail.favorites.map((f) => (
                    <li key={f.dishId}>
                      <span className="drawer-fav-name">{f.dishName || f.dish}</span>
                      <span className="drawer-fav-right">
                        <span className="drawer-fav-count">×{f.orderCount}</span>
                        <button
                          type="button"
                          className="drawer-fav-remove"
                          title="Remove from favorites"
                          aria-label={`Remove ${f.dishName || "dish"} from favorites`}
                          disabled={removingFavId === f.dishId}
                          onClick={() => handleRemoveFavorite(f.dishId)}
                        >
                          {removingFavId === f.dishId ? "…" : "×"}
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="drawer-fav-hint">Removing a favorite only unlinks it from this customer — the dish stays on the menu.</p>
            </section>

            <section className="drawer-section">
              <h5 className="drawer-section-title">✦ Personalized recommendations</h5>
              {recsState === "loading" && (
                <LoadingState message="Loading recommendations…" />
              )}
              {recsState === "ai-unavailable" && (
                <ErrorState
                  title="Recommendations unavailable"
                  message="Try again later."
                  onRetry={() => setOpenId(openId)}
                />
              )}
              {recsState === "error" && (
                <ErrorState
                  message="Failed to load recommendations."
                  onRetry={() => setOpenId(openId)}
                />
              )}
              {recsState === "ready" &&
                (recs.length === 0 ? (
                  <EmptyState
                    title="Cold-start customer"
                    message="Not enough order history yet to generate personalized picks."
                  />
                ) : (
                  <ul className="drawer-recs">
                    {recs.map((r) => (
                      <li key={r.dishId ?? r._id} className="drawer-rec">
                        <span className="drawer-rec-name">
                          {r.name || r.dishName || "Dish"}
                        </span>
                        <span className="drawer-rec-meta">
                          <Badge tone="gold" size="sm">
                            {Math.round(
                              (r.score ?? r.confidence ?? 0) * 100
                            )}
                            %
                          </Badge>
                          <span className="drawer-rec-reason">{r.reason || ""}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ))}
            </section>
          </div>
        )}
      </DetailDrawer>

      <style>{`
        .customers-page { padding: 28px; display: flex; flex-direction: column; gap: 22px; }
        .customers-skeleton { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
        .customers-stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }

        .customers-toolbar {
          display: flex; align-items: center; justify-content: space-between;
          gap: 14px; flex-wrap: wrap;
        }
        .customers-search {
          position: relative; display: flex; align-items: center;
          flex: 1 1 320px; max-width: 420px;
        }
        .customers-search-icon {
          position: absolute; left: 14px; pointer-events: none;
          color: var(--text-muted); font-size: 13px;
        }
        .customers-search input {
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
        .customers-search input:focus {
          border-color: var(--accent-gold);
          box-shadow: 0 0 0 3px rgba(155,226,45,0.18);
        }
        .customers-toolbar-meta {
          font-family: var(--font-heading);
          font-size: 11px; letter-spacing: 0.10em; text-transform: uppercase;
          color: var(--text-muted);
        }

        /* TABLE --------------------------------------------------------- */
        .customers-table-card { padding: 0 !important; overflow: hidden; }
        .customers-table-wrap { overflow-x: auto; }
        .customers-table { width: 100%; border-collapse: collapse; }
        .customers-table th {
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
        .customers-table td {
          padding: 14px 18px;
          border-bottom: 1px solid var(--border-color);
          color: var(--text-secondary);
          font-size: 14px;
          vertical-align: middle;
        }
        .customers-row { cursor: pointer; transition: background-color 160ms var(--ease-out-expo); }
        .customers-row:hover { background: var(--bg-elevated); }
        .customers-row:last-child td { border-bottom: 0; }

        .customers-cell-id { display: flex; align-items: center; gap: 14px; min-width: 0; }
        .customers-avatar {
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
        .customers-cell-id-text { display: flex; flex-direction: column; min-width: 0; gap: 2px; }
        .customers-cell-name {
          font-family: var(--font-heading);
          font-weight: 600;
          color: var(--text-primary);
          font-size: 14px;
        }
        .customers-cell-phone {
          font-size: 12px;
          color: var(--text-muted);
          display: inline-flex; align-items: center; gap: 5px;
        }
        .customers-cell-num {
          font-family: var(--font-heading);
          font-weight: 600;
          color: var(--text-primary);
          font-size: 15px;
        }
        .customers-cell-spend {
          font-family: var(--font-heading);
          font-weight: 700;
          color: var(--accent-gold);
          font-size: 15px;
        }
        .customers-cell-date {
          font-size: 13px;
          color: var(--text-muted);
        }

        /* DRAWER -------------------------------------------------------- */
        .drawer-loading { padding: 24px; }
        .drawer-detail { padding: 22px; display: flex; flex-direction: column; gap: 20px; }
        .drawer-hero { display: flex; align-items: center; gap: 14px; }
        .drawer-avatar {
          width: 56px; height: 56px;
          border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          color: #fff;
          font-family: var(--font-heading);
          font-weight: 700;
          font-size: 18px;
          box-shadow: 0 6px 18px rgba(0,0,0,0.22);
        }
        .drawer-hero-name {
          font-family: var(--font-heading);
          font-size: 18px; font-weight: 700;
          margin: 0; color: var(--text-primary);
        }
        .drawer-hero-phone {
          display: inline-flex; align-items: center; gap: 6px;
          color: var(--text-muted); font-size: 13px; margin-top: 2px;
        }
        .drawer-tags { display: flex; }
        .drawer-section {
          background: var(--bg-elevated);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 16px;
        }
        .drawer-section-title {
          font-family: var(--font-heading);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.04em;
          color: var(--text-primary);
          margin: 0 0 10px 0;
          display: flex; align-items: center; gap: 8px;
        }
        .drawer-section-title :global(svg) { color: var(--accent-gold); }
        .drawer-muted { color: var(--text-muted); font-size: 13px; margin: 0; }

        .drawer-orders { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
        .drawer-order {
          padding: 10px 12px;
          background: var(--bg-secondary);
          border-radius: 10px;
          border: 1px solid var(--border-color);
        }
        .drawer-order-head {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 6px;
        }
        .drawer-order-time {
          font-size: 12px; color: var(--text-muted);
          display: inline-flex; align-items: center; gap: 5px;
        }
        .drawer-order-total {
          font-family: var(--font-heading);
          font-weight: 700;
          color: var(--accent-gold);
          font-size: 14px;
        }
        .drawer-order-meta {
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
        }
        .drawer-order-items {
          font-size: 12px; color: var(--text-muted);
          flex: 1; min-width: 0;
        }

        .drawer-favs { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
        .drawer-favs li {
          display: flex; justify-content: space-between; align-items: center;
          padding: 8px 12px;
          background: var(--bg-secondary);
          border-radius: 8px;
          font-size: 13px;
        }
        .drawer-fav-name { color: var(--text-primary); font-weight: 500; }
        .drawer-fav-right { display: inline-flex; align-items: center; gap: 10px; }
        .drawer-fav-count { color: var(--accent-gold); font-family: var(--font-heading); font-size: 12px; }
        .drawer-fav-remove {
          width: 22px; height: 22px; line-height: 1;
          border-radius: 50%;
          border: 1px solid var(--border-color);
          background: var(--bg-card);
          color: var(--text-muted);
          cursor: pointer;
          font-size: 14px;
          display: inline-flex; align-items: center; justify-content: center;
          transition: all 140ms var(--ease-out-expo);
        }
        .drawer-fav-remove:hover:not(:disabled) { border-color: var(--accent-red); color: var(--accent-red); }
        .drawer-fav-remove:disabled { opacity: 0.5; cursor: not-allowed; }
        .drawer-fav-error { color: var(--accent-red); font-size: 12px; margin: 0 0 8px 0; }
        .drawer-fav-hint { color: var(--text-muted); font-size: 11px; margin: 8px 0 0 0; }

        .drawer-recs { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
        .drawer-rec {
          display: flex; justify-content: space-between; align-items: center;
          padding: 10px 12px;
          background: var(--bg-secondary);
          border-radius: 8px;
          font-size: 13px;
          gap: 10px;
        }
        .drawer-rec-name { color: var(--text-primary); font-weight: 500; flex: 1; min-width: 0; }
        .drawer-rec-meta { display: inline-flex; align-items: center; gap: 8px; }
        .drawer-rec-reason { font-size: 11px; color: var(--text-muted); }

        @media (max-width: 1024px) { .customers-stats-row { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 640px) { .customers-stats-row { grid-template-columns: 1fr; } }
      `}</style>
    </DashboardLayout>
  );
}

function CustomerStat({ icon, label, value, tone = "red" }) {
  return (
    <>
      <div className={`cust-stat cust-stat-${tone}`}>
        <div className="cust-stat-icon">{icon}</div>
        <div className="cust-stat-text">
          <div className="cust-stat-label">{label}</div>
          <div className="cust-stat-value">{value}</div>
        </div>
      </div>
      <style>{`
        .cust-stat {
          display: flex; align-items: center; gap: 14px;
          padding: 18px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-soft);
          position: relative;
          overflow: hidden;
          transition: transform 200ms var(--ease-out-expo);
        }
        .cust-stat:hover { transform: translateY(-2px); }
        .cust-stat::before {
          content: "";
          position: absolute; left: 0; top: 0; bottom: 0;
          width: 3px;
        }
        .cust-stat-red::before { background: var(--accent-red); }
        .cust-stat-gold::before { background: var(--accent-gold); }
        .cust-stat-green::before { background: var(--accent-green); }
        .cust-stat-info::before { background: var(--accent-blue); }
        .cust-stat-icon {
          width: 44px; height: 44px;
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-size: 18px;
          flex-shrink: 0;
        }
        .cust-stat-red .cust-stat-icon { background: rgba(215,38,56,0.12); color: var(--accent-red); }
        .cust-stat-gold .cust-stat-icon { background: rgba(155,226,45,0.14); color: var(--accent-gold); }
        .cust-stat-green .cust-stat-icon { background: rgba(16,185,129,0.12); color: var(--accent-green); }
        .cust-stat-info .cust-stat-icon { background: rgba(59,130,246,0.12); color: var(--accent-blue); }
        .cust-stat-label {
          font-family: var(--font-heading);
          font-size: 11px; letter-spacing: 0.10em; text-transform: uppercase;
          color: var(--text-muted); font-weight: 600;
        }
        .cust-stat-value {
          font-family: var(--font-heading);
          font-size: 22px; font-weight: 700;
          color: var(--text-primary); letter-spacing: -0.01em;
          margin-top: 2px;
        }
      `}</style>
    </>
  );
}
