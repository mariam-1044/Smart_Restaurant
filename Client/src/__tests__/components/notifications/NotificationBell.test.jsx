import { describe, test, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import axios from '../../../api/axios';
import { renderWithProviders } from '../../../test/render';
import { mockUser } from '../../../test/fixtures';
import NotificationBell from '../../../components/notifications/NotificationBell';

vi.mock('../../../api/axios');

const mockNotifications = [
  { _id: 'n1', type: 'low_stock', title: 'Low Stock', message: 'Tomato is below min stock', read: false, readAt: null, createdAt: '2026-05-04T10:00:00.000Z', relatedEntity: 'ing1', entityModel: 'Ingredient' },
  { _id: 'n2', type: 'expiry', title: 'Expiry Alert', message: 'Milk expires soon', read: false, readAt: null, createdAt: '2026-05-04T09:00:00.000Z', relatedEntity: 'ing2', entityModel: 'Ingredient' }
];

describe('NotificationBell', () => {
  test('renders bell icon', () => {
    vi.mocked(axios.get).mockImplementation((url) => {
      if (url === '/notifications/unread-count') return Promise.resolve({ data: { data: { count: 0 } } });
      return Promise.reject(new Error('unexpected'));
    });
    renderWithProviders(<NotificationBell />, { authUser: mockUser });
    expect(screen.getByRole('button', { name: /notification/i })).toBeInTheDocument();
  });

  test('badge shows unread count from API', async () => {
    vi.mocked(axios.get).mockImplementation((url) => {
      if (url === '/notifications/unread-count') return Promise.resolve({ data: { data: { count: 3 } } });
      return Promise.reject(new Error('unexpected'));
    });
    renderWithProviders(<NotificationBell />, { authUser: mockUser });
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  test('clicking bell renders dropdown with one row per notification', async () => {
    vi.mocked(axios.get).mockImplementation((url) => {
      if (url === '/notifications/unread-count') return Promise.resolve({ data: { data: { count: 2 } } });
      if (url === '/notifications') return Promise.resolve({ data: { data: { items: mockNotifications } } });
      return Promise.reject(new Error('unexpected'));
    });
    const { user } = renderWithProviders(<NotificationBell />, { authUser: mockUser });
    const bell = screen.getByRole('button', { name: /notification/i });
    await user.click(bell);
    expect(await screen.findByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('Low Stock')).toBeInTheDocument();
    expect(screen.getByText('Expiry Alert')).toBeInTheDocument();
  });

  test('clicking Mark all read calls PATCH /notifications/read-all and badge goes to 0', async () => {
    vi.mocked(axios.patch).mockResolvedValueOnce({ data: { data: {} } });
    vi.mocked(axios.get).mockImplementation((url) => {
      if (url === '/notifications/unread-count') return Promise.resolve({ data: { data: { count: 2 } } });
      if (url === '/notifications') return Promise.resolve({ data: { data: { items: mockNotifications } } });
      return Promise.reject(new Error('unexpected'));
    });
    const { user } = renderWithProviders(<NotificationBell />, { authUser: mockUser });
    const bell = screen.getByRole('button', { name: /notification/i });
    await user.click(bell);
    const markAllBtn = await screen.findByRole('button', { name: /mark all read/i });
    await user.click(markAllBtn);
    await waitFor(() => {
      expect(axios.patch).toHaveBeenCalledWith('/notifications/read-all');
    });
    expect(screen.queryByText('2')).not.toBeInTheDocument();
  });
});