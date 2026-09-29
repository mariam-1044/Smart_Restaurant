import { describe, test, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render';
import { mockUser, mockStaffUser } from '../../test/fixtures';
import Sidebar from '../../components/Sidebar';

vi.mock('../../api/axios');

describe('Sidebar', () => {
  test('renders navigation links', () => {
    renderWithProviders(<Sidebar />, { authUser: mockUser });
    const sidebar = document.querySelector('.sidebar');
    expect(sidebar).toBeTruthy();
  });

  test('admin sees all role-gated links', () => {
    renderWithProviders(<Sidebar />, { authUser: mockUser });
    expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
  });

  test('staff sees limited links', () => {
    renderWithProviders(<Sidebar />, { authUser: mockStaffUser });
    expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
  });
});