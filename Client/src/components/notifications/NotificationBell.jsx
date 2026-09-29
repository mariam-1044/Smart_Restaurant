import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaBell } from "react-icons/fa";
import useNotifications from "../../hooks/useNotifications";
import NotificationDropdown from "./NotificationDropdown";

function resolveRoute(item) {
  switch (item.type) {
    case "low_stock":
    case "expiry":
    case "reorder":
      return item.entityModel === "Ingredient" && item.relatedEntity ? `/inventory/${item.relatedEntity}` : null;
    case "spoilage_risk": {
      const firstId = item.payload?.ingredients?.[0]?.ingredientId;
      return firstId ? `/inventory/${firstId}` : null;
    }
    case "price_suggestion":
      return "/ai/pricing";
    default:
      return null;
  }
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const wrapRef = useRef(null);
  const n = useNotifications();
  const hasUnread = n.count > 0;

  useEffect(() => {
    function handleOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    function handleEsc(e) { if (e.key === "Escape") setOpen(false); }
    if (open) {
      document.addEventListener("mousedown", handleOutside);
      document.addEventListener("keydown", handleEsc);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open]);

  function toggle() {
    setOpen((o) => {
      const next = !o;
      if (next) n.open();
      return next;
    });
  }

  function handleItemClick(item, navigable) {
    setOpen(false);
    n.markReadOptimistic(item._id);
    if (navigable) {
      const route = resolveRoute(item);
      if (route) navigate(route);
    }
  }

  return (
    <>
      <div ref={wrapRef} className="gn-bell-wrap">
        <button
          onClick={toggle}
          className={`gn-bell-btn ${hasUnread ? "gn-bell-active" : ""} ${open ? "gn-bell-open" : ""}`}
          aria-label="Notifications"
          aria-expanded={open}
        >
          <FaBell className="gn-bell-icon" />
          {hasUnread && (
            <span className="gn-bell-badge" aria-label={`${n.count} unread`}>
              {n.count > 99 ? "99+" : n.count}
            </span>
          )}
        </button>
        {open && (
          <NotificationDropdown
            items={n.items}
            listState={n.listState}
            count={n.count}
            onItemClick={handleItemClick}
            onMarkAllRead={n.markAllReadOptimistic}
            onRetry={n.refresh}
          />
        )}
      </div>
      <style>{`
        .gn-bell-wrap { position: relative; display: inline-flex; }
        .gn-bell-btn {
          position: relative;
          width: 40px; height: 40px;
          display: inline-flex; align-items: center; justify-content: center;
          border-radius: 12px;
          border: 1px solid var(--border-color, #e5e5e5);
          background: var(--bg-elevated, #f5f4f0);
          color: var(--text-secondary, #555);
          cursor: pointer;
          transition: all 180ms var(--ease-out-expo, ease);
        }
        .gn-bell-btn:hover {
          color: var(--accent-gold, #C9A227);
          border-color: color-mix(in srgb, var(--accent-gold, #C9A227) 40%, transparent);
        }
        .gn-bell-open {
          color: var(--accent-gold, #C9A227);
          border-color: var(--accent-gold, #C9A227);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-gold, #C9A227) 16%, transparent);
        }
        .gn-bell-icon { font-size: 16px; transform-origin: top center; }
        .gn-bell-active .gn-bell-icon { color: var(--accent-gold, #C9A227); animation: gnRing 2.6s ease-in-out infinite; }
        @keyframes gnRing {
          0%, 88%, 100% { transform: rotate(0); }
          90% { transform: rotate(14deg); }
          92% { transform: rotate(-12deg); }
          94% { transform: rotate(9deg); }
          96% { transform: rotate(-6deg); }
          98% { transform: rotate(3deg); }
        }
        .gn-bell-badge {
          position: absolute; top: -5px; right: -5px;
          min-width: 18px; height: 18px; padding: 0 4px;
          display: inline-flex; align-items: center; justify-content: center;
          font-family: var(--font-heading, inherit);
          font-size: 10px; font-weight: 700; line-height: 1;
          color: #fff; background: var(--accent-red, #D72638);
          border-radius: 999px;
          border: 2px solid var(--bg-secondary, #fff);
          box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent-red, #D72638) 60%, transparent);
          animation: gnPulse 2.2s ease-out infinite;
        }
        @keyframes gnPulse {
          0%   { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent-red, #D72638) 55%, transparent); }
          70%  { box-shadow: 0 0 0 7px color-mix(in srgb, var(--accent-red, #D72638) 0%, transparent); }
          100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent-red, #D72638) 0%, transparent); }
        }
        @media (prefers-reduced-motion: reduce) {
          .gn-bell-active .gn-bell-icon, .gn-bell-badge { animation: none; }
        }
      `}</style>
    </>
  );
}
