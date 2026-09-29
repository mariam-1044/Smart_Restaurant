import { FaBell, FaCheckDouble, FaRegBellSlash } from "react-icons/fa";
import LoadingState from "../shared/LoadingState";
import ErrorState from "../shared/ErrorState";
import NotificationItem from "./NotificationItem";

export default function NotificationDropdown({ items, listState, count, onItemClick, onMarkAllRead, onRetry }) {
  return (
    <>
      <div className="gn-panel" role="dialog" aria-label="Notifications">
        <div className="gn-arrow" aria-hidden />
        <header className="gn-head">
          <div className="gn-head-title">
            <FaBell className="gn-head-bell" />
            <h4>Notifications</h4>
            {count > 0 && <span className="gn-head-count">{count > 99 ? "99+" : count}</span>}
          </div>
          <button
            type="button"
            onClick={onMarkAllRead}
            disabled={count === 0}
            className="gn-markall"
          >
            <FaCheckDouble /> Mark all read
          </button>
        </header>

        <div className="gn-list">
          {listState === "loading" && (
            <div className="gn-state"><LoadingState message="Loading notifications…" /></div>
          )}
          {listState === "error" && (
            <div className="gn-state"><ErrorState message="Couldn't reach the notifications service." onRetry={onRetry} /></div>
          )}
          {listState === "ready" && items.length === 0 && (
            <div className="gn-empty">
              <span className="gn-empty-chip"><FaRegBellSlash /></span>
              <div className="gn-empty-title">You're all caught up</div>
              <div className="gn-empty-msg">No notifications right now.</div>
            </div>
          )}
          {listState === "ready" && items.length > 0 && items.map((item) => (
            <NotificationItem key={item._id} item={item} onClick={onItemClick} />
          ))}
        </div>

        {listState === "ready" && items.length > 0 && (
          <footer className="gn-foot">Showing the {items.length} most recent</footer>
        )}
      </div>
      <style>{`
        .gn-panel {
          position: absolute; right: -6px; top: calc(100% + 12px);
          z-index: 60;
          width: 380px; max-width: calc(100vw - 32px);
          max-height: 70vh;
          display: flex; flex-direction: column;
          background: var(--bg-card, #fff);
          border: 1px solid var(--border-color, #e5e5e5);
          border-radius: var(--radius-lg, 14px);
          box-shadow: var(--shadow-elev, 0 18px 50px rgba(0,0,0,0.18));
          overflow: hidden;
          transform-origin: top right;
          animation: gnPop 200ms var(--ease-out-expo, cubic-bezier(0.16,1,0.3,1));
          backdrop-filter: blur(14px);
        }
        @keyframes gnPop {
          from { opacity: 0; transform: translateY(-8px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .gn-arrow {
          position: absolute; top: -6px; right: 18px;
          width: 12px; height: 12px;
          background: var(--bg-card, #fff);
          border-left: 1px solid var(--border-color, #e5e5e5);
          border-top: 1px solid var(--border-color, #e5e5e5);
          transform: rotate(45deg);
        }
        .gn-head {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px;
          padding: 14px 16px;
          border-bottom: 1px solid var(--border-color, #eee);
          background: var(--bg-elevated, #faf9f6);
        }
        .gn-head-title { display: flex; align-items: center; gap: 9px; }
        .gn-head-bell { color: var(--accent-gold, #C9A227); font-size: 14px; }
        .gn-head-title h4 {
          margin: 0;
          font-family: var(--font-heading, inherit);
          font-size: 14px; font-weight: 700;
          color: var(--text-primary, #1a1a1a);
          letter-spacing: 0.02em;
        }
        .gn-head-count {
          font-family: var(--font-heading, inherit);
          font-size: 10px; font-weight: 700;
          color: #fff; background: var(--accent-red, #D72638);
          padding: 2px 7px; border-radius: 999px;
          line-height: 1.4;
        }
        .gn-markall {
          display: inline-flex; align-items: center; gap: 6px;
          font-family: var(--font-heading, inherit);
          font-size: 11px; font-weight: 600;
          letter-spacing: 0.04em; text-transform: uppercase;
          color: var(--accent-gold, #C9A227);
          background: transparent; border: 1px solid color-mix(in srgb, var(--accent-gold, #C9A227) 32%, transparent);
          padding: 5px 10px; border-radius: 999px;
          cursor: pointer;
          transition: all 160ms var(--ease-out-expo, ease);
        }
        .gn-markall:hover:not(:disabled) { background: color-mix(in srgb, var(--accent-gold, #C9A227) 14%, transparent); }
        .gn-markall:disabled { opacity: 0.4; cursor: not-allowed; }

        .gn-list { flex: 1; overflow-y: auto; }
        .gn-state { padding: 16px; }

        .gn-empty {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 36px 24px; text-align: center;
        }
        .gn-empty-chip {
          width: 46px; height: 46px; border-radius: 50%;
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 18px;
          color: var(--accent-green, #10B981);
          background: color-mix(in srgb, var(--accent-green, #10B981) 12%, transparent);
          margin-bottom: 12px;
        }
        .gn-empty-title {
          font-family: var(--font-heading, inherit);
          font-size: 14px; font-weight: 700; color: var(--text-primary, #1a1a1a);
          margin-bottom: 4px;
        }
        .gn-empty-msg { font-size: 12px; color: var(--text-muted, #999); }

        .gn-foot {
          padding: 9px 16px;
          font-family: var(--font-heading, inherit);
          font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--text-muted, #999);
          text-align: center;
          border-top: 1px solid var(--border-color, #eee);
          background: var(--bg-elevated, #faf9f6);
        }
      `}</style>
    </>
  );
}
