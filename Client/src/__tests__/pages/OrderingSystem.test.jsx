import { describe, test, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import axios from '../../api/axios';
import { renderWithProviders } from '../../test/render';
import { mockUser, mockDish } from '../../test/fixtures';
import OrderingSystem from '../../pages/OrderingSystem';

const customerUser = {
  _id: '64a1f0e0f0d0a0001a000099',
  name: 'Dina Diner',
  email: 'dina@test.local',
  role: 'customer',
  status: 'approved',
  tokenVersion: 0,
};

// Route the single shared axios.get mock by URL so the page's parallel
// fetches (menu / preferences / peer-endorsements) each get sensible data.
function routeGet({ menu = [mockDish], peers = [], hasPrefs = true } = {}) {
  vi.mocked(axios.get).mockImplementation((url) => {
    if (url === '/menu') return Promise.resolve({ data: { success: true, data: menu } });
    if (url.startsWith('/v1/preferences/me'))
      return Promise.resolve({ data: { success: true, data: hasPrefs ? { spice: 'mild' } : null } });
    if (url.includes('/recommendations/peer-endorsements'))
      return Promise.resolve({ data: { success: true, data: peers } });
    if (url.includes('/recommendations/'))
      return Promise.resolve({ data: { recommendations: [] } });
    return Promise.reject(new Error(`unmocked GET ${url}`));
  });
}

describe('OrderingSystem page', () => {
  beforeEach(() => vi.clearAllMocks());

  test('renders dishes from /menu', async () => {
    routeGet();
    renderWithProviders(<OrderingSystem />, { authUser: mockUser });
    expect(await screen.findByText(/margherita/i)).toBeInTheDocument();
  });

  test('does not crash when the menu API fails', async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error('Network error'));
    renderWithProviders(<OrderingSystem />, { authUser: mockUser });
    // Empty-basket message is always present even with no dishes.
    expect(await screen.findByText(/your basket is empty/i)).toBeInTheDocument();
  });

  test('Checkout button is disabled with an empty basket and enabled after adding a dish', async () => {
    routeGet();
    const { user } = renderWithProviders(<OrderingSystem />, { authUser: mockUser });
    await screen.findByText(/margherita/i);

    const checkout = screen.getByRole('button', { name: /checkout/i });
    expect(checkout).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /add to basket/i }));

    expect(checkout).toBeEnabled();
    // Cart now reflects the added item (scope to the cart panel — the menu
    // header also renders an item count).
    const cart = screen.getByText(/your order/i).closest('section');
    expect(within(cart).getByText(/1 items/i)).toBeInTheDocument();
  });

  test('full checkout flow: open modal, fill details, confirm order, see success', async () => {
    routeGet();
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { success: true, data: { _id: 'order1' } } });

    const { user } = renderWithProviders(<OrderingSystem />, { authUser: mockUser });
    await screen.findByText(/margherita/i);

    await user.click(screen.getByRole('button', { name: /add to basket/i }));
    await user.click(screen.getByRole('button', { name: /checkout/i }));

    // Modal appears with the Confirm Order button reachable.
    const dialog = await screen.findByText(/customer information/i);
    expect(dialog).toBeInTheDocument();
    const confirmBtn = screen.getByRole('button', { name: /confirm order/i });
    expect(confirmBtn).toBeInTheDocument();

    await user.type(screen.getByLabelText(/full name/i), 'Jane Customer');
    await user.type(screen.getByLabelText(/table number/i), '12');
    await user.type(screen.getByLabelText(/phone number/i), '01000000000');
    await user.click(confirmBtn);

    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        '/orders',
        expect.objectContaining({
          items: [{ dish: mockDish._id, quantity: 1 }],
          source: 'Online',
          paymentMethod: 'Cash',
        })
      )
    );
    expect(await screen.findByText(/order confirmed/i)).toBeInTheDocument();
  });

  test('quantity controls add and remove items from the basket', async () => {
    routeGet();
    const { user } = renderWithProviders(<OrderingSystem />, { authUser: mockUser });
    await screen.findByText(/margherita/i);

    await user.click(screen.getByRole('button', { name: /add to basket/i }));
    const cart = screen.getByText(/your order/i).closest('section');
    // Increment within the cart row.
    const plus = within(cart).getByRole('button', { name: '+' });
    await user.click(plus);
    expect(screen.getByText(/2 items/i)).toBeInTheDocument();

    const minus = within(cart).getByRole('button', { name: '-' });
    await user.click(minus);
    await user.click(within(cart).getByRole('button', { name: '-' }));
    // Removed entirely → empty basket message returns.
    expect(screen.getByText(/your basket is empty/i)).toBeInTheDocument();
  });

  test('category tabs filter the dish list', async () => {
    routeGet({
      menu: [
        mockDish,
        { ...mockDish, _id: 'd2', name: 'BBQ Wings', category: 'Grills' },
      ],
    });
    const { user } = renderWithProviders(<OrderingSystem />, { authUser: mockUser });
    await screen.findByText(/margherita/i);
    expect(screen.queryByText(/bbq wings/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Grills' }));
    expect(await screen.findByText(/bbq wings/i)).toBeInTheDocument();
    expect(screen.queryByText(/margherita/i)).not.toBeInTheDocument();
  });

  test('customer peer-recipes banner renders and does not overlap the checkout panel', async () => {
    routeGet({
      peers: [{ dishId: mockDish._id, name: 'Margherita Pizza', rating: 5, endorser: 'diner_42', price: 12.99 }],
    });
    const { container } = renderWithProviders(<OrderingSystem />, { authUser: customerUser });

    expect(await screen.findByText(/loved by other diners/i)).toBeInTheDocument();
    // The layout flags the banner so CSS reserves space and the Checkout
    // button stays reachable (regression guard for the overlap bug).
    expect(container.querySelector('.main-layout.has-peer-banner')).toBeTruthy();
  });

  test('no peer banner / overlap class for admin users', async () => {
    routeGet();
    const { container } = renderWithProviders(<OrderingSystem />, { authUser: mockUser });
    await screen.findByText(/margherita/i);
    expect(screen.queryByText(/loved by other diners/i)).not.toBeInTheDocument();
    expect(container.querySelector('.main-layout.has-peer-banner')).toBeFalsy();
  });
});
