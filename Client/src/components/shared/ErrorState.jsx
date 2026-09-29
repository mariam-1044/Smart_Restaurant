import { FaExclamationTriangle } from "react-icons/fa";
import Button from "./Button";

export default function ErrorState({ title, message, onRetry }) {
  return (
    <>
      <div className="geatsu-errstate">
        <span className="geatsu-errstate-icon"><FaExclamationTriangle /></span>
        <h3 className="geatsu-errstate-title">{title || "Something went wrong."}</h3>
        {message && <p className="geatsu-errstate-msg">{message}</p>}
        {onRetry && (
          <Button variant="danger" size="sm" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
      <style>{`
        .geatsu-errstate {
          display: flex; flex-direction: column; align-items: center;
          padding: 28px;
          text-align: center;
          background: var(--status-danger-bg);
          color: var(--status-danger-fg);
          border: 1px solid rgba(215, 38, 56, 0.32);
          border-radius: var(--radius-lg);
        }
        .geatsu-errstate-icon {
          width: 46px; height: 46px;
          display: inline-flex; align-items: center; justify-content: center;
          border-radius: 50%;
          font-size: 18px;
          color: var(--accent-red, #D72638);
          background: rgba(215, 38, 56, 0.16);
          margin-bottom: 12px;
        }
        .geatsu-errstate-title {
          margin: 0 0 6px 0;
          font-family: var(--font-heading);
          font-size: 16px; font-weight: 700;
        }
        .geatsu-errstate-msg { margin: 0 0 14px 0; font-size: 13px; opacity: 0.88; }
      `}</style>
    </>
  );
}
