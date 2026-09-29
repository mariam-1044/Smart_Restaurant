import { useEffect, useRef } from "react";
import Button from "./Button";

export default function ConfirmationModal({
  isOpen,
  title,
  body,
  confirmLabel = "Confirm",
  confirmVariant = "primary",
  onConfirm,
  onCancel,
}) {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      confirmRef.current?.focus();
      const handleEsc = (e) => {
        if (e.key === "Escape") onCancel();
      };
      document.addEventListener("keydown", handleEsc);
      return () => document.removeEventListener("keydown", handleEsc);
    }
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <>
      <div className="confirm-overlay" onClick={onCancel}>
        <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
          <h3 className="confirm-title">{title}</h3>
          <div className="confirm-body">{body}</div>
          <div className="confirm-footer">
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <button ref={confirmRef} style={{ display: "none" }} aria-hidden />
            <Button
              variant={confirmVariant === "danger" ? "danger" : "primary"}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
      <style>{`
        .confirm-overlay {
          position: fixed; inset: 0; z-index: 100;
          background: rgba(7,7,9,0.65);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
        }
        .confirm-modal {
          background: var(--bg-secondary);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-elev);
          padding: 24px;
          width: 460px; max-width: 100%;
          animation: confirmIn 220ms var(--ease-out-expo) both;
        }
        @keyframes confirmIn {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .confirm-title {
          font-family: var(--font-heading);
          font-size: 18px; font-weight: 700;
          margin: 0 0 12px 0;
          letter-spacing: -0.01em;
          color: var(--text-primary);
        }
        .confirm-body {
          font-size: 14px;
          color: var(--text-secondary);
          line-height: 1.55;
          margin-bottom: 18px;
        }
        .confirm-body p { margin: 0 0 8px 0; }
        .confirm-body p:last-child { margin-bottom: 0; }
        .confirm-footer {
          display: flex; justify-content: flex-end; gap: 10px;
          padding-top: 14px;
          border-top: 1px solid var(--border-color);
        }
      `}</style>
    </>
  );
}
