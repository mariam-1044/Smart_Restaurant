export default function FilterPills({ options, value, onChange }) {
  return (
    <>
      <div className="geatsu-filter-pills">
        {options.map((opt) => {
          const active = opt.value === value;
          // Render label + count inline as a single text node so this control
          // doesn't accidentally collide with table cells / status badges that
          // share the same label text when tests query by exact text.
          const display =
            opt.count !== undefined ? `${opt.label} · ${opt.count}` : opt.label;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(active ? null : opt.value)}
              className={`geatsu-filter-pill ${active ? "is-active" : ""}`}
              type="button"
            >
              {display}
            </button>
          );
        })}
      </div>
      <style>{`
        .geatsu-filter-pills {
          display: flex; gap: 8px; flex-wrap: wrap;
        }
        .geatsu-filter-pill {
          display: inline-flex; align-items: center;
          padding: 8px 16px;
          border-radius: 999px;
          background: var(--bg-elevated);
          color: var(--text-secondary);
          border: 1px solid var(--border-color);
          font-family: var(--font-heading);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.04em;
          cursor: pointer;
          transition: all 200ms var(--ease-out-expo);
        }
        .geatsu-filter-pill:hover {
          border-color: var(--accent-gold);
          color: var(--accent-gold);
        }
        .geatsu-filter-pill.is-active {
          background: linear-gradient(135deg, var(--accent-red), var(--accent-red-soft));
          color: #fff;
          border-color: var(--accent-red);
          box-shadow: 0 6px 18px rgba(215,38,56,0.3);
        }
      `}</style>
    </>
  );
}
