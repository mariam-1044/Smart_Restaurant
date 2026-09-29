import React, { createContext, useContext, useState, useCallback } from 'react';

const ThemeContext = createContext(null);

function readInitialTheme() {
  if (typeof document !== 'undefined') {
    return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  }
  return 'light';
}

export function ThemeProvider({ children, initialTheme }) {
  const [theme, setTheme] = useState(() => {
    if (initialTheme) return initialTheme;
    return readInitialTheme();
  });

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      if (next === 'dark') {
        document.documentElement.dataset.theme = 'dark';
      } else {
        delete document.documentElement.dataset.theme;
      }
      try {
        localStorage.setItem('theme', next);
      } catch (e) {}
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}