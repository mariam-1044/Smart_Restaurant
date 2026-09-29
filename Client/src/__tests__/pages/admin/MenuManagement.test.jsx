import { describe, test, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import axios from '../../../api/axios';
import { renderWithProviders } from '../../../test/render';
import { mockUser } from '../../../test/fixtures';
import MenuManagement from '../../../pages/admin/MenuManagement';

vi.mock('../../../components/notifications/NotificationBell', () => ({
  default: () => null
}));

describe('MenuManagement page', () => {
  const mockDishes = [
    {
      _id: 'd1',
      name: 'Margherita Pizza',
      category: 'Pizza',
      price: 12.99,
      isAvailable: true,
      ingredients: [{ ingredient: 'ing1', quantity: 0.3 }],
      version: 1
    },
    {
      _id: 'd2',
      name: 'Caesar Salad',
      category: 'Salad',
      price: 8.5,
      isAvailable: false,
      ingredients: [],
      version: 1
    }
  ];

  const mockIngredients = [
    { _id: 'ing1', name: 'Tomato', unit: 'kg' },
    { _id: 'ing2', name: 'Lettuce', unit: 'kg' }
  ];

  function mockGet(url) {
    if (url === '/menu') return Promise.resolve({ data: { success: true, data: mockDishes } });
    if (url === '/inventory') return Promise.resolve({ data: { success: true, data: mockIngredients } });
    if (url === '/notifications/unread-count') return Promise.resolve({ data: { data: { count: 0 } } });
    return Promise.reject(new Error('unexpected'));
  }

  test('renders menu items when admin loads the page', async () => {
    vi.mocked(axios.get).mockImplementation(mockGet);

    renderWithProviders(<MenuManagement />, { authUser: mockUser });

    expect(await screen.findByText('Margherita Pizza')).toBeInTheDocument();
    expect(screen.getByText('Caesar Salad')).toBeInTheDocument();
    expect(screen.getByText('$12.99')).toBeInTheDocument();
    expect(screen.getByText('Pizza')).toBeInTheDocument();
  });

  test('shows "New dish" button for admin', async () => {
    vi.mocked(axios.get).mockImplementation(mockGet);

    renderWithProviders(<MenuManagement />, { authUser: mockUser });

    expect(await screen.findByText(/new dish/i)).toBeInTheDocument();
  });

  test('shows error state when API rejects', async () => {
    vi.mocked(axios.get).mockImplementation((url) => {
      if (url === '/notifications/unread-count') return Promise.resolve({ data: { data: { count: 0 } } });
      return Promise.reject(new Error('Network error'));
    });

    renderWithProviders(<MenuManagement />, { authUser: mockUser });

    expect(await screen.findByText(/failed to load menu/i)).toBeInTheDocument();
  });

  test('clicking "New dish" opens the creation modal', async () => {
    vi.mocked(axios.get).mockImplementation(mockGet);
    const { user } = renderWithProviders(<MenuManagement />, { authUser: mockUser });
    await screen.findByText('Margherita Pizza');
    const newBtn = screen.getByRole('button', { name: /new dish/i });
    await user.click(newBtn);
    expect(await screen.findByRole('heading', { name: /new dish/i })).toBeInTheDocument();
  });

  test('creating a dish calls POST /menu', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { success: true, data: { _id: 'd3', name: 'Pasta', category: 'Main', price: 15, isAvailable: true, ingredients: [], version: 1 } } });
    vi.mocked(axios.get).mockImplementation(mockGet);
    const { user, container } = renderWithProviders(<MenuManagement />, { authUser: mockUser });
    await screen.findByText('Margherita Pizza');
    const newBtn = screen.getByRole('button', { name: /new dish/i });
    await user.click(newBtn);
    const nameInput = container.querySelector('input[type="text"]');
    await user.type(nameInput, 'Pasta');
    const priceInput = container.querySelector('input[type="number"]');
    await user.type(priceInput, '15');
    const submitBtn = screen.getByRole('button', { name: /^create$/i });
    await user.click(submitBtn);
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith('/menu', expect.objectContaining({
        name: 'Pasta',
        price: 15
      }));
    });
  });
});