import React, { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(null);

const ToastContextStateExport = createContext({ toasts: [], remove: () => {} });

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((variant, message) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((prev) => [...prev, { id, variant, message }]);
  }, []);

  const value = {
    success: (msg) => push('success', msg),
    error: (msg) => push('error', msg),
  };

  return (
    <ToastContext.Provider value={value}>
      <ToastContextStateExport.Provider value={{ toasts, remove }}>
        {children}
      </ToastContextStateExport.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

export function useToastState() {
  return useContext(ToastContextStateExport);
}