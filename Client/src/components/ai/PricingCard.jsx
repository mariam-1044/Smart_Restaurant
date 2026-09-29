import { FaArrowUp, FaArrowDown, FaEquals } from "react-icons/fa";
import Button from "../shared/Button";

export default function PricingCard({ rec, onApply, onRevert }) {
  const direction = rec.direction || "none";
  const isUp = direction === "up";
  const isDown = direction === "down";
  const isNone = direction === "none";

  const delta = (rec.suggestedPrice ?? 0) - (rec.currentPrice ?? 0);
  const deltaPct = rec.currentPrice ? (delta / rec.currentPrice) * 100 : 0;

  const directionClass = isUp ? "up" : isDown ? "down" : "flat";
  const directionIcon = isUp ? <FaArrowUp /> : isDown ? <FaArrowDown /> : <FaEquals />;

  const confidence = Math.round((rec.confidence ?? 0) * 100);
  const confidenceTone =
    confidence >= 70 ? "high" : confidence >= 50 ? "med" : "low";

  const lossMaking = rec.lossMaking === true;
  const profitDelta = rec.projectedDailyProfitDelta;
  const insight = lossMaking
    ? { tone: "loss", text: "Sold below cost — raising price stops the loss." }
    : isUp
    ? { tone: "profit", text: "Higher price captures more profit per order." }
    : isDown
    ? { tone: "demand", text: "Lower price lifts demand on a soft seller." }
    : null;

  return (
    <>
      <article className={`pricing-card pricing-card-${directionClass}`}>
        <header className="pricing-card-head">
          <div className="pricing-card-meta">
            <span className="pricing-card-kicker">{rec.category || "Dish"}</span>
            <h4 className="pricing-card-title">{rec.dishName}</h4>
          </div>
          <div className={`pricing-card-direction ${directionClass}`} title={direction}>
            {directionIcon}
          </div>
        </header>

        <div className="pricing-card-prices">
          <div className="pricing-card-price">
            <span className="pricing-card-price-label">Current</span>
            <span className="pricing-card-price-value current">
              ${(rec.currentPrice ?? 0).toFixed(2)}
            </span>
          </div>
          <div className="pricing-card-arrow" aria-hidden>
            →
          </div>
          <div className="pricing-card-price">
            <span className="pricing-card-price-label">Suggested</span>
            <span className={`pricing-card-price-value suggested ${directionClass}`}>
              ${(rec.suggestedPrice ?? 0).toFixed(2)}
            </span>
            {!isNone && (
              <span className={`pricing-card-delta ${directionClass}`}>
                {isUp ? "+" : ""}
                {deltaPct.toFixed(1)}%
              </span>
            )}
          </div>
        </div>

        {insight && (
          <div className={`pricing-card-insight ${insight.tone}`}>
            <span className="pricing-card-insight-text">{insight.text}</span>
            {typeof profitDelta === "number" && Math.abs(profitDelta) >= 0.5 && (
              <span className="pricing-card-insight-impact">
                {profitDelta >= 0 ? "+" : ""}EGP {profitDelta.toFixed(2)}/day
              </span>
            )}
          </div>
        )}

        <div className="pricing-card-metrics">
          <div className="pricing-metric">
            <div className="pricing-metric-head">
              <span>Demand</span>
              <span>{Math.round((rec.demandScore ?? 0) * 100)}%</span>
            </div>
            <div className="pricing-metric-bar">
              <div
                className="pricing-metric-fill demand"
                style={{ width: `${(rec.demandScore ?? 0) * 100}%` }}
              />
            </div>
          </div>
          <div className="pricing-metric">
            <div className="pricing-metric-head">
              <span>Confidence</span>
              <span className={`pricing-conf-${confidenceTone}`}>{confidence}%</span>
            </div>
            <div className="pricing-metric-bar">
              <div
                className={`pricing-metric-fill conf-${confidenceTone}`}
                style={{ width: `${confidence}%` }}
              />
            </div>
          </div>
        </div>

        {(rec.recentHistory ?? []).length > 0 && (
          <div className="pricing-history">
            <span className="pricing-history-label">Recent</span>
            <span className="pricing-history-trail">
              {rec.recentHistory.slice(0, 3).map((h, i) => (
                <span key={i}>
                  ${typeof h.price?.toFixed === "function" ? h.price.toFixed(2) : h.price}
                  {i < Math.min(rec.recentHistory.length, 3) - 1 && (
                    <span className="pricing-history-arrow"> → </span>
                  )}
                </span>
              ))}
            </span>
          </div>
        )}

        <footer className="pricing-card-footer">
          {direction !== "none" && (
            <Button size="sm" onClick={onApply}>
              Apply
            </Button>
          )}
          {(rec.recentHistory ?? []).length > 0 && (
            <Button size="sm" variant="ghost" onClick={onRevert}>
              Revert
            </Button>
          )}
          {isNone && (
            <span className="pricing-card-stable">No change suggested</span>
          )}
        </footer>
      </article>

      <style>{`
        .pricing-card {
          position: relative;
          padding: 22px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-soft);
          display: flex; flex-direction: column; gap: 16px;
          overflow: hidden;
          transition: transform 240ms var(--ease-out-expo), box-shadow 240ms var(--ease-out-expo), border-color 240ms var(--ease-out-expo);
        }
        .pricing-card::before {
          content: "";
          position: absolute; left: 0; top: 0; bottom: 0;
          width: 4px;
          border-radius: var(--radius-lg) 0 0 var(--radius-lg);
        }
        .pricing-card-up::before { background: linear-gradient(180deg, var(--accent-green), #34D399); }
        .pricing-card-down::before { background: linear-gradient(180deg, var(--accent-red), var(--accent-red-soft)); }
        .pricing-card-flat::before { background: var(--text-muted); }
        .pricing-card:hover {
          transform: translateY(-3px);
          border-color: var(--accent-gold);
          box-shadow: var(--shadow-elev);
        }

        .pricing-card-head {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 12px;
        }
        .pricing-card-kicker {
          font-family: var(--font-heading);
          font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase;
          color: var(--accent-gold);
        }
        .pricing-card-title {
          font-family: var(--font-heading);
          font-size: 17px; font-weight: 700;
          margin: 4px 0 0 0;
          color: var(--text-primary);
          letter-spacing: -0.01em;
        }
        .pricing-card-direction {
          width: 36px; height: 36px;
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px;
          flex-shrink: 0;
        }
        .pricing-card-direction.up { background: rgba(16,185,129,0.14); color: var(--accent-green); }
        .pricing-card-direction.down { background: rgba(215,38,56,0.14); color: var(--accent-red); }
        .pricing-card-direction.flat { background: var(--bg-elevated); color: var(--text-muted); }

        .pricing-card-prices {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 12px;
          padding: 14px;
          background: var(--bg-elevated);
          border-radius: 12px;
        }
        .pricing-card-price {
          display: flex; flex-direction: column; gap: 4px; min-width: 0;
        }
        .pricing-card-price-label {
          font-family: var(--font-heading);
          font-size: 10px; letter-spacing: 0.10em; text-transform: uppercase;
          color: var(--text-muted); font-weight: 600;
        }
        .pricing-card-price-value {
          font-family: var(--font-heading);
          font-size: 22px; font-weight: 700; letter-spacing: -0.02em;
        }
        .pricing-card-price-value.current { color: var(--text-primary); }
        .pricing-card-price-value.suggested.up { color: var(--accent-green); }
        .pricing-card-price-value.suggested.down { color: var(--accent-red); }
        .pricing-card-price-value.suggested.flat { color: var(--text-secondary); }
        .pricing-card-arrow { color: var(--text-muted); font-size: 18px; }

        .pricing-card-delta {
          font-family: var(--font-heading);
          font-size: 11px;
          padding: 2px 8px; border-radius: 999px;
          width: fit-content;
          margin-top: 2px;
        }
        .pricing-card-delta.up { background: rgba(16,185,129,0.16); color: var(--accent-green); }
        .pricing-card-delta.down { background: rgba(215,38,56,0.16); color: var(--accent-red); }

        .pricing-card-insight {
          display: flex; align-items: center; justify-content: space-between;
          gap: 10px;
          padding: 9px 12px;
          border-radius: 10px;
          font-size: 12px;
          line-height: 1.3;
          border: 1px solid transparent;
        }
        .pricing-card-insight-text { color: var(--text-secondary); }
        .pricing-card-insight-impact {
          font-family: var(--font-heading);
          font-weight: 700; white-space: nowrap;
        }
        .pricing-card-insight.loss {
          background: rgba(215,38,56,0.10); border-color: rgba(215,38,56,0.30);
        }
        .pricing-card-insight.loss .pricing-card-insight-text,
        .pricing-card-insight.loss .pricing-card-insight-impact { color: var(--accent-red); }
        .pricing-card-insight.profit {
          background: rgba(16,185,129,0.10); border-color: rgba(16,185,129,0.28);
        }
        .pricing-card-insight.profit .pricing-card-insight-impact { color: var(--accent-green); }
        .pricing-card-insight.demand {
          background: var(--bg-elevated);
        }
        .pricing-card-insight.demand .pricing-card-insight-impact { color: var(--text-secondary); }

        .pricing-card-metrics { display: flex; flex-direction: column; gap: 10px; }
        .pricing-metric { display: flex; flex-direction: column; gap: 5px; }
        .pricing-metric-head {
          display: flex; justify-content: space-between;
          font-family: var(--font-heading);
          font-size: 11px; letter-spacing: 0.04em; font-weight: 600;
          color: var(--text-muted);
        }
        .pricing-metric-bar {
          height: 5px; background: var(--bg-elevated);
          border-radius: 999px; overflow: hidden;
        }
        .pricing-metric-fill { height: 100%; border-radius: 999px; transition: width 0.6s var(--ease-out-expo); }
        .pricing-metric-fill.demand { background: linear-gradient(90deg, var(--accent-blue), #60A5FA); }
        .pricing-metric-fill.conf-high { background: linear-gradient(90deg, var(--accent-green), #34D399); }
        .pricing-metric-fill.conf-med { background: linear-gradient(90deg, #F59E0B, #FCD34D); }
        .pricing-metric-fill.conf-low { background: linear-gradient(90deg, var(--accent-red), var(--accent-red-soft)); }
        .pricing-conf-high { color: var(--accent-green); }
        .pricing-conf-med { color: #F59E0B; }
        .pricing-conf-low { color: var(--accent-red); }

        .pricing-history {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 12px;
          background: var(--bg-elevated);
          border-radius: 10px;
          font-size: 12px;
        }
        .pricing-history-label {
          font-family: var(--font-heading);
          font-size: 10px; letter-spacing: 0.10em; text-transform: uppercase;
          color: var(--text-muted); font-weight: 600;
        }
        .pricing-history-trail {
          color: var(--text-secondary);
          font-family: var(--font-heading);
          font-size: 12px;
        }
        .pricing-history-arrow { color: var(--text-muted); }

        .pricing-card-footer {
          display: flex; gap: 8px; align-items: center;
          padding-top: 4px;
        }
        .pricing-card-stable {
          color: var(--text-muted);
          font-size: 12px;
          font-style: italic;
        }
      `}</style>
    </>
  );
}
