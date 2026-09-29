import { useEffect, useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import api from "../../api/axios";
import { aiCall } from "../../api/aiCall";
import LoadingState from "../../components/shared/LoadingState";
import ErrorState from "../../components/shared/ErrorState";
import EmptyState from "../../components/shared/EmptyState";
import ForecastChart from "../../components/ai/ForecastChart";
import DemandAlertBanner from "../../components/ai/DemandAlertBanner";
import StaffingSuggestionCard from "../../components/ai/StaffingSuggestionCard";
import PageHeader from "../../components/shared/PageHeader";
import Card from "../../components/shared/Card";
import Button from "../../components/shared/Button";
import Skeleton from "../../components/shared/Skeleton";
import Badge from "../../components/shared/Badge";
import { FaDownload, FaUtensils, FaCalendarAlt, FaChartArea } from "react-icons/fa";

export default function DemandForecast() {
  const [dishes, setDishes] = useState([]);
  const [selectorState, setSelectorState] = useState("loading");
  const [dishId, setDishId] = useState("");
  const [days, setDays] = useState(7);
  const [forecastState, setForecastState] = useState("idle");
  const [forecast, setForecast] = useState(null);

  useEffect(() => {
    api
      .get("/menu")
      .then((r) => {
        setDishes(r.data.data ?? r.data);
        setSelectorState("ready");
      })
      .catch(() => setSelectorState("error"));
  }, []);

  useEffect(() => {
    if (!dishId) {
      setForecastState("idle");
      setForecast(null);
      return;
    }
    setForecastState("loading");
    setForecast(null);
    aiCall("post", "/v1/ai/forecast", { dishId, daysAhead: days }).then((res) => {
      if (!res.ok) {
        setForecastState(
          res.kind === "ai_unavailable"
            ? "ai-unavailable"
            : res.kind === "cold_start"
            ? "insufficient-history"
            : "error"
        );
        if (res.kind === "cold_start")
          setForecast({
            historyStatus: "insufficient",
            forecast: [],
            coldStartReason: res.message,
          });
        return;
      }
      setForecast(res.data);
      if (res.data.historyStatus === "insufficient")
        setForecastState("insufficient-history");
      else if ((res.data.forecast ?? []).length === 0) setForecastState("idle");
      else setForecastState("ready");
    });
  }, [dishId, days]);

  function exportCsv() {
    if (!forecast?.forecast?.length) return;
    const header = "date,predictedQuantity,lowerBound,upperBound\n";
    const rows = forecast.forecast
      .map(
        (r) =>
          `${r.date},${r.predictedQuantity},${r.lowerBound},${r.upperBound}`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `forecast-${forecast.dishName}-${days}d-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalPredicted = forecast?.forecast?.reduce(
    (s, r) => s + (r.predictedQuantity || 0),
    0
  );
  const peakDay = forecast?.forecast?.reduce(
    (max, r) => ((r.predictedQuantity || 0) > (max?.predictedQuantity || 0) ? r : max),
    null
  );

  return (
    <DashboardLayout>
      <div className="forecast-page">
        <PageHeader
          kicker="AI Engine"
          title="Demand Forecast"
          subtitle="Predict tomorrow's kitchen load. Plan ingredients, prep, and staffing with confidence."
          actions={
            forecastState === "ready" ? (
              <Button
                variant="secondary"
                iconLeft={<FaDownload />}
                onClick={exportCsv}
              >
                Export CSV
              </Button>
            ) : null
          }
        />

        <Card padding="p-6" className="forecast-controls">
          <div className="forecast-control-row">
            <div className="forecast-control">
              <label className="forecast-control-label">Dish</label>
              {selectorState === "loading" && (
                <span className="forecast-control-msg muted">Loading dishes…</span>
              )}
              {selectorState === "error" && (
                <span className="forecast-control-msg danger">
                  Failed to load dishes.
                </span>
              )}
              {selectorState === "ready" && (
                <select
                  value={dishId}
                  onChange={(e) => setDishId(e.target.value)}
                  className="forecast-select"
                >
                  <option value="">Choose a dish…</option>
                  {dishes.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="forecast-control">
              <label className="forecast-control-label">Horizon</label>
              <div className="forecast-period">
                {[7, 30].map((n) => (
                  <button
                    key={n}
                    onClick={() => setDays(n)}
                    className={`forecast-period-btn ${days === n ? "is-active" : ""}`}
                  >
                    {n}d
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {forecastState === "idle" && (
          <EmptyState
            title="Pick a dish to forecast"
            message="Choose a dish above to see its predicted demand, confidence band, and staffing recommendation."
          />
        )}
        {forecastState === "loading" && (
          <Card padding="p-6">
            <Skeleton width="40%" height={20} />
            <div style={{ height: 14 }} />
            <Skeleton width="100%" height={280} radius={12} />
          </Card>
        )}
        {forecastState === "error" && (
          <ErrorState
            message="Failed to load forecast."
            onRetry={() => setDishId(dishId)}
          />
        )}
        {forecastState === "ai-unavailable" && (
          <ErrorState
            title="AI forecast service unavailable"
            message="Try again later."
            onRetry={() => setDishId(dishId)}
          />
        )}
        {forecastState === "insufficient-history" && (
          <>
            <div className="forecast-cold">
              <strong>Insufficient history for spike detection.</strong>{" "}
              This dish has fewer than 14 days of order history.
            </div>
            {forecast?.forecast?.length > 0 && (
              <Card padding="p-6">
                <ForecastChart data={forecast.forecast} />
              </Card>
            )}
          </>
        )}
        {forecastState === "ready" && forecast && (
          <>
            {forecast.spikeAlert?.triggered && (
              <DemandAlertBanner
                alert={forecast.spikeAlert}
                dishName={forecast.dishName}
              />
            )}

            <div className="forecast-summary-row">
              <ForecastSummary
                icon={<FaUtensils />}
                label="Dish"
                value={forecast.dishName}
                tone="red"
              />
              <ForecastSummary
                icon={<FaCalendarAlt />}
                label="Horizon"
                value={`${days} days`}
                tone="gold"
              />
              <ForecastSummary
                icon={<FaChartArea />}
                label="Total Predicted"
                value={Math.round(totalPredicted || 0)}
                tone="green"
              />
              <ForecastSummary
                icon={<FaChartArea />}
                label="Peak Day"
                value={peakDay ? new Date(peakDay.date).toLocaleDateString() : "—"}
                tone="info"
              />
            </div>

            <Card padding="p-6">
              <div className="forecast-chart-head">
                <div>
                  <span className="forecast-chart-kicker">Forecast Curve</span>
                  <h3 className="forecast-chart-title">
                    Daily predicted quantity
                  </h3>
                </div>
                <Badge tone="gold" glow>
                  AI · {days}d
                </Badge>
              </div>
              <ForecastChart data={forecast.forecast} />
            </Card>

            <Card padding="p-0" className="forecast-table-card">
              <div className="forecast-table-head">
                <h3 className="forecast-table-title">Daily Breakdown</h3>
              </div>
              <div className="forecast-table-wrap">
                <ForecastTable data={forecast.forecast} />
              </div>
            </Card>

            <StaffingSuggestionCard suggestion={forecast.staffingSuggestion} />
          </>
        )}
      </div>

      <style>{`
        .forecast-page { padding: 28px; display: flex; flex-direction: column; gap: 22px; }

        /* CONTROLS ------------------------------------------------------ */
        .forecast-controls { display: flex; flex-direction: column; gap: 14px; }
        .forecast-control-row {
          display: flex; gap: 18px; align-items: flex-end; flex-wrap: wrap;
        }
        .forecast-control { display: flex; flex-direction: column; gap: 8px; flex: 1 1 240px; min-width: 0; }
        .forecast-control-label {
          font-family: var(--font-heading);
          font-size: 11px; letter-spacing: 0.10em; text-transform: uppercase;
          color: var(--text-muted); font-weight: 600;
        }
        .forecast-control-msg { padding: 11px 14px; font-size: 13px; }
        .forecast-control-msg.muted { color: var(--text-muted); }
        .forecast-control-msg.danger { color: var(--accent-red); }

        .forecast-select {
          padding: 11px 14px;
          background: var(--bg-secondary);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          font-size: 14px;
          outline: none;
          transition: border-color 160ms var(--ease-out-expo), box-shadow 160ms var(--ease-out-expo);
        }
        .forecast-select:focus {
          border-color: var(--accent-gold);
          box-shadow: 0 0 0 3px rgba(155,226,45,0.18);
        }

        .forecast-period {
          display: inline-flex;
          padding: 4px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-color);
          border-radius: 999px;
          gap: 4px;
          width: fit-content;
        }
        .forecast-period-btn {
          padding: 8px 18px;
          background: transparent;
          color: var(--text-secondary);
          border: 0;
          border-radius: 999px;
          font-family: var(--font-heading);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.04em;
          cursor: pointer;
          transition: all 200ms var(--ease-out-expo);
        }
        .forecast-period-btn:hover { color: var(--text-primary); }
        .forecast-period-btn.is-active {
          background: linear-gradient(135deg, var(--accent-red), var(--accent-red-soft));
          color: #fff;
          box-shadow: 0 4px 12px rgba(215,38,56,0.3);
        }

        /* COLD-START NOTICE -------------------------------------------- */
        .forecast-cold {
          padding: 14px 18px;
          background: rgba(59,130,246,0.10);
          border: 1px solid rgba(59,130,246,0.32);
          border-radius: var(--radius-md);
          color: var(--status-info-fg);
          font-size: 13px;
        }

        /* SUMMARY ------------------------------------------------------- */
        .forecast-summary-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        /* CHART HEAD --------------------------------------------------- */
        .forecast-chart-head {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 14px;
        }
        .forecast-chart-kicker {
          font-family: var(--font-heading);
          font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase;
          color: var(--accent-gold);
        }
        .forecast-chart-title {
          font-family: var(--font-heading);
          font-size: 16px; font-weight: 700;
          margin: 4px 0 0 0;
          letter-spacing: -0.01em;
          color: var(--text-primary);
        }

        /* FORECAST TABLE ----------------------------------------------- */
        .forecast-table-card { padding: 0 !important; overflow: hidden; }
        .forecast-table-head {
          padding: 18px 22px;
          border-bottom: 1px solid var(--border-color);
        }
        .forecast-table-title {
          font-family: var(--font-heading);
          font-size: 15px; font-weight: 700;
          margin: 0; letter-spacing: -0.01em; color: var(--text-primary);
        }
        .forecast-table-wrap { overflow-x: auto; }
        .forecast-table { width: 100%; border-collapse: collapse; }
        .forecast-table th {
          text-align: left;
          padding: 12px 18px;
          background: var(--bg-elevated);
          color: var(--text-muted);
          font-family: var(--font-heading);
          font-size: 11px;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          font-weight: 600;
          border-bottom: 1px solid var(--border-color);
        }
        .forecast-table td {
          padding: 12px 18px;
          border-bottom: 1px solid var(--border-color);
          color: var(--text-secondary);
          font-size: 13px;
          font-family: var(--font-body);
        }
        .forecast-table tr:last-child td { border-bottom: 0; }
        .forecast-table-num { color: var(--text-primary); font-family: var(--font-heading); font-weight: 600; }

        @media (max-width: 1024px) {
          .forecast-summary-row { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 640px) {
          .forecast-summary-row { grid-template-columns: 1fr; }
          .forecast-control-row { flex-direction: column; align-items: stretch; }
        }
      `}</style>
    </DashboardLayout>
  );
}

function ForecastSummary({ icon, label, value, tone = "red" }) {
  return (
    <>
      <div className={`forecast-summary forecast-summary-${tone}`}>
        <div className="forecast-summary-icon">{icon}</div>
        <div>
          <div className="forecast-summary-label">{label}</div>
          <div className="forecast-summary-value">{value}</div>
        </div>
      </div>
      <style>{`
        .forecast-summary {
          display: flex; align-items: center; gap: 14px;
          padding: 16px 18px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-soft);
          position: relative;
          overflow: hidden;
          transition: transform 200ms var(--ease-out-expo);
        }
        .forecast-summary:hover { transform: translateY(-2px); }
        .forecast-summary::before {
          content: "";
          position: absolute; left: 0; top: 0; bottom: 0;
          width: 3px;
        }
        .forecast-summary-red::before { background: var(--accent-red); }
        .forecast-summary-gold::before { background: var(--accent-gold); }
        .forecast-summary-green::before { background: var(--accent-green); }
        .forecast-summary-info::before { background: var(--accent-blue); }
        .forecast-summary-icon {
          width: 38px; height: 38px;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px;
          flex-shrink: 0;
        }
        .forecast-summary-red .forecast-summary-icon { background: rgba(215,38,56,0.12); color: var(--accent-red); }
        .forecast-summary-gold .forecast-summary-icon { background: rgba(155,226,45,0.14); color: var(--accent-gold); }
        .forecast-summary-green .forecast-summary-icon { background: rgba(16,185,129,0.12); color: var(--accent-green); }
        .forecast-summary-info .forecast-summary-icon { background: rgba(59,130,246,0.12); color: var(--accent-blue); }
        .forecast-summary-label {
          font-family: var(--font-heading);
          font-size: 11px; letter-spacing: 0.10em; text-transform: uppercase;
          color: var(--text-muted); font-weight: 600;
        }
        .forecast-summary-value {
          font-family: var(--font-heading);
          font-size: 18px; font-weight: 700;
          color: var(--text-primary); letter-spacing: -0.01em;
          margin-top: 2px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>
    </>
  );
}

function ForecastTable({ data }) {
  return (
    <table className="forecast-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Predicted</th>
          <th>Lower Bound</th>
          <th>Upper Bound</th>
        </tr>
      </thead>
      <tbody>
        {data.map((r) => (
          <tr key={r.date}>
            <td>{r.date}</td>
            <td className="forecast-table-num">{Math.round(r.predictedQuantity)}</td>
            <td>{Math.round(r.lowerBound)}</td>
            <td>{Math.round(r.upperBound)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
