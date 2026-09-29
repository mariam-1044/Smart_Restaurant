import { describe, test, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import axios from '../../../api/axios';
import { renderWithProviders } from '../../../test/render';
import Register from '../../../pages/auth/Register';

describe('Register page', () => {
  test('renders registration form fields', () => {
    renderWithProviders(<Register />);
    expect(screen.getByPlaceholderText(/full name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/password \(min/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  test('shows error on failed registration', async () => {
    vi.mocked(axios.post).mockRejectedValueOnce({
      response: { status: 400, data: { message: 'Email already exists' } }
    });
    const { user } = renderWithProviders(<Register />);
    await user.type(screen.getByPlaceholderText(/full name/i), 'Test');
    await user.type(screen.getByPlaceholderText(/^email$/i), 'taken@test.co');
    await user.type(screen.getByPlaceholderText(/password \(min/i), 'Pass!23456');
    await user.type(screen.getByPlaceholderText(/confirm password/i), 'Pass!23456');
    await user.click(screen.getByRole('button', { name: /register/i }));
    expect(await screen.findByText(/email already exists/i)).toBeInTheDocument();
  });

  test('successful registration calls axios.post with form values', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: { success: true, data: { message: 'Registration successful' } }
    });
    const { user } = renderWithProviders(<Register />);
    await user.type(screen.getByPlaceholderText(/full name/i), 'New User');
    await user.type(screen.getByPlaceholderText(/^email$/i), 'new@test.co');
    await user.type(screen.getByPlaceholderText(/password \(min/i), 'Password1');
    await user.type(screen.getByPlaceholderText(/confirm password/i), 'Password1');
    await user.click(screen.getByRole('button', { name: /register/i }));
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith('/auth/register', {
        name: 'New User',
        email: 'new@test.co',
        password: 'Password1',
        role: 'customer'
      });
    });
  });

  test('a new customer is auto-logged-in after registering (calls /auth/login)', async () => {
    vi.mocked(axios.post)
      .mockResolvedValueOnce({ data: { success: true, message: 'ok' } }) // /auth/register
      .mockResolvedValueOnce({ data: { success: true, data: { user: { _id: 'u1', name: 'New User', email: 'new@test.co', role: 'customer' }, token: 'tok' } } }); // /auth/login
    const { user } = renderWithProviders(<Register />);
    await user.type(screen.getByPlaceholderText(/full name/i), 'New User');
    await user.type(screen.getByPlaceholderText(/^email$/i), 'new@test.co');
    await user.type(screen.getByPlaceholderText(/password \(min/i), 'Password1');
    await user.type(screen.getByPlaceholderText(/confirm password/i), 'Password1');
    await user.click(screen.getByRole('button', { name: /register/i }));
    await waitFor(() => {
      expect(axios.post).toHaveBeenNthCalledWith(2, '/auth/login', { email: 'new@test.co', password: 'Password1' });
    });
  });
});