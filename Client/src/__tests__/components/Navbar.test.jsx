import { describe, test, expect, vi } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import { renderWithProviders } from '../../test/render';
import { mockUser, mockStaffUser } from '../../test/fixtures';
import Navbar from '../../components/Navbar';

vi.mock('../../api/axios');

describe('Navbar', () => {
  test('renders user name from auth context', () => {
    renderWithProviders(<Navbar />, { authUser: mockUser });
    expect(screen.getAllByText(mockUser.name).length).toBeGreaterThanOrEqual(1);
  });

  test('updates when auth context changes with a different user', () => {
    renderWithProviders(<Navbar />, { authUser: mockUser });
    expect(screen.getAllByText(mockUser.name).length).toBeGreaterThanOrEqual(1);
    cleanup();
    renderWithProviders(<Navbar />, { authUser: mockStaffUser });
    expect(screen.getAllByText(mockStaffUser.name).length).toBeGreaterThanOrEqual(1);
  });
});