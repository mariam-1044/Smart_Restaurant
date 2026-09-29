import React from "react";

/**
 * Geatsu Badge — glowing status pill.
 * tones: success | warning | danger | info | neutral | gold
 * Add `glow` for the active-status pulse.
 */
export default function Badge({
  tone = "neutral",
  glow = false,
  size = "md",
  className = "",
  children,
}) {
  const sizes = {
    sm: "geatsu-badge-sm",
    md: "geatsu-badge-md",
  };
  return (
    <>
      <span
        className={`geatsu-badge geatsu-badge-${tone} ${sizes[size] || sizes.md} ${glow ? "geatsu-badge-glow" : ""} ${className}`}
      >
        <span className="geatsu-badge-dot" />
        {children}
      </span>
      <style>{`
        .geatsu-badge {
          display: inline-flex; align-items: center; gap: 6px;
          font-family: var(--font-heading);
          font-weight: 600; letter-spacing: 0.04em;
          border-radius: 999px; border: 1px solid transparent;
          white-space: nowrap;
          line-height: 1;
        }
        .geatsu-badge-md { padding: 5px 12px; font-size: 11px; }
        .geatsu-badge-sm { padding: 3px 9px; font-size: 10px; }
        .geatsu-badge-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: currentColor;
        }
        .geatsu-badge-success {
          background: var(--status-success-bg);
          color: var(--status-success-fg);
          border-color: rgba(16, 185, 129, 0.28);
        }
        .geatsu-badge-warning {
          background: var(--status-warn-bg);
          color: var(--status-warn-fg);
          border-color: rgba(245, 158, 11, 0.28);
        }
        .geatsu-badge-danger {
          background: var(--status-danger-bg);
          color: var(--status-danger-fg);
          border-color: rgba(215, 38, 56, 0.32);
        }
        .geatsu-badge-info {
          background: var(--status-info-bg);
          color: var(--status-info-fg);
          border-color: rgba(59, 130, 246, 0.28);
        }
        .geatsu-badge-neutral {
          background: var(--bg-elevated);
          color: var(--text-secondary);
          border-color: var(--border-color);
        }
        .geatsu-badge-gold {
          background: rgba(155, 226, 45, 0.14);
          color: var(--accent-gold);
          border-color: rgba(155, 226, 45, 0.34);
        }
        .geatsu-badge-glow.geatsu-badge-success { box-shadow: var(--glow-green); }
        .geatsu-badge-glow.geatsu-badge-danger { box-shadow: var(--glow-red); }
        .geatsu-badge-glow.geatsu-badge-gold { box-shadow: var(--glow-gold); }
      `}</style>
    </>
  );
}
