import { describe, test, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../test/render';
import { ToastProvider, useToast } from '../../../components/toast/ToastContext';
import ToastContainer from '../../../components/toast/ToastContainer';
import userEvent from '@testing-library/user-event';

vi.mock('../../../api/axios');

function TestConsumer() {
  const { success, error } = useToast();
  return (
    <div>
      <button onClick={() => success('hello')}>Success Toast</button>
      <button onClick={() => error('oh no')}>Error Toast</button>
    </div>
  );
}

describe('ToastContext', () => {
  test('calling useToast().success renders a toast with role alert', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <TestConsumer />
        <ToastContainer />
      </>,
      { authUser: null }
    );
    await user.click(screen.getByRole('button', { name: /success toast/i }));
    const alert = await screen.findByRole('alert', {}, { timeout: 3000 });
    expect(alert).toBeInTheDocument();
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  test('calling useToast().error renders an error toast', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <TestConsumer />
        <ToastContainer />
      </>,
      { authUser: null }
    );
    await user.click(screen.getByRole('button', { name: /error toast/i }));
    const alert = await screen.findByRole('alert', {}, { timeout: 3000 });
    expect(alert).toBeInTheDocument();
  });
});