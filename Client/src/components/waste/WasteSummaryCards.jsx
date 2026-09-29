import { FaTrash, FaCoins, FaArrowUp, FaArrowDown } from "react-icons/fa";

export default function WasteSummaryCards({ summary }) {
  const change = summary.reductionPctVsLastMonth ?? 0;
  const isImprovement = change <= 0;

  return (
    <>
      <div className="waste-summary-grid">
        <WasteCard
          icon={<FaTrash />}
          tone="red"
          kicker="This Month"
          label="Total waste"
          value={`${(summary.monthTotalQuantity ?? 0).toFixed(1)}`}
          unit="units"
        />
        <WasteCard
          icon={<FaCoins />}
          tone="gold"
          kicker="Lost Revenue"
          label="Waste value"
          value={`$${(summary.monthTotalValue ?? 0).toFixed(2)}`}
        />
        <WasteCard
          icon={isImprovement ? <FaArrowDown /> : <FaArrowUp />}
          tone={isImprovement ? "green" : "warn"}
          kicker="vs Last month"
          label={isImprovement ? "Reduction" : "Increase"}
          value={`${change >= 0 ? "+" : ""}${change.toFixed(1)}%`}
        />
      </div>
      <style>{`
        .waste-summary-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        @media (max-width: 900px) {
          .waste-summary-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </>
  );
}

function WasteCard({ icon, kicker, label, value, unit, tone = "red" }) {
  return (
    <>
      <div className={`waste-card waste-card-${tone}`}>
        <div className="waste-card-bg" aria-hidden />
        <div className="waste-card-icon">{icon}</div>
        <div className="waste-card-text">
          <span className="waste-card-kicker">{kicker}</span>
          {/* Render value+unit as a single leaf text node so callers querying
              by the combined string ("12.5 units") get a single match. */}
          <span className="waste-card-value">
            {unit ? `${value} ${unit}` : value}
          </span>
          <span className="waste-card-label">{label}</span>
        </div>
      </div>
      <style>{`
        .waste-card {
          position: relative;
          padding: 22px;
          color: #fff;
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-color);
          overflow: hidden;
          isolation: isolate;
          display: flex; align-items: flex-start; gap: 14px;
          min-height: 130px;
          box-shadow: var(--shadow-soft);
          transition: transform 240ms var(--ease-out-expo), box-shadow 240ms var(--ease-out-expo);
        }
        .waste-card:hover {
          transform: translateY(-3px);
          box-shadow: var(--shadow-elev);
        }
        .waste-card-bg { position: absolute; inset: 0; z-index: -1; }
        .waste-card-red .waste-card-bg {
          background:
            radial-gradient(400px 200px at 100% 0%, rgba(255,255,255,0.18), transparent 60%),
            linear-gradient(135deg, #7C2D12 0%, var(--accent-red) 100%);
        }
        .waste-card-gold .waste-card-bg {
          background:
            radial-gradient(400px 200px at 100% 0%, rgba(255,255,255,0.18), transparent 60%),
            linear-gradient(135deg, #8E6F1A 0%, var(--accent-gold) 100%);
        }
        .waste-card-green .waste-card-bg {
          background:
            radial-gradient(400px 200px at 100% 0%, rgba(255,255,255,0.18), transparent 60%),
            linear-gradient(135deg, #047857 0%, var(--accent-green) 100%);
        }
        .waste-card-warn .waste-card-bg {
          background:
            radial-gradient(400px 200px at 100% 0%, rgba(255,255,255,0.18), transparent 60%),
            linear-gradient(135deg, #92400E 0%, #F59E0B 100%);
        }
        .waste-card-icon {
          width: 48px; height: 48px;
          border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.18);
          backdrop-filter: blur(6px);
          font-size: 18px;
          flex-shrink: 0;
        }
        .waste-card-text { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .waste-card-kicker {
          font-family: var(--font-heading);
          font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase;
          color: rgba(255,255,255,0.7);
        }
        .waste-card-value {
          font-family: var(--font-heading);
          font-size: 26px;
          font-weight: 700;
          letter-spacing: -0.02em;
          line-height: 1.1;
        }
        .waste-card-unit { font-size: 14px; opacity: 0.8; font-weight: 500; }
        .waste-card-label {
          font-size: 12px;
          color: rgba(255,255,255,0.78);
          letter-spacing: 0.04em;
        }
      `}</style>
    </>
  );
}
