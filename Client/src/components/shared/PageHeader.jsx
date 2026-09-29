import React from "react";

/**
 * Geatsu PageHeader — cinematic page-title block.
 * Shows an eyebrow tag (kicker), large display title, supporting subtitle,
 * and an optional actions slot on the right.
 */
export default function PageHeader({
  kicker,
  title,
  subtitle,
  actions,
  className = "",
}) {
  return (
    <>
      <header className={`geatsu-page-header ${className}`}>
        <div className="geatsu-page-header-text">
          {kicker && <span className="geatsu-page-kicker">{kicker}</span>}
          <h1 className="geatsu-page-title">{title}</h1>
          {subtitle && <p className="geatsu-page-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="geatsu-page-actions">{actions}</div>}
      </header>
      <style>{`
        .geatsu-page-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 24px; flex-wrap: wrap;
          padding-bottom: 18px;
          margin-bottom: 26px;
          border-bottom: 1px solid var(--border-color);
        }
        .geatsu-page-header-text { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .geatsu-page-kicker {
          font-family: var(--font-heading);
          font-size: 11px; font-weight: 600;
          letter-spacing: 0.18em; text-transform: uppercase;
          color: var(--accent-gold);
          display: inline-flex; align-items: center; gap: 8px;
        }
        .geatsu-page-kicker::before {
          content: ""; display: inline-block; width: 18px; height: 1px;
          background: currentColor;
        }
        .geatsu-page-title {
          font-family: var(--font-heading);
          font-size: clamp(26px, 3vw, 36px);
          font-weight: 700;
          margin: 0;
          color: var(--text-primary);
          letter-spacing: -0.02em;
          line-height: 1.1;
        }
        .geatsu-page-subtitle {
          margin: 0;
          color: var(--text-secondary);
          font-size: 14px;
          max-width: 64ch;
        }
        .geatsu-page-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        @media (max-width: 640px) {
          .geatsu-page-header { flex-direction: column; align-items: stretch; }
        }
      `}</style>
    </>
  );
}
