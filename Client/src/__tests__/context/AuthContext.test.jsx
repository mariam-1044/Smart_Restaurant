import { describe, test, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { render, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../context/AuthContext';

vi.mock('../../api/axios', () => ({
  default: {
    get: vi.fn(() => Promise.reject(new Error('axios.get unmocked'))),
    post: vi.fn(() => Promise.reject(new Error('axios.post unmocked'))),
    patch: vi.fn(() => Promise.reject(new Error('axios.patch unmocked'))),
    put: vi.fn(() => Promise.reject(new Error('axios.put unmocked'))),
    delete: vi.fn(() => Promise.reject(new Error('axios.delete unmocked')))
  }
}));

function Consumer() {
  const { user, isAuthenticated } = useAuth();
  return <div data-testid="user">{user ? user.name : 'null'}</div>;
}

describe('AuthContext', () => {
  test('default user is null when no initialUser', () => {
    render(<AuthProvider><Consumer /></AuthProvider>);
    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  test('initialUser sets user in context', () => {
    render(<AuthProvider initialUser={{ _id: '1', name: 'Admin', email: 'a@t.co', role: 'admin' }}><Consumer /></AuthProvider>);
    expect(screen.getByTestId('user').textContent).toBe('Admin');
  });
});