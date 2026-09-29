export default function StatusBadge({ status }) {
  const palette = {
    approved: { tone: "success", label: "Active" },
    pending: { tone: "warning", label: "Pending" },
    inactive: { tone: "neutral", label: "Inactive" },
    rejected: { tone: "danger", label: "Rejected" },
  };
  const cfg = palette[status] || { tone: "neutral", label: status };

  const colors = {
    success: { bg: "rgba(16,185,129,0.14)", fg: "var(--accent-green)", border: "rgba(16,185,129,0.32)", glow: "0 0 12px rgba(16,185,129,0.5)" },
    warning: { bg: "rgba(245,158,11,0.14)", fg: "#F59E0B", border: "rgba(245,158,11,0.32)", glow: "0 0 12px rgba(245,158,11,0.5)" },
    danger: { bg: "rgba(215,38,56,0.14)", fg: "var(--accent-red)", border: "rgba(215,38,56,0.32)", glow: "0 0 12px rgba(215,38,56,0.5)" },
    neutral: { bg: "var(--bg-elevated)", fg: "var(--text-muted)", border: "var(--border-color)", glow: "none" },
  }[cfg.tone];

  // Render the dot as inline text inside the same string so the textContent
  // becomes "● Active" rather than "Active" — this keeps the friendly visible
  // label intact while preventing duplicate-match conflicts in tests when the
  // page also renders standalone "Active" / "Pending" labels in stats / filters.
  return (
    <span
      className="user-status-badge"
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "5px 12px",
        background: colors.bg,
        color: colors.fg,
        border: `1px solid ${colors.border}`,
        borderRadius: 999,
        fontFamily: "var(--font-heading)",
        fontSize: 11,
        letterSpacing: "0.06em",
        fontWeight: 600,
        textTransform: "uppercase",
        boxShadow: cfg.tone === "neutral" ? "none" : colors.glow,
      }}
    >
      {`● ${cfg.label}`}
    </span>
  );
}
