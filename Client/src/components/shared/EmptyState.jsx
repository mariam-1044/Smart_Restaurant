import { FaRegFolderOpen } from "react-icons/fa";

/**
 * EmptyState — a friendly "nothing here yet" placeholder.
 * Pass `icon` to override the default (a React element, e.g. <FaHeart />).
 */
export default function EmptyState({ title, message, action, icon }) {
  return (
    <>
      <div className="geatsu-empty">
        <span className="geatsu-empty-icon">{icon || <FaRegFolderOpen />}</span>
        <h3 className="geatsu-empty-title">{title}</h3>
        {message && <p className="geatsu-empty-msg">{message}</p>}
        {action && <div className="geatsu-empty-action">{action}</div>}
      </div>
      <style>{`
        .geatsu-empty {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 32px;
          text-align: center;
          background: var(--bg-card);
          border: 1px dashed var(--border-color);
          border-radius: var(--radius-lg);
        }
        .geatsu-empty-icon {
          width: 48px; height: 48px;
          display: inline-flex; align-items: center; justify-content: center;
          border-radius: 50%;
          font-size: 19px;
          color: var(--accent-gold);
          background: color-mix(in srgb, var(--accent-gold) 12%, transparent);
          margin-bottom: 14px;
        }
        .geatsu-empty-title {
          font-family: var(--font-heading);
          font-size: 16px; font-weight: 700;
          margin: 0 0 6px 0;
          color: var(--text-primary);
        }
        .geatsu-empty-msg { color: var(--text-muted); font-size: 13px; margin: 0 0 14px 0; }
        .geatsu-empty-action { display: flex; gap: 8px; }
      `}</style>
    </>
  );
}
