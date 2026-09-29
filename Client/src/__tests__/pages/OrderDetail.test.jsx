import { describe, test, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import axios from '../../api/axios';
import { renderWithProviders } from '../../test/render';
import { mockUser, mockOrder } from '../../test/fixtures';
import OrderDetail from '../../pages/OrderDetail';

vi.mock('../../components/notifications/NotificationBell', () => ({
  default: () => null
}));

describe('OrderDetail page', () => {
  test('renders order detail', async () => {
    vi.mocked(axios.get).mockImplementation((url) => {
      if (url.startsWith('/orders/')) return Promise.resolve({ data: { success: true, data: mockOrder } });
      if (url === '/notifications/unread-count') return Promise.resolve({ data: { data: { count: 0 } } });
      return Promise.reject(new Error('unexpected'));
    });
    renderWithProviders(<OrderDetail />, { authUser: mockUser, initialRoute: '/orders/1' });
    expect(await screen.findByText(/Order #/i)).toBeInTheDocument();
  });
});