import { describe, test, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import axios from '../../api/axios';
import { renderWithProviders } from '../../test/render';
import { mockUser } from '../../test/fixtures';
import Recipes from '../../pages/Recipes';

vi.mock('../../api/axios');

vi.mock('../../layouts/DashboardLayout', () => ({
  default: ({ children }) => <div data-testid="layout">{children}</div>
}));

const inventoryResponse = {
  data: {
    success: true,
    data: [
      { _id: 'i1', name: 'Tomato', quantity: 10 },
      { _id: 'i2', name: 'Basil', quantity: 5 },
      { _id: 'i3', name: 'Mozzarella', quantity: 3 }
    ]
  }
};

const favoritesResponse = {
  data: {
    success: true,
    data: [
      { name: 'Truffle', count: 7 },
      { name: 'Saffron', count: 4 }
    ]
  }
};

const historyResponse = { data: { success: true, data: [] } };

function setupAxios() {
  vi.mocked(axios.get).mockImplementation((url) => {
    if (url === '/inventory') return Promise.resolve(inventoryResponse);
    if (url.startsWith('/v1/ai/recipes')) return Promise.resolve(historyResponse);
    if (url.startsWith('/v1/ai/customer-favorites')) return Promise.resolve(favoritesResponse);
    if (url === '/notifications/unread-count') return Promise.resolve({ data: { data: { count: 0 } } });
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
}

describe('Recipes — admin config panel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAxios();
  });

  test('shows all stocked ingredients pre-selected as checked checkboxes', async () => {
    renderWithProviders(<Recipes />, { authUser: mockUser });

    await waitFor(() => {
      expect(screen.getByText('3 of 3 selected')).toBeInTheDocument();
    });
    const tomatoBox = screen.getByRole('checkbox', { name: /Tomato/ });
    expect(tomatoBox).toBeChecked();
  });

  test('unchecking an ingredient removes it from the selection count', async () => {
    const { user } = renderWithProviders(<Recipes />, { authUser: mockUser });

    await waitFor(() => expect(screen.getByText('3 of 3 selected')).toBeInTheDocument());
    await user.click(screen.getByRole('checkbox', { name: /Tomato/ }));

    await waitFor(() => expect(screen.getByText('2 of 3 selected')).toBeInTheDocument());
    expect(screen.getByRole('checkbox', { name: /Tomato/ })).not.toBeChecked();
  });

  test('Clear all empties the selection', async () => {
    const { user } = renderWithProviders(<Recipes />, { authUser: mockUser });

    await waitFor(() => expect(screen.getByText('3 of 3 selected')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Clear all/ }));

    await waitFor(() => expect(screen.getByText('0 of 3 selected')).toBeInTheDocument());
  });

  test('Select all re-checks every ingredient', async () => {
    const { user } = renderWithProviders(<Recipes />, { authUser: mockUser });

    await waitFor(() => expect(screen.getByText('3 of 3 selected')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Clear all/ }));
    await waitFor(() => expect(screen.getByText('0 of 3 selected')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Select all/ }));
    await waitFor(() => expect(screen.getByText('3 of 3 selected')).toBeInTheDocument());
  });

  test('customer favorites load and toggling them updates the featured count', async () => {
    const { user } = renderWithProviders(<Recipes />, { authUser: mockUser });

    const truffleBox = await screen.findByRole('checkbox', { name: /Truffle/ });
    expect(truffleBox).not.toBeChecked();
    expect(screen.getByText('0 featured')).toBeInTheDocument();

    await user.click(truffleBox);
    await waitFor(() => expect(screen.getByText('1 featured')).toBeInTheDocument());
    expect(screen.getByRole('checkbox', { name: /Truffle/ })).toBeChecked();
  });

  test('admin can add a custom favorite via the input', async () => {
    const { user } = renderWithProviders(<Recipes />, { authUser: mockUser });

    const input = await screen.findByPlaceholderText(/Add a custom favorite/);
    await user.type(input, 'Sumac');
    await user.click(screen.getByRole('button', { name: /^Add$/ }));

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /Sumac/ })).toBeChecked();
    });
    expect(screen.getByText('1 featured')).toBeInTheDocument();
  });

  test('Generate Recipe sends selected ingredients, favorites and creativity', async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        _id: 'r1',
        name: 'Truffle Risotto',
        description: 'Earthy and bold',
        ingredients: [],
        estimatedCost: 8,
        suggestedPrice: 24,
        status: 'draft',
        createdAt: new Date().toISOString()
      }
    });

    const { user } = renderWithProviders(<Recipes />, { authUser: mockUser });

    await screen.findByText('3 of 3 selected');
    await user.click(await screen.findByRole('checkbox', { name: /Truffle/ }));
    await user.click(screen.getByRole('button', { name: /Generate New Recipe/ }));

    await waitFor(() => {
      expect(vi.mocked(axios.post)).toHaveBeenCalledWith('/v1/ai/recipe', expect.objectContaining({
        ingredients: ['Tomato', 'Basil', 'Mozzarella'],
        favoriteIngredients: ['Truffle'],
        creativity: 7
      }));
    });
  });
});
