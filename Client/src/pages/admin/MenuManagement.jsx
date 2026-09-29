import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import api from "../../api/axios";
import LoadingState from "../../components/shared/LoadingState";
import EmptyState from "../../components/shared/EmptyState";
import ErrorState from "../../components/shared/ErrorState";
import ConfirmationModal from "../../components/shared/ConfirmationModal";
import DishFormModal from "../../components/menu/DishFormModal";
import PricingHistoryChart from "../../components/menu/PricingHistoryChart";
import PageHeader from "../../components/shared/PageHeader";
import Card from "../../components/shared/Card";
import Button from "../../components/shared/Button";
import Badge from "../../components/shared/Badge";
import Input from "../../components/shared/Input";
import Skeleton from "../../components/shared/Skeleton";
import {
  FaEdit,
  FaTrash,
  FaHistory,
  FaPlus,
  FaSearch,
  FaUtensils,
  FaCheckCircle,
  FaTimesCircle,
} from "react-icons/fa";

const CATEGORY_GRADIENTS = {
  Pizza: "linear-gradient(135deg, #DC2626, #F97316)",
  Burgers: "linear-gradient(135deg, #B45309, #F59E0B)",
  Grills: "linear-gradient(135deg, #7C2D12, #B45309)",
  Drinks: "linear-gradient(135deg, #1D4ED8, #06B6D4)",
  Desserts: "linear-gradient(135deg, #BE185D, #F472B6)",
  Sides: "linear-gradient(135deg, #047857, #10B981)",
  Pasta: "linear-gradient(135deg, #B91C1C, #C9A227)",
  Main: "linear-gradient(135deg, #7C3AED, #A78BFA)",
};

