import { FaClock, FaUtensils, FaExclamationTriangle } from "react-icons/fa";
import Button from "../shared/Button";

function severity(days) {
  if (days <= 1) return { tone: "danger", label: "Critical", color: "var(--accent-red)" };
  if (days <= 3) return { tone: "warning", label: "Urgent", color: "#F59E0B" };
  return { tone: "info", label: "Soon", color: "var(--accent-blue)" };
}

export default function NearExpiryTable({ items, onUseInRecipe }) {
  if (!items || items.length === 0) return null;

  return (
    <>
      <ul className="near-expiry-list">
        {items.map((item) => {
          const sev = severity(item.daysUntilExpiry ?? 99);
          return (
            <li
              key={item._id}
              className="near-expiry-row"
              style={{ "--sev-color": sev.color }}
            >
              <div className="near-expiry-icon">
                <FaExclamationTriangle />
              </div>
              <div className="near-expiry-main">
                <div className="near-expiry-name">{item.name}</div>
                <div className="near-expiry-meta">
                  <span>
                    {item.quantity} {item.unit}
                  </span>
                  <span className="near-expiry-dot">·</span>
                  <span>
                    <FaClock size={9} />{" "}
                    {item.expiryDate
                      ? new Date(item.expiryDate).toLocaleDateString()
                      : "—"}
                  </span>
                </div>
              </div>
              <div className="near-expiry-badge">
                <span className="near-expiry-days">
                  {item.daysUntilExpiry ?? "—"}
                </span>
                <span className="near-expiry-days-unit">
                  {item.daysUntilExpiry === 1 ? "day" : "days"}
                </span>
              </div>
              <Button
                size="sm"
                variant="primary"
                iconLeft={<FaUtensils />}
                onClick={() => onUseInRecipe(item)}
              >
                Use in Recipe
              </Button>
            </li>
          );
        })}
      </ul>
      <style>{`
        .near-expiry-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
        .near-expiry-row {
          display: grid;
          grid-template-columns: auto 1fr auto auto;
          align-items: center;
          gap: 14px;
          padding: 14px 16px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-color);
          border-left: 3px solid var(--sev-color);
          border-radius: 12px;
          transition: transform 200ms var(--ease-out-expo), border-color 200ms var(--ease-out-expo);
        }
        .near-expiry-row:hover {
          transform: translateX(2px);
          border-color: var(--sev-color);
        }
        .near-expiry-icon {
          width: 38px; height: 38px;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          background: color-mix(in srgb, var(--sev-color) 14%, transparent);
          color: var(--sev-color);
          font-size: 14px;
          flex-shrink: 0;
        }
        .near-expiry-main { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
        .near-expiry-name {
          font-family: var(--font-heading);
          font-weight: 600;
          color: var(--text-primary);
          font-size: 14px;
        }
        .near-expiry-meta {
          display: flex; align-items: center; gap: 6px;
          font-size: 12px;
          color: var(--text-muted);
        }
        .near-expiry-meta span { display: inline-flex; align-items: center; gap: 4px; }
        .near-expiry-dot { color: var(--text-muted); }
        .near-expiry-badge {
          display: flex; flex-direction: column; align-items: center;
          padding: 6px 12px;
          background: color-mix(in srgb, var(--sev-color) 14%, transparent);
          color: var(--sev-color);
          border: 1px solid color-mix(in srgb, var(--sev-color) 32%, transparent);
          border-radius: 10px;
          line-height: 1;
        }
        .near-expiry-days {
          font-family: var(--font-heading);
          font-size: 18px; font-weight: 700;
          letter-spacing: -0.02em;
        }
        .near-expiry-days-unit {
          font-size: 9px; letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-top: 2px;
        }
        @media (max-width: 640px) {
          .near-expiry-row { grid-template-columns: auto 1fr; row-gap: 8px; }
          .near-expiry-badge, .near-expiry-row > :global(button) { grid-column: 1 / -1; }
        }
      `}</style>
    </>
  );
}
