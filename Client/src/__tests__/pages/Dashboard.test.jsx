import { describe, test, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import axios from '../../api/axios';
import { renderWithProviders } from '../../test/render';
import { mockUser } from '../../test/fixtures';
import Dashboard from '../../pages/Dashboard';

vi.mock('../../components/notifications/NotificationBell', () => ({
  default: () => null
}));

function mockGet(url) {
  if (url === '/dashboard/stats') return Promise.resolve({
    data: { success: true, data: { financials: { totalRevenue: 1000, totalOrders: 50, avgOrderValue: 20 }, inventoryAlerts: { lowStockCount: 2, expiredCount: 0, details: { lowStockItems: ['Tomato'], expiredItems: [] } }, aiInsights: { forecast: [], topDishes: [], associationRules: [] }, menuPerformance: [], salesTrends: {}, waste: { summary: { monthTotalQuantity: 5, monthTotalValue: 10, reductionPctVsLastMonth: 0 }, byIngredient: [], byCategory: [], trend: [] } } }
  });
  if (url === '/notifications/unread-count') return Promise.resolve({ data: { data: { count: 0 } } });
  return Promise.reject(new Error('unexpected'));
}

describe('Dashboard page', () => {
  test('renders dashboard with stats cards', async () => {
    vi.mocked(axios.get).mockImplementation(mockGet);
    renderWithProviders(<Dashboard />, { authUser: mockUser });
    expect(await screen.findByText(/dashboard/i)).toBeInTheDocument();
  });

  test('shows error state when API rejects', async () => {
    vi.mocked(axios.get).mockImplementation((url) => {
      if (url === '/notifications/unread-count') return Promise.resolve({ data: { data: { count: 0 } } });
      return Promise.reject(new Error('Network error'));
    });
    renderWithProviders(<Dashboard />, { authUser: mockUser });
    expect(await screen.findByText(/error|failed/i)).toBeInTheDocument();
  });
});