export default function MenuManagement() {
  const [pageState, setPageState] = useState("loading");
  const [dishes, setDishes] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [editing, setEditing] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [historyDish, setHistoryDish] = useState(null);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  async function fetchAll() {
    setPageState("loading");
    try {
      const [menuRes, invRes] = await Promise.all([api.get("/menu"), api.get("/inventory")]);
      const menuData = menuRes.data.data ?? menuRes.data;
      const invData = invRes.data.data ?? invRes.data;
      setDishes(menuData);
      setIngredients(invData);
      setPageState(menuData.length === 0 ? "empty" : "ready");
    } catch {
      setPageState("error");
    }
  }
  useEffect(() => {
    fetchAll();
  }, []);

  const categories = useMemo(() => {
    const set = new Set(dishes.map((d) => d.category).filter(Boolean));
    return ["All", ...Array.from(set)];
  }, [dishes]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return dishes.filter((d) => {
      const matchSearch = !term || d.name?.toLowerCase().includes(term);
      const matchCat = categoryFilter === "All" || d.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [dishes, search, categoryFilter]);

  const stats = useMemo(() => {
    const total = dishes.length;
    const available = dishes.filter((d) => d.isAvailable).length;
    const avgPrice =
      total > 0 ? dishes.reduce((s, d) => s + (d.price || 0), 0) / total : 0;
    return { total, available, unavailable: total - available, avgPrice };
  }, [dishes]);

  async function handleSubmit(values) {
    try {
      if (editing.mode === "create") await api.post("/menu", values);
      else await api.patch(`/menu/${editing.dish._id}`, values);
      setEditing(null);
      await fetchAll();
      setToast({
        kind: "success",
        text: editing.mode === "create" ? "Dish created." : "Dish updated.",
      });
    } catch (err) {
      if (err.response?.status === 409) {
        setEditing(null);
        setToast({ kind: "error", text: err.response.data.message });
        await fetchAll();
      } else if (err.response?.status === 400) {
        setToast({ kind: "error", text: err.response.data.message ?? "Invalid input." });
      } else {
        setToast({ kind: "error", text: "Something went wrong." });
      }
    }
  }

  async function handleToggleAvailability(dish) {
    try {
      await api.patch(`/menu/${dish._id}`, {
        isAvailable: !dish.isAvailable,
        __version: dish.version,
      });
      await fetchAll();
    } catch (err) {
      if (err.response?.status === 409) {
        setToast({ kind: "error", text: err.response.data.message });
        await fetchAll();
      } else {
        setToast({ kind: "error", text: "Toggle failed." });
      }
    }
  }

  async function handleDelete() {
    const dish = dishes.find((d) => d._id === deletingId);
    try {
      await api.delete(`/menu/${deletingId}`, { data: { __version: dish.version } });
      setDeletingId(null);
      await fetchAll();
      setToast({ kind: "success", text: "Dish deleted." });
    } catch (err) {
      setDeletingId(null);
      if (err.response?.status === 409) {
        setToast({ kind: "error", text: err.response.data.message });
        await fetchAll();
      } else {
        setToast({ kind: "error", text: "Delete failed." });
      }
    }
  }

  return (
    <DashboardLayout>
      <div className="menu-page">
        <PageHeader
          kicker="Catalog"
          title="Menu"
          subtitle="Curate dishes, manage availability, and tune pricing across the menu."
          actions={
            <Button
              iconLeft={<FaPlus />}
              onClick={() => setEditing({ mode: "create" })}
            >
              New dish
            </Button>
          }
        />

        {pageState === "loading" && (
          <div className="menu-skeleton">
            <Skeleton.Card />
            <Skeleton.Card />
            <Skeleton.Card />
          </div>
        )}

        {pageState === "error" && (
          <ErrorState message="Failed to load menu." onRetry={fetchAll} />
        )}

        {pageState === "empty" && (
          <EmptyState
            title="No dishes yet"
            message="Create your first dish to get started."
            action={
              <Button iconLeft={<FaPlus />} onClick={() => setEditing({ mode: "create" })}>
                New dish
              </Button>
            }
          />
        )}

        {pageState === "ready" && (
          <>
            <div className="menu-stats-row">
              <MenuStat
                icon={<FaUtensils />}
                tone="red"
                label="Total Dishes"
                value={stats.total}
              />
              <MenuStat
                icon={<FaCheckCircle />}
                tone="green"
                label="Available"
                value={stats.available}
              />
              <MenuStat
                icon={<FaTimesCircle />}
                tone="warn"
                label="Unavailable"
                value={stats.unavailable}
              />
              <MenuStat
                icon={<FaUtensils />}
                tone="gold"
                label="Avg. Price"
                value={`$${stats.avgPrice.toFixed(2)}`}
              />
            </div>

            <div className="menu-toolbar">
              <div className="menu-toolbar-left">
                <div className="menu-search">
                  <FaSearch className="menu-search-icon" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search dishes by name…"
                  />
                </div>
              </div>
              <div className="menu-toolbar-right">
                {categories.map((c) => {
                  const count =
                    c === "All"
                      ? dishes.length
                      : dishes.filter((d) => d.category === c).length;
                  // Count is rendered inline so the pill's text node never
                  // collides with the matching `<span>{c}</span>` in table cells.
                  return (
                    <button
                      key={c}
                      className={`cat-pill ${categoryFilter === c ? "is-active" : ""}`}
                      onClick={() => setCategoryFilter(c)}
                    >
                      {`${c} · ${count}`}
                    </button>
                  );
                })}
              </div>
            </div>

            <Card padding="p-0" className="menu-table-card">
              <div className="menu-table-wrap">
                <table className="menu-table">
                  <thead>
                    <tr>
                      <th className="menu-th-name">Dish</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Status</th>
                      <th>Ingredients</th>
                      <th className="menu-th-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="menu-empty-row">
                          No dishes match the current filter.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((d) => (
                        <tr key={d._id} className="menu-row">
                          <td>
                            <div className="menu-cell-name">
                              <div
                                className="menu-cell-thumb"
                                style={{
                                  background:
                                    CATEGORY_GRADIENTS[d.category] ||
                                    "linear-gradient(135deg, var(--accent-red), var(--accent-gold))",
                                }}
                              >
                                {d.imageUrl ? (
                                  <img
                                    src={d.imageUrl}
                                    alt={d.name}
                                    onError={(e) => {
                                      e.currentTarget.onerror = null;
                                      e.currentTarget.src = "/default-dish.svg";
                                    }}
                                  />
                                ) : (
                                  <span>{(d.name || "?").charAt(0).toUpperCase()}</span>
                                )}
                              </div>
                              <div className="menu-cell-name-text">
                                <span className="menu-cell-title">{d.name}</span>
                                {d.description && (
                                  <span className="menu-cell-desc">{d.description}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="cat-chip">{d.category}</span>
                          </td>
                          <td>
                            <span className="menu-price">${(d.price ?? 0).toFixed(2)}</span>
                          </td>
                          <td>
                            <button
                              className={`avail-toggle ${d.isAvailable ? "is-on" : ""}`}
                              onClick={() => handleToggleAvailability(d)}
                              type="button"
                              aria-label="Toggle availability"
                            >
                              <span className="avail-toggle-thumb" />
                              <span className="avail-toggle-label">
                                {d.isAvailable ? "Available" : "Hidden"}
                              </span>
                            </button>
                          </td>
                          <td>
                            <Badge tone="info" size="sm">
                              {d.ingredients?.length ?? 0} items
                            </Badge>
                          </td>
                          <td>
                            <div className="menu-actions">
                              <button
                                onClick={() => setHistoryDish(d)}
                                title="Pricing history"
                                className="menu-icon-btn"
                              >
                                <FaHistory />
                              </button>
                              <button
                                onClick={() => setEditing({ mode: "edit", dish: d })}
                                title="Edit dish"
                                className="menu-icon-btn edit"
                              >
                                <FaEdit />
                              </button>
                              <button
                                onClick={() => setDeletingId(d._id)}
                                title="Delete dish"
                                className="menu-icon-btn danger"
                              >
                                <FaTrash />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>

      <DishFormModal
        isOpen={!!editing}
        mode={editing?.mode ?? "create"}
        dish={editing?.dish}
        ingredientOptions={ingredients}
        onSubmit={handleSubmit}
        onCancel={() => setEditing(null)}
      />
      <ConfirmationModal
        isOpen={!!deletingId}
        title="Delete dish"
        body="This dish will be removed from the menu. This action cannot be undone."
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeletingId(null)}
      />
      {historyDish && (
        <ConfirmationModal
          isOpen={true}
          title={`Pricing history — ${historyDish.name}`}
          body={<PricingHistoryChart history={historyDish.priceHistory ?? []} />}
          confirmLabel="Close"
          onConfirm={() => setHistoryDish(null)}
          onCancel={() => setHistoryDish(null)}
        />
      )}
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <style>{`
        .menu-page { padding: 28px; display: flex; flex-direction: column; gap: 22px; }
        .menu-skeleton { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }

        /* STATS --------------------------------------------------------- */
        .menu-stats-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        /* TOOLBAR ------------------------------------------------------- */
        .menu-toolbar {
          display: flex; align-items: center; justify-content: space-between;
          gap: 14px; flex-wrap: wrap;
        }
        .menu-toolbar-left { flex: 0 0 auto; }
        .menu-toolbar-right {
          display: flex; gap: 8px; flex-wrap: wrap;
          flex: 1 1 auto;
          justify-content: flex-end;
        }
        .menu-search {
          position: relative; display: flex; align-items: center;
        }
        .menu-search-icon {
          position: absolute; left: 14px; pointer-events: none;
          color: var(--text-muted); font-size: 13px;
        }
        .menu-search input {
          padding: 10px 14px 10px 38px;
          min-width: 280px;
          border-radius: 999px;
          background: var(--bg-secondary);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
          font-size: 14px;
          outline: none;
          transition: border-color 160ms var(--ease-out-expo), box-shadow 160ms var(--ease-out-expo);
        }
        .menu-search input:focus {
          border-color: var(--accent-gold);
          box-shadow: 0 0 0 3px rgba(155,226,45,0.18);
        }

        .cat-pill {
          padding: 8px 16px;
          border-radius: 999px;
          font-family: var(--font-heading);
          font-size: 12px;
          letter-spacing: 0.04em;
          font-weight: 600;
          background: var(--bg-elevated);
          color: var(--text-secondary);
          border: 1px solid var(--border-color);
          cursor: pointer;
          transition: all 200ms var(--ease-out-expo);
        }
        .cat-pill:hover {
          border-color: var(--accent-gold);
          color: var(--accent-gold);
        }
        .cat-pill.is-active {
          background: linear-gradient(135deg, var(--accent-red), var(--accent-red-soft));
          color: #fff;
          border-color: var(--accent-red);
          box-shadow: 0 6px 18px rgba(215,38,56,0.3);
        }

        /* TABLE --------------------------------------------------------- */
        .menu-table-card { padding: 0 !important; overflow: hidden; }
        .menu-table-wrap { overflow-x: auto; }
        .menu-table { width: 100%; border-collapse: collapse; }
        .menu-table th {
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
        .menu-th-name { width: 35%; }
        .menu-th-actions { text-align: right; }
        .menu-table td {
          padding: 14px 18px;
          border-bottom: 1px solid var(--border-color);
          color: var(--text-secondary);
          font-size: 14px;
          vertical-align: middle;
        }
        .menu-row { transition: background-color 160ms var(--ease-out-expo); }
        .menu-row:hover { background: var(--bg-elevated); }
        .menu-row:last-child td { border-bottom: 0; }
        .menu-empty-row { text-align: center; padding: 38px !important; color: var(--text-muted); }

        .menu-cell-name { display: flex; align-items: center; gap: 14px; min-width: 0; }
        .menu-cell-thumb {
          width: 46px; height: 46px;
          border-radius: 12px;
          flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          color: #fff;
          font-family: var(--font-heading);
          font-weight: 700;
          font-size: 18px;
          letter-spacing: -0.02em;
          overflow: hidden;
          box-shadow: 0 4px 14px rgba(0,0,0,0.18);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .menu-cell-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .menu-cell-name-text { display: flex; flex-direction: column; min-width: 0; }
        .menu-cell-title {
          font-family: var(--font-heading);
          font-weight: 600;
          color: var(--text-primary);
          font-size: 14px;
        }
        .menu-cell-desc {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 2px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 360px;
        }

        .cat-chip {
          display: inline-flex; align-items: center;
          padding: 5px 12px;
          border-radius: 999px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-color);
          color: var(--text-primary);
          font-family: var(--font-heading);
          font-size: 11px;
          letter-spacing: 0.04em;
          font-weight: 600;
        }
        .menu-price {
          font-family: var(--font-heading);
          font-size: 15px;
          font-weight: 700;
          color: var(--accent-gold);
          letter-spacing: -0.01em;
        }

        /* Availability toggle */
        .avail-toggle {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 5px 12px 5px 5px;
          border-radius: 999px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-color);
          color: var(--text-muted);
          font-family: var(--font-heading);
          font-size: 11px;
          letter-spacing: 0.04em;
          font-weight: 600;
          cursor: pointer;
          transition: all 200ms var(--ease-out-expo);
        }
        .avail-toggle-thumb {
          width: 14px; height: 14px;
          border-radius: 50%;
          background: var(--text-muted);
          transition: all 200ms var(--ease-out-expo);
          flex-shrink: 0;
        }
        .avail-toggle.is-on {
          background: rgba(16,185,129,0.14);
          border-color: rgba(16,185,129,0.34);
          color: var(--accent-green);
        }
        .avail-toggle.is-on .avail-toggle-thumb {
          background: var(--accent-green);
          box-shadow: 0 0 8px rgba(16,185,129,0.6);
        }
        .avail-toggle:hover { transform: translateY(-1px); }

        /* Action icons */
        .menu-actions { display: flex; gap: 6px; justify-content: flex-end; }
        .menu-icon-btn {
          width: 32px; height: 32px;
          border-radius: 8px;
          background: transparent;
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          display: inline-flex; align-items: center; justify-content: center;
          cursor: pointer;
          font-size: 13px;
          transition: all 200ms var(--ease-out-expo);
        }
        .menu-icon-btn:hover {
          color: var(--text-primary);
          border-color: var(--text-primary);
          transform: translateY(-1px);
        }
        .menu-icon-btn.edit:hover {
          color: var(--accent-gold);
          border-color: var(--accent-gold);
          background: rgba(155,226,45,0.08);
        }
        .menu-icon-btn.danger:hover {
          color: var(--accent-red);
          border-color: var(--accent-red);
          background: rgba(215,38,56,0.08);
        }

        @media (max-width: 1024px) {
          .menu-stats-row { grid-template-columns: repeat(2, 1fr); }
          .menu-search input { min-width: 0; width: 100%; }
        }
        @media (max-width: 640px) {
          .menu-stats-row { grid-template-columns: 1fr; }
          .menu-toolbar-left, .menu-toolbar-right { width: 100%; }
        }
      `}</style>
    </DashboardLayout>
  );
}

function MenuStat({ icon, label, value, tone = "red" }) {
  return (
    <>
      <div className={`menu-stat menu-stat-${tone}`}>
        <div className="menu-stat-icon">{icon}</div>
        <div>
          <div className="menu-stat-label">{label}</div>
          <div className="menu-stat-value">{value}</div>
        </div>
      </div>
      <style>{`
        .menu-stat {
          display: flex; align-items: center; gap: 14px;
          padding: 16px 18px;
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-color);
          background: var(--bg-card);
          box-shadow: var(--shadow-soft);
          position: relative;
          overflow: hidden;
        }
        .menu-stat::before {
          content: ""; position: absolute; left: 0; top: 0; bottom: 0;
          width: 3px;
        }
        .menu-stat-red::before { background: var(--accent-red); }
        .menu-stat-green::before { background: var(--accent-green); }
        .menu-stat-warn::before { background: #F59E0B; }
        .menu-stat-gold::before { background: var(--accent-gold); }
        .menu-stat-icon {
          width: 38px; height: 38px;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px;
          flex-shrink: 0;
        }
        .menu-stat-red .menu-stat-icon { background: rgba(215,38,56,0.12); color: var(--accent-red); }
        .menu-stat-green .menu-stat-icon { background: rgba(16,185,129,0.12); color: var(--accent-green); }
        .menu-stat-warn .menu-stat-icon { background: rgba(245,158,11,0.14); color: #F59E0B; }
        .menu-stat-gold .menu-stat-icon { background: rgba(155,226,45,0.14); color: var(--accent-gold); }
        .menu-stat-label {
          font-family: var(--font-heading);
          font-size: 11px; letter-spacing: 0.10em; text-transform: uppercase;
          color: var(--text-muted); font-weight: 600;
        }
        .menu-stat-value {
          font-family: var(--font-heading);
          font-size: 22px; font-weight: 700;
          color: var(--text-primary); letter-spacing: -0.01em;
          margin-top: 2px;
        }
      `}</style>
    </>
  );
}

function Toast({ kind, text, onClose }) {
  return (
    <div
      className={`menu-toast menu-toast-${kind}`}
      onClick={onClose}
      role="alert"
    >
      {text}
      <style>{`
        .menu-toast {
          position: fixed; bottom: 22px; right: 22px;
          padding: 12px 18px;
          border-radius: 12px;
          color: #fff;
          font-family: var(--font-body);
          font-size: 14px;
          cursor: pointer;
          box-shadow: var(--shadow-elev);
          z-index: 9999;
          animation: menuToastIn 220ms var(--ease-out-expo) both;
        }
        .menu-toast-success { background: var(--accent-green); }
        .menu-toast-error { background: var(--accent-red); }
        @keyframes menuToastIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
