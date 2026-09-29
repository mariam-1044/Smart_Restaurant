export default function RoleDropdown({ value, onChange, disabled }) {
  return (
    <>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="role-dropdown"
      >
        <option value="admin">Admin</option>
        <option value="staff">Staff</option>
        <option value="customer">Customer</option>
      </select>
      <style>{`
        .role-dropdown {
          padding: 6px 28px 6px 12px;
          border-radius: 999px;
          background: var(--bg-elevated);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
          font-family: var(--font-heading);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.04em;
          cursor: pointer;
          outline: none;
          appearance: none;
          background-image: linear-gradient(45deg, transparent 50%, var(--text-muted) 50%),
                            linear-gradient(135deg, var(--text-muted) 50%, transparent 50%);
          background-position: calc(100% - 14px) 50%, calc(100% - 9px) 50%;
          background-size: 5px 5px, 5px 5px;
          background-repeat: no-repeat;
          transition: all 200ms var(--ease-out-expo);
        }
        .role-dropdown:hover:not(:disabled) {
          border-color: var(--accent-gold);
          color: var(--accent-gold);
        }
        .role-dropdown:focus {
          border-color: var(--accent-gold);
          box-shadow: 0 0 0 3px rgba(155,226,45,0.18);
        }
        .role-dropdown:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </>
  );
}
