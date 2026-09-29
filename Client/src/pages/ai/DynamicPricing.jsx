import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import api from "../../api/axios";
import { aiCall } from "../../api/aiCall";
import LoadingState from "../../components/shared/LoadingState";
import ErrorState from "../../components/shared/ErrorState";
import EmptyState from "../../components/shared/EmptyState";
import FilterPills from "../../components/shared/FilterPills";
import ConfirmationModal from "../../components/shared/ConfirmationModal";
import PricingCard from "../../components/ai/PricingCard";
import PageHeader from "../../components/shared/PageHeader";
import Button from "../../components/shared/Button";
import Card from "../../components/shared/Card";
import Badge from "../../components/shared/Badge";
import Skeleton from "../../components/shared/Skeleton";
import {
  FaChartLine,
  FaArrowUp,
  FaArrowDown,
  FaEquals,
  FaBolt,
} from "react-icons/fa";

export default function DynamicPricing() {
  const [pageState, setPageState] = useState("loading");
  const [recs, setRecs] = useState([]);
  const [filter, setFilter] = useState("all");
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [singleConfirm, setSingleConfirm] = useState(null);
  const [toast, setToast] = useState(null);
  const [results, setResults] = useState(null);

  async function load() {
    setPageState("loading");
    const res = await aiCall("post", "/v1/ai/pricing/suggest", {});
    if (!res.ok) {
      setPageState(res.kind === "ai_unavailable" ? "ai-unavailable" : "error");
      return;
    }
    let data = res.data ?? [];
    if (Array.isArray(data)) {
      data = data.filter((r) => !r.skippedReason);
    }
    setRecs(data);
    setPageState(data.length === 0 ? "empty" : "ready");
  }
  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(() => {
    return {
      all: recs.length,
      increase: recs.filter((r) => r.direction === "up").length,
      decrease: recs.filter((r) => r.direction === "down").length,
      none: recs.filter((r) => r.direction === "none").length,
    };
  }, [recs]);

  const FILTERS = [
    { value: "all", label: "All", count: counts.all },
    { value: "increase", label: "↑ Increase", count: counts.increase },
    { value: "decrease", label: "↓ Decrease", count: counts.decrease },
    { value: "none", label: "Stable", count: counts.none },
  ];

  const visibleRecs = useMemo(() => {
    if (filter === "all") return recs;
    return recs.filter((r) => {
      if (filter === "increase") return r.direction === "up";
      if (filter === "decrease") return r.direction === "down";
      if (filter === "none") return r.direction === "none";
      return true;
    });
  }, [recs, filter]);

  const projectedImpact = useMemo(
    () =>
      visibleRecs.reduce(
        (sum, r) =>
          sum +
          ((r.suggestedPrice ?? 0) - (r.currentPrice ?? 0)) *
            ((r.demandScore ?? 0) * 100 || 0),
        0
      ),
    [visibleRecs]
  );

  async function applyMany(ids) {
    const __versions = Object.fromEntries(
      recs.filter((r) => ids.includes(r.dishId)).map((r) => [r.dishId, r.__version ?? r.version ?? 0])
    );
    try {
      setPageState("applying");
      const res = await api.post("/v1/ai/pricing/apply", {
        dishIds: ids,
        __versions,
      });
      const data = res.data.data ?? res.data;
      setResults({
        applied: data.applied ?? [],
        conflicts: data.conflicts ?? [],
        failed: data.failed ?? [],
      });
      await load();
    } catch (err) {
      setToast({
        kind: "error",
        text: err.response?.data?.message || "Apply failed.",
      });
      setPageState("ready");
    }
  }

  return (
    <DashboardLayout>
      <div className="pricing-page">
        <PageHeader
          kicker="AI Engine"
          title="Dynamic Pricing"
          subtitle="AI-driven price recommendations based on demand, history, and market signals."
          actions={
            <Button
              disabled={pageState !== "ready" || visibleRecs.length === 0}
              onClick={() => setBulkConfirmOpen(true)}
              iconLeft={<FaBolt />}
            >
              Apply all
            </Button>
          }
        />

        {pageState === "loading" && (
          <div className="pricing-skeleton">
            <Skeleton.Card />
            <Skeleton.Card />
            <Skeleton.Card />
          </div>
        )}

        {pageState === "ai-unavailable" && (
          <ErrorState
            title="AI pricing service unavailable"
            message="Try again later."
            onRetry={load}
          />
        )}
        {pageState === "error" && (
          <ErrorState
            message="Failed to load recommendations."
            onRetry={load}
          />
        )}
        {pageState === "empty" && (
          <EmptyState
            title="No recommendations"
            message="No pricing changes recommended right now."
          />
        )}

        {(pageState === "ready" || pageState === "applying") && (
          <>
            <div className="pricing-summary-row">
              <PricingSummary
                icon={<FaChartLine />}
                label="Total Recs"
                value={counts.all}
                tone="gold"
              />
              <PricingSummary
                icon={<FaArrowUp />}
                label="Increases"
                value={counts.increase}
                tone="green"
              />
              <PricingSummary
                icon={<FaArrowDown />}
                label="Decreases"
                value={counts.decrease}
                tone="red"
              />
              <PricingSummary
                icon={<FaEquals />}
                label="Stable"
                value={counts.none}
                tone="neutral"
              />
            </div>

            <div className="pricing-projection">
              <div>
                <span className="pricing-projection-kicker">Projected Daily Impact</span>
                <h3 className="pricing-projection-value">
                  {projectedImpact >= 0 ? "+" : ""}${projectedImpact.toFixed(2)}
                </h3>
              </div>
              <span className="pricing-projection-meta">
                Estimate based on demand score × price delta · {visibleRecs.length} dishes
              </span>
            </div>

            <FilterPills
              options={FILTERS}
              value={filter}
              onChange={(v) => setFilter(v ?? "all")}
            />

            <div className="pricing-grid">
              {visibleRecs.map((rec) => (
                <PricingCard
                  key={rec.dishId}
                  rec={rec}
                  onApply={() => setSingleConfirm(rec)}
                  onRevert={async () => {
                    try {
                      await api.post("/v1/ai/pricing/revert", {
                        dishId: rec.dishId,
                        __version: rec.__version ?? rec.version ?? 0,
                      });
                      await load();
                    } catch {
                      setToast({ kind: "error", text: "Revert failed." });
                    }
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <ConfirmationModal
        isOpen={!!singleConfirm}
        title="Apply this pricing change?"
        body={
          singleConfirm && (
            <div>
              <p>
                Change <strong>{singleConfirm.dishName}</strong> from $
                {(singleConfirm.currentPrice ?? 0).toFixed(2)} to $
                {(singleConfirm.suggestedPrice ?? 0).toFixed(2)}.
              </p>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>
                Confidence: {Math.round((singleConfirm.confidence ?? 0) * 100)}%.
              </p>
            </div>
          )
        }
        onConfirm={() => {
          applyMany([singleConfirm.dishId]);
          setSingleConfirm(null);
        }}
        onCancel={() => setSingleConfirm(null)}
      />

      <ConfirmationModal
        isOpen={bulkConfirmOpen}
        title="Apply all visible recommendations?"
        body={
          <div>
            <p>
              Apply {visibleRecs.length}{" "}
              {filter === "all"
                ? "recommendations"
                : `suggested ${
                    filter === "increase"
                      ? "increases"
                      : filter === "decrease"
                      ? "decreases"
                      : "no-change"
                  }`}{" "}
              to currently displayed dishes?
            </p>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>
              Projected revenue impact: ${projectedImpact.toFixed(2)}/day (estimate).
            </p>
          </div>
        }
        onConfirm={() => {
          applyMany(visibleRecs.map((r) => r.dishId));
          setBulkConfirmOpen(false);
        }}
        onCancel={() => setBulkConfirmOpen(false)}
      />

      {toast && <PricingToast {...toast} onClose={() => setToast(null)} />}
      <ResultsModal
        results={results}
        onClose={() => setResults(null)}
        recs={recs}
      />

      <style>{`
        .pricing-page { padding: 28px; display: flex; flex-direction: column; gap: 22px; }
        .pricing-skeleton {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
        }

        .pricing-summary-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        .pricing-projection {
          padding: 22px;
          background: linear-gradient(135deg, rgba(31,122,63,0.08), rgba(155,226,45,0.08));
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
          position: relative;
          overflow: hidden;
        }
        .pricing-projection::before {
          content: "";
          position: absolute; right: -40px; top: -40px;
          width: 180px; height: 180px;
          background: radial-gradient(circle, rgba(155,226,45,0.18), transparent 70%);
        }
        .pricing-projection-kicker {
          font-family: var(--font-heading);
          font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase;
          color: var(--accent-gold); font-weight: 600;
        }
        .pricing-projection-value {
          font-family: var(--font-heading);
          font-size: clamp(22px, 3vw, 32px);
          font-weight: 700;
          margin: 4px 0 0 0;
          letter-spacing: -0.02em;
          color: var(--text-primary);
        }
        .pricing-projection-meta {
          font-size: 12px;
          color: var(--text-muted);
          font-style: italic;
        }

        .pricing-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 16px;
        }

        @media (max-width: 1024px) {
          .pricing-summary-row { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 640px) {
          .pricing-summary-row { grid-template-columns: 1fr; }
        }
      `}</style>
    </DashboardLayout>
  );
}

function PricingSummary({ icon, label, value, tone = "gold" }) {
  return (
    <>
      <div className={`pricing-summary pricing-summary-${tone}`}>
        <div className="pricing-summary-icon">{icon}</div>
        <div>
          <div className="pricing-summary-label">{label}</div>
          <div className="pricing-summary-value">{value}</div>
        </div>
      </div>
      <style>{`
        .pricing-summary {
          display: flex; align-items: center; gap: 14px;
          padding: 16px 18px;
          border-radius: var(--radius-lg);
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          box-shadow: var(--shadow-soft);
          position: relative;
          overflow: hidden;
          transition: transform 200ms var(--ease-out-expo);
        }
        .pricing-summary::before {
          content: "";
          position: absolute; left: 0; top: 0; bottom: 0;
          width: 3px;
        }
        .pricing-summary-gold::before { background: var(--accent-gold); }
        .pricing-summary-green::before { background: var(--accent-green); }
        .pricing-summary-red::before { background: var(--accent-red); }
        .pricing-summary-neutral::before { background: var(--text-muted); }
        .pricing-summary:hover { transform: translateY(-2px); }
        .pricing-summary-icon {
          width: 38px; height: 38px;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px;
          flex-shrink: 0;
        }
        .pricing-summary-gold .pricing-summary-icon { background: rgba(155,226,45,0.14); color: var(--accent-gold); }
        .pricing-summary-green .pricing-summary-icon { background: rgba(16,185,129,0.14); color: var(--accent-green); }
        .pricing-summary-red .pricing-summary-icon { background: rgba(215,38,56,0.14); color: var(--accent-red); }
        .pricing-summary-neutral .pricing-summary-icon { background: var(--bg-elevated); color: var(--text-muted); }
        .pricing-summary-label {
          font-family: var(--font-heading);
          font-size: 11px; letter-spacing: 0.10em; text-transform: uppercase;
          color: var(--text-muted); font-weight: 600;
        }
        .pricing-summary-value {
          font-family: var(--font-heading);
          font-size: 22px; font-weight: 700;
          color: var(--text-primary); letter-spacing: -0.01em;
          margin-top: 2px;
        }
      `}</style>
    </>
  );
}

function ResultsModal({ results, onClose, recs }) {
  if (!results) return null;
  const nameOf = (id) => recs.find((r) => r.dishId === id)?.dishName ?? id;
  return (
    <>
      <div className="results-overlay" onClick={onClose}>
        <div className="results-modal" onClick={(e) => e.stopPropagation()}>
          <h3 className="results-title">Apply Results</h3>
          {results.applied.length > 0 && (
            <div className="results-section">
              <h4 className="results-h4 success">Applied ({results.applied.length})</h4>
              <ul>
                {results.applied.map((a) => (
                  <li key={a.dishId}>
                    {nameOf(a.dishId)}: ${a.oldPrice?.toFixed(2)} → ${a.newPrice?.toFixed(2)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {results.conflicts.length > 0 && (
            <div className="results-section">
              <h4 className="results-h4 warn">Conflicts ({results.conflicts.length})</h4>
              <ul>
                {results.conflicts.map((c) => (
                  <li key={c.dishId}>
                    {nameOf(c.dishId)}: {c.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {results.failed.length > 0 && (
            <div className="results-section">
              <h4 className="results-h4 danger">Failed ({results.failed.length})</h4>
              <ul>
                {results.failed.map((f) => (
                  <li key={f.dishId}>
                    {nameOf(f.dishId)}: {f.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {results.applied.length === 0 &&
            results.conflicts.length === 0 &&
            results.failed.length === 0 && (
              <p className="results-empty">No changes were made.</p>
            )}
          <div className="results-footer">
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>
      <style>{`
        .results-overlay {
          position: fixed; inset: 0; z-index: 100;
          background: rgba(7,7,9,0.65);
          backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center; padding: 20px;
        }
        .results-modal {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-elev);
          padding: 24px; width: 540px; max-width: 100%;
          max-height: 80vh; overflow-y: auto;
        }
        .results-title {
          font-family: var(--font-heading);
          font-size: 20px; font-weight: 700; margin: 0 0 16px 0;
          letter-spacing: -0.01em; color: var(--text-primary);
        }
        .results-section { margin-bottom: 14px; }
        .results-h4 {
          font-family: var(--font-heading);
          font-size: 13px; letter-spacing: 0.06em;
          margin: 0 0 6px 0;
        }
        .results-h4.success { color: var(--accent-green); }
        .results-h4.warn { color: #F59E0B; }
        .results-h4.danger { color: var(--accent-red); }
        .results-section ul { margin: 0; padding-left: 20px; font-size: 13px; color: var(--text-secondary); }
        .results-section li { padding: 3px 0; }
        .results-empty { font-size: 13px; color: var(--text-muted); }
        .results-footer { display: flex; justify-content: flex-end; margin-top: 16px; }
      `}</style>
    </>
  );
}

function PricingToast({ kind, text, onClose }) {
  return (
    <>
      <div className={`pricing-toast pricing-toast-${kind}`} onClick={onClose} role="alert">
        {text}
      </div>
      <style>{`
        .pricing-toast {
          position: fixed; bottom: 22px; right: 22px;
          padding: 12px 18px;
          border-radius: 12px;
          color: #fff; font-size: 14px;
          cursor: pointer; box-shadow: var(--shadow-elev);
          z-index: 9999;
          animation: pricingToastIn 220ms var(--ease-out-expo) both;
        }
        .pricing-toast-success { background: var(--accent-green); }
        .pricing-toast-error { background: var(--accent-red); }
        @keyframes pricingToastIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
