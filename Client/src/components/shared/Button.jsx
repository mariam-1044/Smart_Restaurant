import React from "react";

/**
 * Geatsu Button
 *
 * variants:
 *   primary   — accent-red with a cinematic glow + sheen on hover
 *   secondary — translucent surface, subtle border
 *   danger    — destructive red
 *   ghost     — text-only, no surface
 *   gold      — premium gold accent (publish / featured actions)
 *   success   — confirm / positive actions
 *   info      — informational / neutral-blue actions
 *
 * sizes: sm | md | lg | xl | icon (square, icon-only)
 *
 * extra props:
 *   block — full-width
 *   pill  — fully rounded
 *   glow  — force the accent glow even at rest
 */
export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  type = "button",
  loading = false,
  disabled = false,
  iconLeft = null,
  iconRight = null,
  block = false,
  pill = false,
  glow = false,
  ...rest
}) {
  const sizes = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2.5 text-sm gap-2",
    lg: "px-6 py-3 text-base gap-2.5",
    xl: "px-8 py-3.5 text-base gap-3",
    icon: "geatsu-btn-iconsize",
  };

  const variants = {
    primary: "geatsu-btn-primary",
    secondary: "geatsu-btn-secondary",
    danger: "geatsu-btn-danger",
    ghost: "geatsu-btn-ghost",
    gold: "geatsu-btn-gold",
    success: "geatsu-btn-success",
    info: "geatsu-btn-info",
  };

  const base =
    "geatsu-btn relative overflow-hidden inline-flex items-center justify-center font-semibold tracking-wide select-none " +
    "transition-[transform,box-shadow,background-color,color,border-color] duration-200 ease-out " +
    "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0";

  const shapeClass = pill ? "geatsu-btn-pill" : "rounded-xl";
  const blockClass = block ? "geatsu-btn-block" : "";
  const glowClass = glow ? "geatsu-btn-forceglow" : "";

  return (
    <>
      <button
        type={type}
        disabled={disabled || loading}
        className={`${base} ${sizes[size] || sizes.md} ${variants[variant] || variants.primary} ${shapeClass} ${blockClass} ${glowClass} ${className}`}
        {...rest}
      >
        <span className="geatsu-btn-sheen" aria-hidden />
        {loading && <span className="geatsu-btn-spinner" aria-hidden />}
        {!loading && iconLeft}
        {children != null && <span className="geatsu-btn-label">{children}</span>}
        {!loading && iconRight}
      </button>
      <style>{`
        .geatsu-btn {
          font-family: var(--font-heading);
          letter-spacing: 0.02em;
          will-change: transform, box-shadow;
          isolation: isolate;
        }
        .geatsu-btn:not(:disabled):hover { transform: translateY(-1px) scale(1.02); }
        .geatsu-btn:not(:disabled):active { transform: translateY(0) scale(0.99); }
        .geatsu-btn:focus { outline: none; }
        .geatsu-btn:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px var(--bg-secondary, #fff), 0 0 0 5px var(--accent-gold, #C9A227);
        }
        .geatsu-btn-label { position: relative; z-index: 1; display: inline-flex; align-items: center; }
        .geatsu-btn-pill { border-radius: 999px; }
        .geatsu-btn-block { width: 100%; }
        .geatsu-btn-iconsize { width: 38px; height: 38px; padding: 0; }
        .geatsu-btn-iconsize.geatsu-btn-pill { border-radius: 999px; }

        /* Hover sheen — a soft light sweep across filled buttons. */
        .geatsu-btn-sheen {
          position: absolute; inset: 0; z-index: 0;
          pointer-events: none;
          background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.28) 50%, transparent 70%);
          transform: translateX(-130%);
          transition: transform 650ms var(--ease-out-expo, ease);
        }
        .geatsu-btn-primary .geatsu-btn-sheen,
        .geatsu-btn-gold .geatsu-btn-sheen,
        .geatsu-btn-success .geatsu-btn-sheen,
        .geatsu-btn-info .geatsu-btn-sheen { display: block; }
        .geatsu-btn-secondary .geatsu-btn-sheen,
        .geatsu-btn-ghost .geatsu-btn-sheen,
        .geatsu-btn-danger .geatsu-btn-sheen { display: none; }
        .geatsu-btn:not(:disabled):hover .geatsu-btn-sheen { transform: translateX(130%); }

        .geatsu-btn-primary {
          background: var(--accent-red, #D72638);
          color: #fff;
          box-shadow: 0 6px 18px rgba(215, 38, 56, 0.22);
        }
        .geatsu-btn-primary:not(:disabled):hover {
          box-shadow: 0 10px 26px rgba(215, 38, 56, 0.42), var(--glow-red, 0 0 0 transparent);
          background: #E5354A;
        }
        .geatsu-btn-primary.geatsu-btn-forceglow { box-shadow: 0 6px 18px rgba(215,38,56,0.22), var(--glow-red, 0 0 0 transparent); }

        .geatsu-btn-secondary {
          background: var(--bg-elevated, #F1F0EB);
          color: var(--text-primary, #1a1a1a);
          border: 1px solid var(--border-color, #ddd);
        }
        [data-theme="dark"] .geatsu-btn-secondary { background: rgba(255,255,255,0.04); }
        .geatsu-btn-secondary:not(:disabled):hover {
          border-color: var(--accent-gold, #C9A227);
          color: var(--accent-gold, #C9A227);
        }

        .geatsu-btn-danger {
          background: rgba(215, 38, 56, 0.12);
          color: var(--accent-red, #D72638);
          border: 1px solid rgba(215, 38, 56, 0.4);
        }
        .geatsu-btn-danger:not(:disabled):hover {
          background: var(--accent-red, #D72638);
          color: #fff;
          box-shadow: 0 8px 22px rgba(215, 38, 56, 0.4);
        }

        .geatsu-btn-ghost { background: transparent; color: var(--text-secondary, #555); }
        .geatsu-btn-ghost:not(:disabled):hover {
          color: var(--text-primary, #1a1a1a);
          background: var(--bg-elevated, #F1F0EB);
        }

        .geatsu-btn-gold {
          background: var(--accent-gold, #C9A227);
          color: #1A1408;
          box-shadow: 0 6px 18px rgba(155, 226, 45, 0.25);
        }
        .geatsu-btn-gold:not(:disabled):hover {
          box-shadow: 0 10px 28px rgba(155, 226, 45, 0.45), var(--glow-gold, 0 0 0 transparent);
          background: #DDB438;
        }
        .geatsu-btn-gold.geatsu-btn-forceglow { box-shadow: 0 6px 18px rgba(155,226,45,0.25), var(--glow-gold, 0 0 0 transparent); }

        .geatsu-btn-success {
          background: var(--accent-green, #10B981);
          color: #06281c;
          box-shadow: 0 6px 18px rgba(16, 185, 129, 0.22);
        }
        .geatsu-btn-success:not(:disabled):hover {
          background: #14C68C;
          box-shadow: 0 10px 26px rgba(16, 185, 129, 0.4), var(--glow-green, 0 0 0 transparent);
        }
        .geatsu-btn-success.geatsu-btn-forceglow { box-shadow: 0 6px 18px rgba(16,185,129,0.22), var(--glow-green, 0 0 0 transparent); }

        .geatsu-btn-info {
          background: var(--accent-blue, #3B82F6);
          color: #fff;
          box-shadow: 0 6px 18px rgba(59, 130, 246, 0.22);
        }
        .geatsu-btn-info:not(:disabled):hover {
          background: #4F8FF7;
          box-shadow: 0 10px 26px rgba(59, 130, 246, 0.4);
        }

        .geatsu-btn-spinner {
          position: relative; z-index: 1;
          width: 14px; height: 14px; border-radius: 50%;
          border: 2px solid currentColor; border-top-color: transparent;
          animation: geatsuSpin 0.7s linear infinite;
        }
        @keyframes geatsuSpin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
