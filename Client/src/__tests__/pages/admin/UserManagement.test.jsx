import { describe, test, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from '../../../api/axios';
import { renderWithProviders } from '../../../test/render';
import { mockUser, mockStaffUser, mockPendingUser } from '../../../test/fixtures';
import UserManagement from '../../../pages/admin/UserManagement';

vi.mock('../../../components/notifications/NotificationBell', () => ({
  default: () => null
}));

describe('UserManagement page', () => {
  const mockUsers = [
    { _id: 'u1', name: 'Admin User', email: 'admin@test.local', role: 'admin', status: 'approved', version: 1 },
    { _id: 'u2', name: 'Staff User', email: 'staff@test.local', role: 'staff', status: 'approved', version: 1 },
    { _id: 'u3', name: 'Pending User', email: 'pending@test.local', role: 'staff', status: 'pending', version: 1 }
  ];

  function mockGet(url) {
    if (url === '/auth/users') return Promise.resolve({ data: { success: true, data: mockUsers } });
    if (url === '/notifications/unread-count') return Promise.resolve({ data: { data: { count: 0 } } });
    return Promise.reject(new Error('unexpected'));
  }

  test('renders user list from mocked /auth/users', async () => {
    vi.mocked(axios.get).mockImplementation(mockGet);
    renderWithProviders(<UserManagement />, { authUser: mockUser });

    const adminElements = await screen.findAllByText('Admin User');
    expect(adminElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('staff@test.local')).toBeInTheDocument();
    expect(screen.getByText('Pending User')).toBeInTheDocument();
  });

  test('status badges are rendered for each user', async () => {
    vi.mocked(axios.get).mockImplementation(mockGet);
    renderWithProviders(<UserManagement />, { authUser: mockUser });

    expect(await screen.findByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  test('role dropdown change calls PATCH endpoint', async () => {
    const user = userEvent.setup();
    vi.mocked(axios.get).mockImplementation(mockGet);
    vi.mocked(axios.patch).mockResolvedValueOnce({ data: { success: true } });
    vi.mocked(axios.get).mockImplementation(mockGet);

    renderWithProviders(<UserManagement />, { authUser: mockUser });

    const dropdowns = await screen.findAllByRole('combobox');
    await user.selectOptions(dropdowns[0], 'staff');

    expect(axios.patch).toHaveBeenCalledWith(
      '/auth/users/u1',
      expect.objectContaining({ role: 'staff' })
    );
  });

  test('shows error state when API rejects', async () => {
    vi.mocked(axios.get).mockImplementation((url) => {
      if (url === '/notifications/unread-count') return Promise.resolve({ data: { data: { count: 0 } } });
      return Promise.reject(new Error('Network error'));
    });
    renderWithProviders(<UserManagement />, { authUser: mockUser });

    expect(await screen.findByText(/failed to load users/i)).toBeInTheDocument();
  });
});