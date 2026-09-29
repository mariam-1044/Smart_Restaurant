import { describe, test, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import axios from '../../api/axios';
import { renderWithProviders } from '../../test/render';
import { mockUser } from '../../test/fixtures';
import Setting from '../../pages/Setting';

vi.mock('../../components/notifications/NotificationBell', () => ({
  default: () => null
}));

describe('Setting page', () => {
  test('renders profile form with name field pre-filled', () => {
    renderWithProviders(<Setting />, { authUser: mockUser });
    expect(screen.getByDisplayValue(mockUser.name)).toBeInTheDocument();
  });

  test('dark mode text is present', () => {
    renderWithProviders(<Setting />, { authUser: mockUser });
    expect(screen.getByText(/dark mode/i)).toBeInTheDocument();
  });

  test('password section has current, new, and confirm labels', () => {
    renderWithProviders(<Setting />, { authUser: mockUser });
    expect(screen.getByText('Current Password')).toBeInTheDocument();
    expect(screen.getByText('New Password')).toBeInTheDocument();
    expect(screen.getByText('Confirm New Password')).toBeInTheDocument();
  });

  test('profile-form submit calls PATCH /auth/update-profile with form data', async () => {
    vi.mocked(axios.patch).mockResolvedValueOnce({
      data: { success: true, data: { user: { ...mockUser, name: 'Updated', phone: '0100', avatar: '' } } }
    });
    vi.mocked(axios.get).mockImplementation((url) => {
      if (url === '/notifications/unread-count') return Promise.resolve({ data: { data: { count: 0 } } });
      return Promise.reject(new Error('unexpected'));
    });
    const { user } = renderWithProviders(<Setting />, { authUser: mockUser });
    const nameInput = screen.getByDisplayValue(mockUser.name);
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Name');
    const saveBtn = screen.getByRole('button', { name: /save changes/i });
    await user.click(saveBtn);
    await waitFor(() => {
      expect(axios.patch).toHaveBeenCalledWith('/auth/update-profile', expect.objectContaining({
        name: expect.any(String),
        phone: expect.any(String),
        avatar: expect.any(String)
      }));
    });
  });

  test('dark mode toggle sets theme on document and localStorage', async () => {
    const { user, container } = renderWithProviders(<Setting />, { authUser: mockUser });
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    const darkModeToggle = checkboxes[0];
    await user.click(darkModeToggle);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  test('password form submit calls PATCH /auth/update-password', async () => {
    vi.mocked(axios.patch).mockResolvedValueOnce({
      data: { success: true, data: { message: 'Password changed successfully' } }
    });
    vi.mocked(axios.get).mockImplementation((url) => {
      if (url === '/notifications/unread-count') return Promise.resolve({ data: { data: { count: 0 } } });
      return Promise.reject(new Error('unexpected'));
    });
    const { user, container } = renderWithProviders(<Setting />, { authUser: mockUser });
    const pwInputs = container.querySelectorAll('input[type="password"]');
    await user.type(pwInputs[0], 'oldpass123');
    await user.type(pwInputs[1], 'newpass123');
    await user.type(pwInputs[2], 'newpass123');
    const changeBtn = screen.getByRole('button', { name: /change password/i });
    await user.click(changeBtn);
    await waitFor(() => {
      expect(axios.patch).toHaveBeenCalledWith('/auth/update-password', {
        currentPassword: 'oldpass123',
        newPassword: 'newpass123'
      });
    });
  });
});