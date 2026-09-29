export default function CustomerTagBadges({ tags }) {
  const config = {
    Regular: { color: "#3B82F6", bg: "rgba(59,130,246,0.12)", icon: "★" },
    "High Value": { color: "#C9A227", bg: "rgba(155,226,45,0.14)", icon: "♛" },
    "At Risk": { color: "#F59E0B", bg: "rgba(245,158,11,0.14)", icon: "⚠" },
    VIP: { color: "#D72638", bg: "rgba(215,38,56,0.12)", icon: "✦" },
    New: { color: "#10B981", bg: "rgba(16,185,129,0.12)", icon: "✦" },
  };
  if (!tags || tags.length === 0) return null;
  return (
    <>
      <div className="cust-tags">
        {tags.map((tag) => {
          const cfg = config[tag] || { color: "#9CA3AF", bg: "var(--bg-elevated)", icon: "•" };
          return (
            <span
              key={tag}
              className="cust-tag"
              style={{
                color: cfg.color,
                background: cfg.bg,
                border: `1px solid ${cfg.color}33`,
              }}
            >
              <span className="cust-tag-icon">{cfg.icon}</span>
              {tag}
            </span>
          );
        })}
      </div>
      <style>{`
        .cust-tags { display: inline-flex; gap: 6px; flex-wrap: wrap; }
        .cust-tag {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 4px 10px;
          border-radius: 999px;
          font-family: var(--font-heading);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.04em;
          white-space: nowrap;
        }
        .cust-tag-icon { font-size: 10px; line-height: 1; }
      `}</style>
    </>
  );
}
