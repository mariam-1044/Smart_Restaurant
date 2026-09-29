import { describe, test, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { render, fireEvent } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../../context/ThemeContext';

function ThemeConsumer() {
  const { theme, toggleTheme } = useTheme();
  return <div data-testid="theme">{theme}<button onClick={toggleTheme}>Toggle</button></div>;
}

describe('ThemeContext', () => {
  test('default theme is light', () => {
    render(<ThemeProvider><ThemeConsumer /></ThemeProvider>);
    expect(screen.getByTestId('theme').textContent).toContain('light');
  });

  test('toggleTheme flips document.documentElement.dataset.theme', () => {
    render(<ThemeProvider><ThemeConsumer /></ThemeProvider>);
    const btn = screen.getByRole('button', { name: /toggle/i });
    fireEvent.click(btn);
    expect(document.documentElement.dataset.theme).toBe('dark');
    fireEvent.click(btn);
    // After toggling back, data-theme should be removed (undefined)
    expect(document.documentElement.dataset.theme).toBeFalsy();
  });

  test('initialTheme dark is applied on first paint', () => {
    render(<ThemeProvider initialTheme="dark"><ThemeConsumer /></ThemeProvider>);
    expect(screen.getByTestId('theme').textContent).toContain('dark');
  });
});