import { useEffect } from "react";

export default function DetailDrawer({ isOpen, onClose, title, children }) {
  useEffect(() => {
    if (isOpen) {
      const handleEsc = (e) => {
        if (e.key === "Escape") onClose();
      };
      document.addEventListener("keydown", handleEsc);
      return () => document.removeEventListener("keydown", handleEsc);
    }
  }, [isOpen, onClose]);

  return (
    <>
      {isOpen && <div className="drawer-overlay" onClick={onClose} />}
      <div className={`geatsu-drawer ${isOpen ? "is-open" : ""}`}>
        <div className="drawer-head">
          <h3 className="drawer-title">{title}</h3>
          <button onClick={onClose} className="drawer-close" aria-label="Close drawer">
            ×
          </button>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
      <style>{`
        .drawer-overlay {
          position: fixed; inset: 0; z-index: 90;
          background: rgba(7,7,9,0.55);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          animation: drawerFade 200ms var(--ease-out-expo) both;
        }
        @keyframes drawerFade { from { opacity: 0; } to { opacity: 1; } }
        .geatsu-drawer {
          position: fixed; top: 0; right: 0;
          z-index: 100;
          height: 100%;
          width: 32rem; max-width: 100vw;
          background: var(--bg-secondary);
          border-left: 1px solid var(--border-color);
          box-shadow: var(--shadow-elev);
          transform: translateX(100%);
          transition: transform 320ms var(--ease-out-expo);
          display: flex; flex-direction: column;
        }
        .geatsu-drawer.is-open { transform: translateX(0); }
        .drawer-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid var(--border-color);
          background: linear-gradient(135deg, rgba(31,122,63,0.06), rgba(155,226,45,0.04));
        }
        .drawer-title {
          font-family: var(--font-heading);
          font-size: 18px; font-weight: 700;
          margin: 0; letter-spacing: -0.01em;
          color: var(--text-primary);
        }
        .drawer-close {
          background: transparent;
          border: 1px solid var(--border-color);
          color: var(--text-muted);
          border-radius: 10px;
          width: 32px; height: 32px;
          font-size: 20px; cursor: pointer;
          line-height: 1;
          transition: all 200ms var(--ease-out-expo);
        }
        .drawer-close:hover {
          color: var(--accent-red);
          border-color: var(--accent-red);
          background: rgba(215,38,56,0.08);
        }
        .drawer-body {
          flex: 1;
          overflow-y: auto;
        }
      `}</style>
    </>
  );
}
