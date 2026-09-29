import React from "react";

/**
 * Geatsu Card — glassmorphic surface that adapts to light + dark themes.
 *
 * variants:
 *   glass     — translucent, soft border + blur (default)
 *   solid     — opaque elevated surface (for tables, dense lists)
 *   accent    — subtle accent-tint (for highlight tiles)
 */
export default function Card({
  variant = "glass",
  className = "",
  padding = "p-6",
  children,
  as = "div",
  ...rest
}) {
  const Tag = as;
  const surfaces = {
    glass: "geatsu-card-glass",
    solid: "geatsu-card-solid",
    accent: "geatsu-card-accent",
  };

  return (
    <>
      <Tag
        className={`geatsu-card ${surfaces[variant] || surfaces.glass} ${padding} ${className}`}
        {...rest}
      >
        {children}
      </Tag>
      <style>{`
        .geatsu-card {
          border-radius: var(--radius-lg);
          transition: border-color 200ms var(--ease-out-expo), box-shadow 200ms var(--ease-out-expo);
        }
        .geatsu-card-glass {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          box-shadow: var(--shadow-soft);
        }
        [data-theme="dark"] .geatsu-card-glass {
          background: rgba(255,255,255,0.04);
        }
        .geatsu-card-solid {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          box-shadow: var(--shadow-soft);
        }
        .geatsu-card-accent {
          background: linear-gradient(135deg, rgba(31,122,63,0.08), rgba(155,226,45,0.06));
          border: 1px solid var(--border-color);
        }
      `}</style>
    </>
  );
}
