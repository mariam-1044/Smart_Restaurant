import React from 'react';
import Toast from './Toast';
import { useToastState } from './ToastContext';

export default function ToastContainer() {
  const { toasts, remove } = useToastState();
  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <div key={t.id} style={{ pointerEvents: 'auto' }}>
          <Toast
            id={t.id}
            variant={t.variant}
            message={t.message}
            onDismiss={() => remove(t.id)}
          />
        </div>
      ))}
    </div>
  );
}