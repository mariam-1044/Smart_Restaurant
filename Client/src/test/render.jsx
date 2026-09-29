import React from 'react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { ToastProvider } from '../components/toast/ToastContext';

export function renderWithProviders(ui, {
  authUser = null,
  theme = 'light',
  initialRoute = '/',
  routes,
  ...renderOptions
} = {}) {
  function Wrapper({ children }) {
    return (
      <MemoryRouter initialEntries={[initialRoute]}>
        <AuthProvider initialUser={authUser}>
          <ThemeProvider initialTheme={theme}>
            <ToastProvider>
              {routes
                ? <Routes>{routes}<Route path="*" element={children} /></Routes>
                : children}
            </ToastProvider>
          </ThemeProvider>
        </AuthProvider>
      </MemoryRouter>
    );
  }
  const user = userEvent.setup();
  return { user, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}