import {
  FaBoxOpen,
  FaHourglassHalf,
  FaTruck,
  FaUtensils,
  FaTimesCircle,
  FaInfoCircle,
  FaChevronRight,
  FaTags,
} from "react-icons/fa";
import { relativeTime } from "../../utils/relativeTime";

// Per-type presentation. `tone` maps to a CSS-var accent so it follows the theme.
const TYPE_META = {
  low_stock: { icon: FaBoxOpen, tone: "gold", label: "Low stock" },
  expiry: { icon: FaHourglassHalf, tone: "red", label: "Expiring" },
  reorder: { icon: FaTruck, tone: "blue", label: "Reorder" },
  spoilage_risk: { icon: FaUtensils, tone: "violet", label: "Spoilage risk" },
  spoilage_recipe_failed: { icon: FaTimesCircle, tone: "red", label: "Recipe failed" },
  price_suggestion: { icon: FaTags, tone: "blue", label: "Price suggestion" },
  system: { icon: FaInfoCircle, tone: "neutral", label: "System" },
};

const NAVIGABLE_TYPES = ["low_stock", "expiry", "reorder", "spoilage_risk", "price_suggestion"];

export default function NotificationItem({ item, onClick }) {
  const meta = TYPE_META[item.type] || TYPE_META.system;
  const Icon = meta.icon;
  const navigable = NAVIGABLE_TYPES.includes(item.type) && !!item.relatedEntity;

  return (
    <>
      <button
        type="button"
        onClick={() => onClick(item, navigable)}
        className={`gn-item gn-tone-${meta.tone} ${item.read ? "gn-read" : "gn-unread"} ${navigable ? "gn-nav" : ""}`}
        title={navigable ? "Open related item" : undefined}
      >
        <span className="gn-stripe" aria-hidden />
        <span className="gn-chip"><Icon /></span>
        <span className="gn-body">
          <span className="gn-toprow">
            <span className="gn-title">{item.title}</span>
            {!item.read && <span className="gn-dot" aria-label="unread" />}
          </span>
          <span className="gn-msg">{item.message}</span>
          <span className="gn-meta">
            <span className="gn-kind">{meta.label}</span>
            <span className="gn-sep">·</span>
            <span className="gn-time">{relativeTime(item.createdAt)}</span>
          </span>
        </span>
        {navigable && <FaChevronRight className="gn-go" aria-hidden />}
      </button>
      <style>{`
        .gn-item {
          position: relative;
          display: flex; align-items: flex-start; gap: 12px;
          width: 100%;
          padding: 12px 14px 12px 16px;
          background: transparent;
          border: 0; border-bottom: 1px solid var(--border-color, #eee);
          text-align: left;
          cursor: default;
          font-family: inherit;
          transition: background-color 160ms var(--ease-out-expo, ease);
        }
        .gn-item:last-child { border-bottom: 0; }
        .gn-item.gn-nav { cursor: pointer; }
        .gn-item.gn-nav:hover { background: var(--bg-elevated, #f5f5f5); }
        .gn-item.gn-unread { background: color-mix(in srgb, var(--accent-gold, #C9A227) 5%, transparent); }
        .gn-item.gn-unread.gn-nav:hover { background: var(--bg-elevated, #f5f5f5); }
        .gn-item.gn-read { opacity: 0.78; }

        .gn-stripe {
          position: absolute; left: 0; top: 8px; bottom: 8px; width: 3px;
          border-radius: 0 3px 3px 0;
          background: var(--gn-accent);
          opacity: 0;
          transition: opacity 160ms var(--ease-out-expo, ease);
        }
        .gn-item.gn-unread .gn-stripe { opacity: 1; }

        .gn-chip {
          flex-shrink: 0;
          width: 34px; height: 34px;
          border-radius: 10px;
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 14px;
          background: color-mix(in srgb, var(--gn-accent) 14%, transparent);
          color: var(--gn-accent);
          border: 1px solid color-mix(in srgb, var(--gn-accent) 28%, transparent);
        }

        .gn-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
        .gn-toprow { display: flex; align-items: center; gap: 8px; }
        .gn-title {
          font-family: var(--font-heading, inherit);
          font-size: 13px;
          color: var(--text-primary, #1a1a1a);
          font-weight: 600;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .gn-item.gn-read .gn-title { font-weight: 500; }
        .gn-dot {
          flex-shrink: 0;
          width: 7px; height: 7px; border-radius: 50%;
          background: var(--gn-accent);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--gn-accent) 22%, transparent);
        }
        .gn-msg {
          font-size: 12px; color: var(--text-secondary, #555);
          line-height: 1.4;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .gn-meta {
          display: flex; align-items: center; gap: 6px;
          font-size: 10.5px; color: var(--text-muted, #999);
          font-family: var(--font-heading, inherit);
          letter-spacing: 0.04em; text-transform: uppercase;
        }
        .gn-kind { color: var(--gn-accent); font-weight: 600; }
        .gn-sep { opacity: 0.5; }
        .gn-go {
          align-self: center; flex-shrink: 0;
          font-size: 11px; color: var(--text-muted, #aaa);
          transition: transform 160ms var(--ease-out-expo, ease), color 160ms;
        }
        .gn-item.gn-nav:hover .gn-go { transform: translateX(2px); color: var(--gn-accent); }

        .gn-tone-gold    { --gn-accent: var(--accent-gold, #C9A227); }
        .gn-tone-red     { --gn-accent: var(--accent-red, #D72638); }
        .gn-tone-blue    { --gn-accent: var(--accent-blue, #3B82F6); }
        .gn-tone-violet  { --gn-accent: #A78BFA; }
        .gn-tone-neutral { --gn-accent: var(--text-muted, #8a8a8a); }
      `}</style>
    </>
  );
}
