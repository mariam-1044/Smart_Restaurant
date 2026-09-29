import React, { useEffect } from "react";
import { FaCheckCircle, FaTimesCircle, FaInfoCircle } from "react-icons/fa";

/**
 * Geatsu Toast — status-coded pill with refined typography + shadow.
 * Keeps an inline backgroundColor so the visual status is unambiguous and
 * verifiable from snapshot/style assertions.
 */
export default function Toast({ variant = "info", message, onDismiss, duration = 4000 }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [onDismiss, duration]);

  const palette = {
    success: { bg: "#16a34a", icon: FaCheckCircle },
    error: { bg: "#dc2626", icon: FaTimesCircle },
    info: { bg: "#3b82f6", icon: FaInfoCircle },
  }[variant] || { bg: "#3b82f6", icon: FaInfoCircle };

  const Icon = palette.icon;

  return (
    <div
      role="alert"
      onClick={onDismiss}
      style={{
        backgroundColor: palette.bg,
        color: "#ffffff",
        padding: "12px 16px",
        marginBottom: 10,
        minWidth: 260,
        maxWidth: 380,
        borderRadius: 12,
        boxShadow: "0 18px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06) inset",
        fontFamily: "var(--font-body, 'Inter', sans-serif)",
        fontSize: 14,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 10,
        animation: "geatsuToastIn 220ms cubic-bezier(0.22,1,0.36,1) both",
      }}
    >
      <Icon style={{ flexShrink: 0 }} />
      <span>{message}</span>
      <style>{`
        @keyframes geatsuToastIn {
          from { opacity: 0; transform: translateX(20px) scale(0.96); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
