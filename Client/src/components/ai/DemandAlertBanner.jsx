import { FaBolt } from "react-icons/fa";

export default function DemandAlertBanner({ alert, dishName }) {
  if (!alert || !alert.triggered) return null;

  return (
    <>
      <div className="demand-alert">
        <div className="demand-alert-icon">
          <FaBolt />
        </div>
        <div className="demand-alert-text">
          <span className="demand-alert-kicker">Demand Spike Detected</span>
          <p>
            <strong>{dishName}</strong> forecast peaks at{" "}
            <strong className="demand-alert-num">
              {Math.round(alert.peakQuantity)}
            </strong>{" "}
            on <strong>{alert.peakDay}</strong>{" "}
            <span className="demand-alert-pct">
              ({Math.round(alert.ratio * 100)}% of trailing 30-day average)
            </span>
          </p>
        </div>
      </div>
      <style>{`
        .demand-alert {
          display: flex; align-items: center; gap: 14px;
          padding: 16px 20px;
          background: linear-gradient(135deg, rgba(245,158,11,0.14), rgba(215,38,56,0.10));
          border: 1px solid rgba(245,158,11,0.34);
          border-radius: var(--radius-lg);
          position: relative;
          overflow: hidden;
        }
        .demand-alert::before {
          content: "";
          position: absolute; left: 0; top: 0; bottom: 0;
          width: 4px;
          background: linear-gradient(180deg, #F59E0B, var(--accent-red));
        }
        .demand-alert-icon {
          width: 44px; height: 44px;
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(245,158,11,0.18);
          color: #F59E0B;
          font-size: 18px;
          flex-shrink: 0;
          animation: alertPulse 1.6s ease-in-out infinite;
        }
        @keyframes alertPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.5); }
          50% { box-shadow: 0 0 0 10px rgba(245,158,11,0); }
        }
        .demand-alert-kicker {
          display: block;
          font-family: var(--font-heading);
          font-size: 11px; letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #F59E0B;
          font-weight: 600;
          margin-bottom: 4px;
        }
        .demand-alert-text p {
          margin: 0;
          color: var(--text-primary);
          font-size: 14px;
          line-height: 1.5;
        }
        .demand-alert-num {
          color: var(--accent-red);
          font-family: var(--font-heading);
        }
        .demand-alert-pct {
          color: var(--text-muted);
          font-size: 12px;
        }
      `}</style>
    </>
  );
}
