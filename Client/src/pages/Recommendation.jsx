import DashboardLayout from "../layouts/DashboardLayout";
import { FaLightbulb, FaArrowUp, FaArrowDown, FaExclamationTriangle, FaSyncAlt, FaChartLine } from "react-icons/fa";
import { useEffect, useState } from "react";
import api from "../api/axios";
import PageHeader from "../components/shared/PageHeader";
import Button from "../components/shared/Button";
import EmptyState from "../components/shared/EmptyState";
import LoadingState from "../components/shared/LoadingState";

const CARD_ICON = {
  profit: FaArrowUp,
  waste: FaArrowDown,
  alert: FaExclamationTriangle,
};

export default function Recommendation() {
  const [recommendations, setRecommendations] = useState([]);
  const [didYouKnow, setDidYouKnow] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/v1/ai/recommendations");
      if (response.data.success) {
        const transformedRecs = (response.data.data || []).map((rec, index) => ({
          id: index + 1,
          title: rec.title || "Recommendation",
          desc: rec.description || rec.desc || "",
          impact: rec.impact || "Pending",
          type: rec.type === "marketing" ? "profit" : rec.type === "waste" ? "waste" : "alert",
        }));
        setRecommendations(transformedRecs);
        setDidYouKnow(response.data.didYouKnow || "");
      }
    } catch (err) {
      console.error("Error fetching recommendations:", err);
      const status = err?.response?.status;
      if (status === 403) {
        setError("AI Smart Recommendations are available to managers and staff.");
      } else {
        setError("Couldn't load AI recommendations right now. Try refreshing in a moment.");
      }
      setRecommendations([]);
      setDidYouKnow("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="rec-page">
        <PageHeader
          kicker="AI Studio"
          title="AI Smart Recommendations"
          subtitle="Data-driven insights to improve your restaurant's performance — computed live from your orders, menu and stock."
          actions={
            <Button variant="gold" iconLeft={<FaSyncAlt />} loading={loading} onClick={fetchRecommendations}>
              {loading ? "Refreshing…" : "Refresh"}
            </Button>
          }
        />

        {error && <div className="rec-error">{error}</div>}

        {loading && <LoadingState message="Loading recommendations…" />}

        {!loading && (
          <>
            {recommendations.length === 0 ? (
              <EmptyState
                icon={<FaChartLine />}
                title="No recommendations to show yet"
                message="They appear once you have completed orders and stocked ingredients."
              />
            ) : (
              <div className="rec-grid">
                {recommendations.map((rec) => {
                  const Icon = CARD_ICON[rec.type] || FaExclamationTriangle;
                  return (
                    <div key={rec.id} className={`rec-card rec-${rec.type}`}>
                      <span className="rec-stripe" aria-hidden />
                      <span className="rec-chip"><Icon /></span>
                      <div className="rec-content">
                        <h3>{rec.title}</h3>
                        <p>{rec.desc}</p>
                        <div className="rec-footer">
                          <span className="rec-impact-label">Estimated impact</span>
                          <span className="rec-impact-value">{rec.impact}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {didYouKnow && (
              <div className="rec-didyouknow">
                <span className="rec-dyk-chip"><FaLightbulb /></span>
                <div>
                  <h4>Did you know?</h4>
                  <p>{didYouKnow}</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        .rec-page { padding: 28px; display: flex; flex-direction: column; gap: 20px; }
        .rec-error {
          padding: 12px 16px;
          background: var(--status-warn-bg);
          color: var(--status-warn-fg);
          border: 1px solid rgba(245,158,11,0.32);
          border-radius: var(--radius-md, 12px);
          font-size: 13px;
        }
        .rec-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
        .rec-card {
          position: relative;
          display: flex; gap: 14px;
          padding: 18px 18px 18px 22px;
          background: var(--bg-card, #fff);
          border: 1px solid var(--border-color, #e5e5e5);
          border-radius: var(--radius-lg, 14px);
          box-shadow: var(--shadow-soft, 0 2px 10px rgba(0,0,0,0.06));
          transition: transform 200ms var(--ease-out-expo, ease), box-shadow 200ms var(--ease-out-expo, ease);
        }
        .rec-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-elev, 0 14px 40px rgba(0,0,0,0.14)); }
        .rec-stripe { position: absolute; left: 0; top: 12px; bottom: 12px; width: 3px; border-radius: 0 3px 3px 0; background: var(--rec-accent); }
        .rec-chip {
          flex-shrink: 0; width: 38px; height: 38px;
          display: inline-flex; align-items: center; justify-content: center;
          border-radius: 11px; font-size: 15px;
          color: var(--rec-accent);
          background: color-mix(in srgb, var(--rec-accent) 14%, transparent);
          border: 1px solid color-mix(in srgb, var(--rec-accent) 28%, transparent);
        }
        .rec-content { flex: 1; min-width: 0; }
        .rec-content h3 {
          margin: 0 0 8px 0; font-size: 15px; font-weight: 700;
          font-family: var(--font-heading, inherit);
          color: var(--text-primary, #1a1a1a);
        }
        .rec-content p { margin: 0 0 14px 0; color: var(--text-secondary, #555); font-size: 13.5px; line-height: 1.55; }
        .rec-footer {
          display: flex; justify-content: space-between; align-items: center;
          padding-top: 10px; border-top: 1px solid var(--border-color, #eee);
        }
        .rec-impact-label {
          font-family: var(--font-heading, inherit);
          font-size: 10px; letter-spacing: 0.10em; text-transform: uppercase;
          color: var(--text-muted, #999); font-weight: 600;
        }
        .rec-impact-value {
          font-family: var(--font-heading, inherit);
          font-size: 14px; font-weight: 700;
          color: var(--rec-accent);
        }
        .rec-profit { --rec-accent: var(--accent-green, #10B981); }
        .rec-waste  { --rec-accent: var(--accent-gold, #C9A227); }
        .rec-alert  { --rec-accent: var(--accent-red, #D72638); }

        .rec-didyouknow {
          display: flex; gap: 16px; align-items: flex-start;
          padding: 20px 22px;
          border-radius: var(--radius-lg, 14px);
          background: linear-gradient(135deg, color-mix(in srgb, var(--accent-gold, #C9A227) 18%, var(--bg-card, #1a1a1a)) 0%, var(--bg-card, #1a1a1a) 70%);
          border: 1px solid color-mix(in srgb, var(--accent-gold, #C9A227) 30%, transparent);
        }
        .rec-dyk-chip {
          flex-shrink: 0; width: 42px; height: 42px;
          display: inline-flex; align-items: center; justify-content: center;
          border-radius: 12px; font-size: 18px;
          color: var(--accent-gold, #C9A227);
          background: color-mix(in srgb, var(--accent-gold, #C9A227) 16%, transparent);
        }
        .rec-didyouknow h4 {
          margin: 0 0 6px 0; font-family: var(--font-heading, inherit);
          font-size: 15px; font-weight: 700; color: var(--text-primary, #fff);
        }
        .rec-didyouknow p { margin: 0; font-size: 13.5px; line-height: 1.55; color: var(--text-secondary, #ddd); }

        @media (max-width: 768px) {
          .rec-grid { grid-template-columns: 1fr; }
          .rec-didyouknow { flex-direction: column; }
        }
      `}</style>
    </DashboardLayout>
  );
}
