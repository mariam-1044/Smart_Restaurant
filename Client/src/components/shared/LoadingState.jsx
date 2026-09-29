import { FaSpinner } from "react-icons/fa";

export default function LoadingState({ message }) {
  return (
    <>
      <div className="geatsu-loading">
        <FaSpinner className="geatsu-loading-spin" />
        <span>{message || "Loading…"}</span>
      </div>
      <style>{`
        .geatsu-loading {
          display: inline-flex; align-items: center; gap: 10px;
          padding: 22px 24px;
          color: var(--text-secondary);
          font-family: var(--font-heading);
          font-size: 13px;
          letter-spacing: 0.04em;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
        }
        .geatsu-loading-spin {
          color: var(--accent-gold);
          animation: geatsuSpin 0.9s linear infinite;
        }
      `}</style>
    </>
  );
}
