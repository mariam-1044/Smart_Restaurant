import { describe, test, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import axios from '../../api/axios';
import { renderWithProviders } from '../../test/render';
import { mockUser, mockIngredient } from '../../test/fixtures';
import InventoryDetail from '../../pages/InventoryDetail';

vi.mock('../../components/notifications/NotificationBell', () => ({
  default: () => null
}));

describe('InventoryDetail page', () => {
  test('renders ingredient detail', async () => {
    vi.mocked(axios.get).mockImplementation((url) => {
      if (url.startsWith('/inventory/')) return Promise.resolve({ data: { success: true, data: mockIngredient } });
      if (url === '/notifications/unread-count') return Promise.resolve({ data: { data: { count: 0 } } });
      return Promise.reject(new Error('unexpected'));
    });
    renderWithProviders(<InventoryDetail />, { authUser: mockUser, initialRoute: '/inventory/1' });
    expect(await screen.findByText(/tomato/i)).toBeInTheDocument();
  });
});