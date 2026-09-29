import { describe, test, expect, vi } from 'vitest';
import { screen, act } from '@testing-library/react';
import { render } from '@testing-library/react';
import Toast from '../../../components/toast/Toast';

describe('Toast', () => {
  test('success variant renders with green background', () => {
    const onDismiss = vi.fn();
    render(<Toast id="t1" variant="success" message="Saved!" onDismiss={onDismiss} />);
    expect(screen.getByText('Saved!')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    const toast = screen.getByRole('alert');
    const bgColor = toast.style.background || toast.style.backgroundColor;
    expect(bgColor).toMatch(/#16a34a|rgb\(22,?\s*163,?\s*74\)/i);
  });

  test('error variant renders with red background', () => {
    const onDismiss = vi.fn();
    render(<Toast id="t2" variant="error" message="Failed!" onDismiss={onDismiss} />);
    expect(screen.getByText('Failed!')).toBeInTheDocument();
    const toast = screen.getByRole('alert');
    const bgColor = toast.style.background || toast.style.backgroundColor;
    expect(bgColor).toMatch(/#dc2626|rgb\(220,?\s*38,?\s*38\)/i);
  });

  test('auto-dismisses after duration', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<Toast id="t3" variant="success" message="Hi" onDismiss={onDismiss} duration={4000} />);
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(4000); });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});