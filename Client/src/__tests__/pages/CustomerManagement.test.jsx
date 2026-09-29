import { describe, test, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import axios from '../../api/axios';
import { renderWithProviders } from '../../test/render';
import { mockUser } from '../../test/fixtures';
import CustomerManagement from '../../pages/CustomerManagement';

vi.mock('../../api/aiCall', () => ({
  aiCall: vi.fn(() => Promise.resolve({ ok: true, data: { recommendations: [] } }))
}));
vi.mock('../../components/notifications/NotificationBell', () => ({
  default: () => null
}));

describe('CustomerManagement page', () => {
  const mockCustomers = [
    {
      _id: 'c1',
      name: 'Alice',
      phone: '0100000001',
      totalOrders: 5,
      totalSpend: 120.5,
      lastOrderAt: '2026-04-20T10:00:00.000Z',
      favoritesCount: 2,
      tags: ['Regular']
    },
    {
      _id: 'c2',
      name: 'Bob',
      phone: '0100000002',
      totalOrders: 10,
      totalSpend: 250.0,
      lastOrderAt: '2026-04-25T12:00:00.000Z',
      favoritesCount: 3,
      tags: ['High Value']
    }
  ];

  test('renders customer table when API succeeds', async () => {
    vi.mocked(axios.get).mockImplementation((url) => {
      if (url === '/customers') return Promise.resolve({ data: { success: true, data: mockCustomers } });
      if (url === '/notifications/unread-count') return Promise.resolve({ data: { data: { count: 0 } } });
      return Promise.reject(new Error('unexpected'));
    });
    renderWithProviders(<CustomerManagement />, { authUser: mockUser });

    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('0100000001')).toBeInTheDocument();
  });

  test('shows error state when API rejects', async () => {
    vi.mocked(axios.get).mockImplementation((url) => {
      if (url === '/notifications/unread-count') return Promise.resolve({ data: { data: { count: 0 } } });
      return Promise.reject(new Error('Network error'));
    });
    renderWithProviders(<CustomerManagement />, { authUser: mockUser });

    expect(await screen.findByText(/failed to load customers/i)).toBeInTheDocument();
  });

  test('opening customer detail shows detail drawer', async () => {
    vi.mocked(axios.get).mockImplementation((url) => {
      if (url === '/customers') return Promise.resolve({ data: { success: true, data: mockCustomers } });
      if (url === '/customers/c1') return Promise.resolve({ data: { data: { ...mockCustomers[0], orderHistory: [], favorites: [] } } });
      if (url === '/notifications/unread-count') return Promise.resolve({ data: { data: { count: 0 } } });
      return Promise.reject(new Error('unexpected'));
    });
    const { user } = renderWithProviders(<CustomerManagement />, { authUser: mockUser });
    expect(await screen.findByText('Alice')).toBeInTheDocument();
    const row = screen.getByText('Alice').closest('tr');
    await user.click(row);
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith('/customers/c1');
    });
  });

  test('removing a favorite calls the unlink endpoint (does not delete the dish or customer)', async () => {
    const detailWithFavs = {
      ...mockCustomers[0],
      orderHistory: [],
      favorites: [
        { dishId: 'd1', dishName: 'Pizza', orderCount: 3 },
        { dishId: 'd2', dishName: 'Burger', orderCount: 1 },
      ],
    };
    vi.mocked(axios.get).mockImplementation((url) => {
      if (url === '/customers') return Promise.resolve({ data: { success: true, data: mockCustomers } });
      if (url === '/customers/c1') return Promise.resolve({ data: { data: detailWithFavs } });
      if (url === '/notifications/unread-count') return Promise.resolve({ data: { data: { count: 0 } } });
      return Promise.reject(new Error('unexpected'));
    });
    vi.mocked(axios.delete).mockResolvedValue({ data: { success: true, data: { _id: 'c1', favoritesCount: 1, favorites: [] } } });

    const { user } = renderWithProviders(<CustomerManagement />, { authUser: mockUser });
    expect(await screen.findByText('Alice')).toBeInTheDocument();
    await user.click(screen.getByText('Alice').closest('tr'));
    expect(await screen.findByText('Pizza')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /remove pizza from favorites/i }));
    await waitFor(() => {
      expect(axios.delete).toHaveBeenCalledWith('/customers/c1/favorites/d1');
    });
  });
});