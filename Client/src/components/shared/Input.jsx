import React, { forwardRef } from "react";

/**
 * Geatsu Input — dark-first input with gold focus ring.
 * Supports text inputs, password, number, etc. and an optional adornment.
 */
const Input = forwardRef(function Input(
  { label, error, hint, leftIcon, rightSlot, className = "", id, ...rest },
  ref
) {
  const inputId = id || rest.name || `geatsu-input-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <>
      <div className={`geatsu-field ${className}`}>
        {label && (
          <label htmlFor={inputId} className="geatsu-field-label">
            {label}
          </label>
        )}
        <div className={`geatsu-input-wrap ${error ? "is-error" : ""}`}>
          {leftIcon && <span className="geatsu-input-icon">{leftIcon}</span>}
          <input ref={ref} id={inputId} className="geatsu-input" {...rest} />
          {rightSlot && <span className="geatsu-input-right">{rightSlot}</span>}
        </div>
        {hint && !error && <p className="geatsu-field-hint">{hint}</p>}
        {error && <p className="geatsu-field-err">{error}</p>}
      </div>
      <style>{`
        .geatsu-field { display: flex; flex-direction: column; gap: 6px; }
        .geatsu-field-label {
          font-family: var(--font-heading);
          font-size: 12px; font-weight: 600;
          letter-spacing: 0.06em; text-transform: uppercase;
          color: var(--text-muted);
        }
        .geatsu-input-wrap {
          display: flex; align-items: center; gap: 10px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 0 12px;
          transition: border-color 160ms var(--ease-out-expo), box-shadow 160ms var(--ease-out-expo), background-color 160ms var(--ease-out-expo);
        }
        [data-theme="dark"] .geatsu-input-wrap {
          background: rgba(255,255,255,0.03);
        }
        .geatsu-input-wrap:hover { border-color: var(--border-strong); }
        .geatsu-input-wrap:focus-within {
          border-color: var(--accent-gold);
          box-shadow: 0 0 0 3px rgba(155, 226, 45, 0.18);
        }
        .geatsu-input-wrap.is-error {
          border-color: var(--accent-red);
          box-shadow: 0 0 0 3px rgba(215, 38, 56, 0.16);
        }
        .geatsu-input {
          width: 100%; flex: 1;
          background: transparent; border: 0; outline: none;
          padding: 11px 0;
          color: var(--text-primary);
          font-family: var(--font-body);
          font-size: 14px;
        }
        .geatsu-input::placeholder { color: var(--text-muted); opacity: 0.8; }
        .geatsu-input:disabled { opacity: 0.6; cursor: not-allowed; }
        .geatsu-input-icon, .geatsu-input-right {
          color: var(--text-muted); display: inline-flex; align-items: center;
        }
        .geatsu-field-hint { margin: 0; font-size: 12px; color: var(--text-muted); }
        .geatsu-field-err { margin: 0; font-size: 12px; color: var(--accent-red); }
      `}</style>
    </>
  );
});

export default Input;
