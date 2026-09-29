import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowUp,
  FaArrowDown,
  FaExclamationTriangle,
  FaUtensils,
  FaCoins,
  FaLeaf,
  FaFire,
  FaBolt,
  FaCheckCircle,
} from "react-icons/fa";
import Chart from "../components/Chart";
import DashboardLayout from "../layouts/DashboardLayout";
import { fetchDashboardStats } from "../api/dashboardApi";
import PageHeader from "../components/shared/PageHeader";
import Card from "../components/shared/Card";
import Skeleton from "../components/shared/Skeleton";
import Button from "../components/shared/Button";
import Badge from "../components/shared/Badge";
import "../styles/dashboard.css";

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalSales: 0,
    totalOrders: 0,
    avgOrder: 0,
    foodWaste: 0,
    topDish: "Loading...",
    chartData: [],
    topDishes: [],
    alerts: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchDashboardStats();

      const backendAlerts = [];
      if (data?.inventoryAlerts) {
        (data.inventoryAlerts.details?.lowStockItems || []).forEach((item) =>
          backendAlerts.push({
            id: `low-${item}`,
            title: "Low Stock",
            message: `${item} is running low. Please restock.`,
            tone: "warning",
            target: "/inventory",
          })
        );
        (data.inventoryAlerts.details?.expiredItems || []).forEach((item) =>
          backendAlerts.push({
            id: `exp-${item}`,
            title: "Expired",
            message: `${item} has expired and moved to waste.`,
            tone: "danger",
            target: "/inventory",
          })
        );
      }

      setStats({
        totalSales: data?.financials?.totalRevenue || 0,
        totalOrders: data?.financials?.totalOrders || 0,
        avgOrder: data?.financials?.averageOrderValue || 0,
        foodWaste: data?.wasteAnalytics?.wastePercentage || 0,
        topDish: data?.topDishes?.[0]?.name || "N/A",
        chartData: Object.entries(data?.salesTrends || {}).map(([name, sales]) => ({
          name,
          sales,
        })),
        topDishes:
          data?.topDishes?.slice(0, 5).map((d) => ({
            name: d.name,
            percentage: d.percentage,
            orders: d.orders,
          })) || [],
        alerts: backendAlerts,
      });
    } catch (err) {
      console.error("Error fetching dashboard stats:", err);
      setError("Failed to load real-time data. Showing default data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const wasteIsHealthy = Number(stats.foodWaste) < 8;

  return (
    <DashboardLayout>
      <div className="dashboard-content">
        <PageHeader
          kicker="Control Center"
          title="Smart Restaurant Overview"
          subtitle="Live financial signals, kitchen waste analytics, and AI alerts in one place."
          actions={<Button variant="secondary" onClick={load}>Refresh</Button>}
        />

        {/* HERO BAND — primary KPI + status pulse */}
        <div className="hero-band">
          <div className="hero-band-bg" aria-hidden />
          <div className="hero-band-content">
            <div className="hero-band-meta">
              <span className="hero-kicker">
                <span className="hero-kicker-dot" /> LIVE · {new Date().toLocaleDateString()}
              </span>
              <h2 className="hero-title">Today's Performance</h2>
              <p className="hero-sub">
                Real-time signals from sales, kitchen, and AI engines.
              </p>
            </div>
            <div className="hero-band-stats">
              <HeroStat
                label="Revenue"
                value={`${stats.totalSales.toLocaleString()} EGP`}
                trend="+18%"
                trendDirection="up"
                loading={loading}
              />
              <HeroStat
                label="Orders"
                value={stats.totalOrders}
                trend="+5"
                trendDirection="up"
                loading={loading}
              />
              <HeroStat
                label="Avg. Ticket"
                value={`${(stats.avgOrder || 0).toLocaleString()} EGP`}
                trend="—"
                loading={loading}
              />
              <HeroStat
                label="Waste"
                value={`${stats.foodWaste}%`}
                trend={wasteIsHealthy ? "Healthy" : "High"}
                trendDirection={wasteIsHealthy ? "up" : "down"}
                tone={wasteIsHealthy ? "ok" : "warn"}
                loading={loading}
              />
            </div>
          </div>
        </div>

        {/* KPI MOSAIC — colorful stacked cards */}
        <div className="kpi-mosaic">
          <KpiTile
            kicker="Today"
            label="Total Sales"
            value={`${stats.totalSales.toLocaleString()}`}
            unit="EGP"
            icon={<FaCoins />}
            tone="red"
            sparkle
            loading={loading}
          />
          <KpiTile
            kicker="Kitchen"
            label="Food Waste"
            value={`${stats.foodWaste}`}
            unit="%"
            icon={<FaLeaf />}
            tone="green"
            loading={loading}
          />
          <KpiTile
            kicker="Bestseller"
            label="Top Dish"
            value={stats.topDish}
            icon={<FaFire />}
            tone="gold"
            loading={loading}
          />
        </div>

        <div className="charts-row">
          <Card padding="p-6" className="dashboard-chart-card">
            <div className="card-row-head">
              <div>
                <span className="card-row-kicker">Trend</span>
                <h3 className="card-row-title">Sales Trends</h3>
              </div>
              <Badge tone="gold" glow>
                <FaBolt size={9} /> Live
              </Badge>
            </div>
            {loading ? (
              <Skeleton width="100%" height={260} radius={12} />
            ) : (
              <Chart data={stats.chartData} />
            )}
          </Card>

          <Card padding="p-6" className="dashboard-dishes-card">
            <div className="card-row-head">
              <div>
                <span className="card-row-kicker">Leaderboard</span>
                <h3 className="card-row-title">Top Selling Dishes</h3>
              </div>
              <Badge tone="info">{stats.topDishes.length}</Badge>
            </div>
            {loading ? (
              <Skeleton.Block lines={5} />
            ) : stats.topDishes.length > 0 ? (
              <ul className="leaderboard">
                {stats.topDishes.map((dish, index) => (
                  <li key={index} className={`leaderboard-row rank-${index}`}>
                    <span className="leaderboard-rank">
                      <span className="leaderboard-rank-num">#{index + 1}</span>
                    </span>
                    <div className="leaderboard-body">
                      <div className="leaderboard-name-row">
                        <span className="leaderboard-name">{dish.name}</span>
                        <span className="leaderboard-pct">{dish.percentage}%</span>
                      </div>
                      <div className="leaderboard-bar">
                        <div
                          className={`leaderboard-fill rank-${index}`}
                          style={{ width: `${dish.percentage}%` }}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No sales data yet.</p>
            )}
          </Card>
        </div>

        <Card padding="p-6" className="dashboard-alerts-card">
          <div className="card-row-head">
            <div>
              <span className="card-row-kicker">Operations</span>
              <h3 className="card-row-title">System Notifications</h3>
            </div>
            <Badge
              tone={stats.alerts.length > 0 ? "danger" : "success"}
              glow
            >
              {stats.alerts.length > 0
                ? `${stats.alerts.length} alerts`
                : "All clear"}
            </Badge>
          </div>
          {stats.alerts.length > 0 ? (
            <div className="alerts-grid">
              {stats.alerts.map((alert) => (
                <div key={alert.id} className={`alert-row alert-${alert.tone}`}>
                  <div className="alert-row-icon">
                    <FaExclamationTriangle />
                  </div>
                  <div className="alert-row-text">
                    <h4>{alert.title}</h4>
                    <p>{alert.message}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => navigate(alert.target)}
                  >
                    View
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="all-clear">
              <FaCheckCircle className="all-clear-icon" />
              <div>
                <strong>All systems nominal.</strong>
                <p>No critical alerts at the moment. Everything looks good.</p>
              </div>
            </div>
          )}
        </Card>

        {error && <div className="dashboard-error">{error}</div>}
      </div>

      <style>{`
        .dashboard-content { padding: 28px; display: flex; flex-direction: column; gap: 22px; }
        .muted { color: var(--text-muted); margin: 0; }

        /* HERO BAND ----------------------------------------------------- */
        .hero-band {
          position: relative;
          overflow: hidden;
          border-radius: var(--radius-xl);
          border: 1px solid var(--border-color);
          color: #fff;
          isolation: isolate;
          box-shadow: var(--shadow-elev);
        }
        .hero-band-bg {
          position: absolute; inset: 0; z-index: -1;
          background:
            radial-gradient(800px 320px at 12% 0%, rgba(31,122,63,0.55), transparent 60%),
            radial-gradient(700px 320px at 95% 100%, rgba(155,226,45,0.32), transparent 60%),
            linear-gradient(135deg, #0B3D2E, #07130E);
        }
        .hero-band-bg::after {
          content: "";
          position: absolute; inset: 0;
          background-image:
            linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px);
          background-size: 32px 32px;
          mask-image: radial-gradient(circle at 50% 50%, #000 0%, transparent 75%);
          -webkit-mask-image: radial-gradient(circle at 50% 50%, #000 0%, transparent 75%);
        }
        .hero-band-content {
          padding: 28px 32px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 32px;
          align-items: center;
        }
        .hero-band-meta { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .hero-kicker {
          display: inline-flex; align-items: center; gap: 8px;
          font-family: var(--font-heading); font-size: 11px;
          letter-spacing: 0.18em; text-transform: uppercase;
          color: rgba(255,255,255,0.7);
        }
        .hero-kicker-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: var(--accent-lime);
          box-shadow: 0 0 16px rgba(155,226,45,0.85);
          animation: heroBeat 1.6s ease-in-out infinite;
        }
        @keyframes heroBeat {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.6; }
        }
        .hero-title {
          font-family: var(--font-heading);
          font-size: clamp(22px, 2.6vw, 32px);
          font-weight: 700;
          margin: 0;
          letter-spacing: -0.02em;
          line-height: 1.05;
          background: linear-gradient(120deg, #fff 0%, var(--accent-lime) 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .hero-sub { color: rgba(255,255,255,0.72); margin: 4px 0 0 0; font-size: 13px; }

        .hero-band-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(120px, 1fr));
          gap: 10px;
        }
        .hero-stat {
          padding: 14px 16px;
          border-radius: 14px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.10);
          backdrop-filter: blur(10px);
          display: flex; flex-direction: column; gap: 4px;
          min-width: 120px;
        }
        .hero-stat-label {
          font-family: var(--font-heading); font-size: 10px;
          letter-spacing: 0.16em; text-transform: uppercase;
          color: rgba(255,255,255,0.6);
        }
        .hero-stat-value {
          font-family: var(--font-heading); font-size: 18px; font-weight: 700;
          color: #fff; letter-spacing: -0.01em; white-space: nowrap;
        }
        .hero-stat-trend {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 11px; font-family: var(--font-heading);
          padding: 2px 8px; border-radius: 999px; width: fit-content;
        }
        .hero-stat-trend.up { background: rgba(16,185,129,0.18); color: #34D399; }
        .hero-stat-trend.down { background: rgba(215,38,56,0.20); color: #FCA5A5; }
        .hero-stat-trend.warn { background: rgba(245,158,11,0.20); color: #FCD34D; }
        .hero-stat-trend.ok { background: rgba(16,185,129,0.18); color: #34D399; }
        .hero-stat-trend.neutral { background: rgba(255,255,255,0.10); color: rgba(255,255,255,0.7); }

        /* KPI MOSAIC ---------------------------------------------------- */
        .kpi-mosaic { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }

        /* Charts row ---------------------------------------------------- */
        .charts-row { display: grid; grid-template-columns: 1.7fr 1fr; gap: 16px; }
        .dashboard-chart-card,
        .dashboard-dishes-card,
        .dashboard-alerts-card { display: flex; flex-direction: column; gap: 14px; }
        .card-row-head {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px;
        }
        .card-row-kicker {
          display: block;
          font-family: var(--font-heading); font-size: 10px;
          letter-spacing: 0.18em; text-transform: uppercase;
          color: var(--accent-gold);
          margin-bottom: 4px;
        }
        .card-row-title {
          font-family: var(--font-heading); font-size: 16px; font-weight: 700;
          margin: 0; letter-spacing: -0.01em; color: var(--text-primary);
        }

        /* Leaderboard --------------------------------------------------- */
        .leaderboard { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 14px; }
        .leaderboard-row {
          display: flex; align-items: center; gap: 12px;
          padding: 8px 0;
          border-bottom: 1px solid var(--border-color);
        }
        .leaderboard-row:last-child { border-bottom: 0; padding-bottom: 0; }
        .leaderboard-rank {
          width: 32px; height: 32px;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-heading); font-size: 11px; font-weight: 700;
          letter-spacing: 0.04em;
          flex-shrink: 0;
        }
        .leaderboard-row.rank-0 .leaderboard-rank {
          background: linear-gradient(135deg, var(--accent-red), var(--accent-red-soft));
          color: #fff; box-shadow: var(--glow-red);
        }
        .leaderboard-row.rank-1 .leaderboard-rank {
          background: linear-gradient(135deg, var(--accent-gold), var(--accent-gold-soft));
          color: #1A1408;
        }
        .leaderboard-row.rank-2 .leaderboard-rank {
          background: linear-gradient(135deg, var(--accent-green), #34D399);
          color: #fff;
        }
        .leaderboard-row.rank-3 .leaderboard-rank,
        .leaderboard-row.rank-4 .leaderboard-rank {
          background: var(--bg-elevated);
          color: var(--text-secondary);
          border: 1px solid var(--border-color);
        }
        .leaderboard-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
        .leaderboard-name-row { display: flex; justify-content: space-between; align-items: baseline; }
        .leaderboard-name { font-family: var(--font-heading); font-weight: 600; font-size: 13px; color: var(--text-primary); }
        .leaderboard-pct { font-family: var(--font-heading); color: var(--text-muted); font-size: 12px; }
        .leaderboard-bar { height: 6px; background: var(--bg-elevated); border-radius: 999px; overflow: hidden; }
        .leaderboard-fill { height: 100%; border-radius: 999px; transition: width 0.6s var(--ease-out-expo); }
        .leaderboard-fill.rank-0 { background: linear-gradient(90deg, var(--accent-red), var(--accent-red-soft)); box-shadow: var(--glow-red); }
        .leaderboard-fill.rank-1 { background: linear-gradient(90deg, var(--accent-gold), var(--accent-gold-soft)); }
        .leaderboard-fill.rank-2 { background: linear-gradient(90deg, var(--accent-green), #34D399); }
        .leaderboard-fill.rank-3 { background: linear-gradient(90deg, var(--accent-blue), #60A5FA); }
        .leaderboard-fill.rank-4 { background: var(--text-muted); }

        /* Alerts -------------------------------------------------------- */
        .alerts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 12px;
        }
        .alert-row {
          display: flex; align-items: center; gap: 12px;
          padding: 14px;
          border-radius: 14px;
          border: 1px solid var(--border-color);
          background: var(--bg-elevated);
        }
        .alert-warning { border-color: rgba(245,158,11,0.35); background: rgba(245,158,11,0.06); }
        .alert-danger { border-color: rgba(215,38,56,0.35); background: rgba(215,38,56,0.06); }
        .alert-row-icon {
          width: 38px; height: 38px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 10px;
          background: var(--status-warn-bg);
          color: var(--status-warn-fg);
          flex-shrink: 0;
        }
        .alert-danger .alert-row-icon { background: var(--status-danger-bg); color: var(--status-danger-fg); }
        .alert-row-text { flex: 1; min-width: 0; }
        .alert-row-text h4 {
          margin: 0 0 2px 0;
          font-family: var(--font-heading); font-size: 14px;
        }
        .alert-row-text p { margin: 0; color: var(--text-muted); font-size: 12px; line-height: 1.4; }

        .all-clear {
          display: flex; align-items: center; gap: 14px;
          padding: 18px;
          background: var(--status-success-bg);
          border: 1px solid rgba(16,185,129,0.32);
          border-radius: 14px;
        }
        .all-clear-icon { color: var(--accent-green); font-size: 24px; }
        .all-clear strong { font-family: var(--font-heading); color: var(--text-primary); display: block; }
        .all-clear p { margin: 2px 0 0 0; color: var(--text-muted); font-size: 13px; }

        .dashboard-error {
          background: var(--status-warn-bg);
          color: var(--status-warn-fg);
          padding: 12px 16px;
          border-radius: 12px;
          border: 1px solid rgba(245,158,11,0.32);
          font-size: 13px;
        }

        @media (max-width: 1080px) {
          .hero-band-content { grid-template-columns: 1fr; }
          .hero-band-stats { grid-template-columns: repeat(2, 1fr); }
          .kpi-mosaic { grid-template-columns: 1fr 1fr; }
          .charts-row { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          .hero-band-content { padding: 22px; }
          .kpi-mosaic { grid-template-columns: 1fr; }
        }
      `}</style>
    </DashboardLayout>
  );
}

function HeroStat({ label, value, trend, trendDirection, tone, loading }) {
  const trendClass = tone || trendDirection || "neutral";
  return (
    <div className="hero-stat">
      <span className="hero-stat-label">{label}</span>
      {loading ? (
        <Skeleton width="80%" height={18} radius={6} />
      ) : (
        <span className="hero-stat-value">{value}</span>
      )}
      {trend && (
        <span className={`hero-stat-trend ${trendClass}`}>
          {trendDirection === "up" && <FaArrowUp size={9} />}
          {trendDirection === "down" && <FaArrowDown size={9} />}
          {trend}
        </span>
      )}
    </div>
  );
}

function KpiTile({ kicker, label, value, unit, icon, tone = "red", sparkle, loading }) {
  return (
    <>
      <div className={`kpi-tile kpi-tile-${tone}`}>
        <div className="kpi-tile-bg" aria-hidden />
        <div className="kpi-tile-icon">{icon}</div>
        <div className="kpi-tile-text">
          <span className="kpi-tile-kicker">{kicker}</span>
          {loading ? (
            <Skeleton width="70%" height={26} radius={8} />
          ) : (
            <span className="kpi-tile-value">
              {value}
              {unit && <span className="kpi-tile-unit">{unit}</span>}
            </span>
          )}
          <span className="kpi-tile-label">{label}</span>
        </div>
        {sparkle && <div className="kpi-tile-sparkle" aria-hidden />}
      </div>
      <style>{`
        .kpi-tile {
          position: relative;
          padding: 22px;
          border-radius: var(--radius-lg);
          color: #fff;
          overflow: hidden;
          display: flex; flex-direction: column; gap: 12px;
          min-height: 148px;
          isolation: isolate;
          border: 1px solid var(--border-color);
          box-shadow: var(--shadow-soft);
          transition: transform 240ms var(--ease-out-expo), box-shadow 240ms var(--ease-out-expo);
        }
        .kpi-tile:hover {
          transform: translateY(-3px);
          box-shadow: var(--shadow-elev);
        }
        .kpi-tile-bg { position: absolute; inset: 0; z-index: -1; }
        .kpi-tile-red .kpi-tile-bg {
          background:
            radial-gradient(400px 200px at 100% 0%, rgba(255,255,255,0.18), transparent 60%),
            linear-gradient(135deg, #B91C2A 0%, var(--accent-red) 100%);
        }
        .kpi-tile-gold .kpi-tile-bg {
          background:
            radial-gradient(400px 200px at 100% 0%, rgba(255,255,255,0.18), transparent 60%),
            linear-gradient(135deg, #8E6F1A 0%, var(--accent-gold) 100%);
        }
        .kpi-tile-green .kpi-tile-bg {
          background:
            radial-gradient(400px 200px at 100% 0%, rgba(255,255,255,0.18), transparent 60%),
            linear-gradient(135deg, #047857 0%, var(--accent-green) 100%);
        }

        .kpi-tile-icon {
          width: 44px; height: 44px;
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.18);
          color: #fff;
          font-size: 18px;
          backdrop-filter: blur(8px);
        }
        .kpi-tile-text { display: flex; flex-direction: column; gap: 4px; }
        .kpi-tile-kicker {
          font-family: var(--font-heading); font-size: 10px;
          letter-spacing: 0.18em; text-transform: uppercase;
          color: rgba(255,255,255,0.75);
        }
        .kpi-tile-value {
          display: inline-flex; align-items: baseline; gap: 4px;
          font-family: var(--font-heading); font-size: 28px; font-weight: 700;
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .kpi-tile-unit { font-size: 14px; opacity: 0.8; font-weight: 500; }
        .kpi-tile-label {
          font-size: 12px; color: rgba(255,255,255,0.78);
          letter-spacing: 0.04em;
        }
        .kpi-tile-sparkle {
          position: absolute; top: -10px; right: -10px;
          width: 80px; height: 80px;
          background: radial-gradient(circle, rgba(255,255,255,0.28) 0%, transparent 70%);
          border-radius: 50%;
          pointer-events: none;
        }
      `}</style>
    </>
  );
}
