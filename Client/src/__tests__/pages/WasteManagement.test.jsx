import { describe, test, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import axios from '../../api/axios';
import { renderWithProviders } from '../../test/render';
import { mockUser } from '../../test/fixtures';
import WasteManagement from '../../pages/WasteManagement';

vi.mock('../../api/aiCall', () => ({
  aiCall: vi.fn(() => Promise.resolve({ ok: true, data: {} }))
}));
vi.mock('../../components/waste/WasteByIngredientChart', () => ({
  default: () => <div data-testid="ingredient-chart">Chart</div>
}));
vi.mock('../../components/waste/WasteTrendChart', () => ({
  default: () => <div data-testid="trend-chart">Trend</div>
}));
vi.mock('../../components/waste/WasteByCategoryChart', () => ({
  default: () => <div data-testid="category-chart">Category</div>
}));
vi.mock('../../components/notifications/NotificationBell', () => ({
  default: () => null
}));

describe('WasteManagement page', () => {
  const dashboardData = {
    waste: {
      summary: {
        monthTotalQuantity: 12.5,
        monthTotalValue: 45.0,
        reductionPctVsLastMonth: 5
      },
      byIngredient: [{ ingredientName: 'Tomato', quantity: 5 }],
      byCategory: [{ category: 'Produce', quantity: 8 }],
      trend: [{ date: '2026-05-01', quantity: 3 }]
    }
  };

  const nearExpiryItems = [
    { _id: 'ne1', name: 'Lettuce', quantity: 5, unit: 'kg', expiryDate: '2026-05-06T00:00:00.000Z', daysUntilExpiry: 2 }
  ];

  function mockGet(url) {
    if (url === '/dashboard/admin') return Promise.resolve({ data: { success: true, data: dashboardData } });
    if (url === '/inventory/near-expiry') return Promise.resolve({ data: { success: true, data: nearExpiryItems } });
    if (url === '/notifications/unread-count') return Promise.resolve({ data: { data: { count: 0 } } });
    return Promise.reject(new Error('unexpected'));
  }

  test('renders waste analytics with data from mocked APIs', async () => {
    vi.mocked(axios.get).mockImplementation(mockGet);

    renderWithProviders(<WasteManagement />, { authUser: mockUser });

    expect(await screen.findByText('Waste Management')).toBeInTheDocument();
    expect(screen.getByText('12.5 units')).toBeInTheDocument();
    expect(screen.getByText('$45.00')).toBeInTheDocument();
  });

  test('"Use in Recipe" button exists in near-expiry table', async () => {
    vi.mocked(axios.get).mockImplementation(mockGet);

    renderWithProviders(<WasteManagement />, { authUser: mockUser });

    expect(await screen.findByText('Use in Recipe')).toBeInTheDocument();
    expect(screen.getByText('Lettuce')).toBeInTheDocument();
  });

  test('shows error state when dashboard API rejects', async () => {
    vi.mocked(axios.get).mockImplementation((url) => {
      if (url === '/dashboard/admin') return Promise.reject(new Error('Network error'));
      if (url === '/inventory/near-expiry') return Promise.resolve({ data: { success: true, data: [] } });
      if (url === '/notifications/unread-count') return Promise.resolve({ data: { data: { count: 0 } } });
      return Promise.reject(new Error('unexpected'));
    });

    renderWithProviders(<WasteManagement />, { authUser: mockUser });

    expect(await screen.findByText(/failed to load dashboard/i)).toBeInTheDocument();
  });
});