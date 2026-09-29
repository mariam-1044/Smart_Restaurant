import { describe, test, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import axios from '../../api/axios';
import { renderWithProviders } from '../../test/render';
import { mockUser } from '../../test/fixtures';
import Report from '../../pages/Report';

vi.mock('../../components/notifications/NotificationBell', () => ({
  default: () => null
}));

const reportData = {
  financials: { totalRevenue: 1000, totalOrders: 50, averageOrderValue: 20, totalPaid: 800, pendingOrders: 1 },
  inventoryAlerts: { lowStockCount: 0, expiredCount: 0, details: { lowStockItems: [], expiredItems: [] } },
  aiInsights: { forecast: [], topDishes: [] },
  menuPerformance: [], salesTrends: {}, waste: { summary: { monthTotalQuantity: 0, monthTotalValue: 0, reductionPctVsLastMonth: 0 }, byIngredient: [], byCategory: [], trend: [] },
  transactions: [
    { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', createdAt: '2026-05-10T10:00:00.000Z', customerName: 'Jane', itemsLabel: '2× Pizza', total: 40, status: 'completed', isPaid: true, source: 'POS', paymentMethod: 'Cash' },
    { _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', createdAt: '2026-05-10T11:00:00.000Z', customerName: 'Walk-in', itemsLabel: '1× Burger', total: 20, status: 'pending', isPaid: false, source: 'Online', paymentMethod: 'Cash' }
  ]
};

function mockGet(url) {
  if (url === '/dashboard/stats') return Promise.resolve({ data: { success: true, data: reportData } });
  if (url === '/notifications/unread-count') return Promise.resolve({ data: { data: { count: 0 } } });
  return Promise.reject(new Error('unexpected'));
}

describe('Report page', () => {
  test('renders the report content area', async () => {
    vi.mocked(axios.get).mockImplementation(mockGet);
    renderWithProviders(<Report />, { authUser: mockUser });
    expect(screen.getByRole('heading', { name: /sales reports/i })).toBeInTheDocument();
  });

  test('Export PDF button is present', async () => {
    vi.mocked(axios.get).mockImplementation(mockGet);
    renderWithProviders(<Report />, { authUser: mockUser });
    expect(screen.getByRole('button', { name: /export pdf/i })).toBeInTheDocument();
  });

  test('shows the Total Paid card and real transactions with a Confirm button for the pending order', async () => {
    vi.mocked(axios.get).mockImplementation(mockGet);
    renderWithProviders(<Report />, { authUser: mockUser });
    expect(await screen.findByText(/total paid by customers/i)).toBeInTheDocument();
    expect(await screen.findByText('2× Pizza')).toBeInTheDocument();
    expect(screen.getByText('1× Burger')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^confirm$/i })).toHaveLength(1);
  });
});
