import { describe, test, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '../../test/render';
import { mockUser, mockStaffUser } from '../../test/fixtures';
import ProtectedRoute from '../../routes/ProtectedRoute';

vi.mock('../../api/axios');

function Dashboard() { return <div>Dashboard</div>; }
function AdminPanel() { return <div>Admin Panel</div>; }
function Login() { return <div>Login Page</div>; }

describe('ProtectedRoute', () => {
  test('unauthenticated user is redirected to /', () => {
    renderWithProviders(
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      </Routes>,
      { authUser: null, initialRoute: '/dashboard', routes: null }
    );
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  test('staff role cannot access admin routes', () => {
    renderWithProviders(
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin/users" element={<ProtectedRoute roles={['admin']}><AdminPanel /></ProtectedRoute>} />
      </Routes>,
      { authUser: mockStaffUser, initialRoute: '/admin/users', routes: null }
    );
    expect(screen.queryByText('Admin Panel')).not.toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  test('admin role can access admin routes', () => {
    renderWithProviders(
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin/users" element={<ProtectedRoute roles={['admin']}><AdminPanel /></ProtectedRoute>} />
      </Routes>,
      { authUser: mockUser, initialRoute: '/admin/users', routes: null }
    );
    expect(screen.getByText('Admin Panel')).toBeInTheDocument();
  });
});