import { FaUserPlus, FaCalendarDay, FaUtensils } from "react-icons/fa";

export default function StaffingSuggestionCard({ suggestion }) {
  if (!suggestion || suggestion.suggestedAddedStaff === 0) return null;

  return (
    <>
      <div className="staffing-card">
        <div className="staffing-head">
          <div className="staffing-icon">
            <FaUserPlus />
          </div>
          <div>
            <span className="staffing-kicker">Staffing Suggestion</span>
            <h4 className="staffing-title">Plan ahead for peak day</h4>
          </div>
        </div>
        <div className="staffing-grid">
          <div className="staffing-stat">
            <FaCalendarDay className="staffing-stat-icon" />
            <div>
              <span className="staffing-stat-label">Busiest day</span>
              <span className="staffing-stat-value">{suggestion.busiestDay}</span>
            </div>
          </div>
          <div className="staffing-stat">
            <FaUtensils className="staffing-stat-icon" />
            <div>
              <span className="staffing-stat-label">Forecasted orders</span>
              <span className="staffing-stat-value">{suggestion.forecastedOrders}</span>
            </div>
          </div>
          <div className="staffing-stat highlight">
            <FaUserPlus className="staffing-stat-icon" />
            <div>
              <span className="staffing-stat-label">Add staff</span>
              <span className="staffing-stat-value gold">
                +{suggestion.suggestedAddedStaff}
              </span>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        .staffing-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 22px;
          box-shadow: var(--shadow-soft);
        }
        .staffing-head {
          display: flex; align-items: center; gap: 14px;
          margin-bottom: 18px;
        }
        .staffing-icon {
          width: 44px; height: 44px;
          background: rgba(155,226,45,0.14);
          color: var(--accent-gold);
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px;
          flex-shrink: 0;
        }
        .staffing-kicker {
          display: block;
          font-family: var(--font-heading);
          font-size: 11px; letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--accent-gold); font-weight: 600;
        }
        .staffing-title {
          font-family: var(--font-heading);
          font-size: 18px; font-weight: 700;
          margin: 4px 0 0 0; letter-spacing: -0.01em;
          color: var(--text-primary);
        }
        .staffing-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }
        .staffing-stat {
          display: flex; align-items: center; gap: 12px;
          padding: 14px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-color);
          border-radius: 12px;
        }
        .staffing-stat.highlight {
          background: linear-gradient(135deg, rgba(155,226,45,0.10), rgba(31,122,63,0.06));
          border-color: rgba(155,226,45,0.32);
        }
        .staffing-stat-icon { color: var(--text-muted); font-size: 18px; flex-shrink: 0; }
        .staffing-stat-label {
          display: block;
          font-family: var(--font-heading);
          font-size: 10px; letter-spacing: 0.10em;
          text-transform: uppercase; color: var(--text-muted);
          font-weight: 600; margin-bottom: 2px;
        }
        .staffing-stat-value {
          font-family: var(--font-heading);
          font-size: 16px; font-weight: 700;
          color: var(--text-primary); letter-spacing: -0.01em;
        }
        .staffing-stat-value.gold { color: var(--accent-gold); font-size: 22px; }
        @media (max-width: 640px) { .staffing-grid { grid-template-columns: 1fr; } }
      `}</style>
    </>
  );
}
