import { describe, test, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import axios from '../../api/axios';
import { renderWithProviders } from '../../test/render';
import { mockUser } from '../../test/fixtures';
import Sales from '../../pages/Sales';

vi.mock('../../components/Chart', () => ({
  default: () => <div data-testid="chart">Chart</div>
}));
vi.mock('../../components/notifications/NotificationBell', () => ({
  default: () => null
}));

describe('Sales page', () => {
  function mockGet(url) {
    if (url.startsWith('/sales/report')) return Promise.resolve({
      data: { success: true, data: { period: 'weekly', totalRevenue: 500, totalOrders: 25, averageOrderValue: 20, popularDishes: [], topDishes: [], salesTrends: {}, menuPerformance: [] } }
    });
    if (url === '/notifications/unread-count') return Promise.resolve({ data: { data: { count: 0 } } });
    return Promise.reject(new Error('unexpected'));
  }

  test('renders sales overview with period toggle', async () => {
    vi.mocked(axios.get).mockImplementation(mockGet);
    renderWithProviders(<Sales />, { authUser: mockUser });
    expect(await screen.findByText('Sales Overview')).toBeInTheDocument();
  });
});