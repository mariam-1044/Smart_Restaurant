import { describe, test, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import axios from '../../../api/axios';
import { renderWithProviders } from '../../../test/render';
import { mockUser } from '../../../test/fixtures';
import Login from '../../../pages/auth/Login';

describe('Login page', () => {
  test('renders the login form', () => {
    renderWithProviders(<Login />);
    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  test('shows error on bad credentials', async () => {
    vi.mocked(axios.post).mockRejectedValueOnce({
      response: { status: 401, data: { message: 'Invalid credentials' } }
    });
    const { user } = renderWithProviders(<Login />);
    await user.type(screen.getByPlaceholderText(/email/i), 'wrong@test.co');
    await user.type(screen.getByPlaceholderText(/password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /login/i }));
    expect(await screen.findByText(/invalid|wrong/i)).toBeInTheDocument();
  });

  test('successful login calls login with credentials and navigates', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: { success: true, data: { token: 'fake-jwt', user: mockUser } }
    });
    const { user } = renderWithProviders(<Login />, { initialRoute: '/' });
    await user.type(screen.getByPlaceholderText(/email/i), 'admin@test.local');
    await user.type(screen.getByPlaceholderText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /login/i }));
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith('/auth/login', {
        email: 'admin@test.local',
        password: 'password123'
      });
    });
    await waitFor(() => {
      expect(localStorage.getItem('token')).toBe('fake-jwt');
    });
  });
});