import { describe, test, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import axios from '../../api/axios';
import { renderWithProviders } from '../../test/render';
import { mockUser } from '../../test/fixtures';
import Inventory from '../../pages/Inventory';

vi.mock('../../components/notifications/NotificationBell', () => ({
  default: () => null
}));

const inventoryItems = [
  { _id: '1', name: 'Tomato', quantity: 50, unit: 'kg', minStock: 10, costPerUnit: 2.5, expiryDate: '2027-01-01', wasteQuantity: 0 },
  { _id: '2', name: 'Onion', quantity: 5, unit: 'kg', minStock: 20, costPerUnit: 1.0, expiryDate: '2027-06-01', wasteQuantity: 0 },
  { _id: '3', name: 'Garlic', quantity: 3, unit: 'kg', minStock: 5, costPerUnit: 4.0, expiryDate: '2027-03-01', wasteQuantity: 0 }
];

function mockGet(url) {
  if (url === '/inventory') return Promise.resolve({
    data: { success: true, data: inventoryItems }
  });
  if (url === '/notifications/unread-count') return Promise.resolve({ data: { data: { count: 0 } } });
  return Promise.reject(new Error('unexpected'));
}

describe('Inventory page', () => {
  test('renders ingredient rows from mocked GET', async () => {
    vi.mocked(axios.get).mockImplementation(mockGet);
    renderWithProviders(<Inventory />, { authUser: mockUser, initialRoute: '/inventory' });
    expect(await screen.findByText(/tomato/i)).toBeInTheDocument();
  });

  test('Export button is present for admin', async () => {
    vi.mocked(axios.get).mockImplementation(mockGet);
    renderWithProviders(<Inventory />, { authUser: mockUser, initialRoute: '/inventory' });
    expect(await screen.findByRole('button', { name: /export/i })).toBeInTheDocument();
  });

  test('search filter narrows visible rows', async () => {
    vi.mocked(axios.get).mockImplementation(mockGet);
    const { user } = renderWithProviders(<Inventory />, { authUser: mockUser, initialRoute: '/inventory' });
    expect(await screen.findByText(/tomato/i)).toBeInTheDocument();
    expect(screen.getByText(/onion/i)).toBeInTheDocument();
    const searchInput = screen.getByPlaceholderText(/search/i);
    await user.type(searchInput, 'Tomato');
    await waitFor(() => {
      expect(screen.getByText(/tomato/i)).toBeInTheDocument();
      expect(screen.queryByText(/onion/i)).not.toBeInTheDocument();
    });
  });

  test('edit modal opens and closes', async () => {
    vi.mocked(axios.get).mockImplementation(mockGet);
    const { user } = renderWithProviders(<Inventory />, { authUser: mockUser, initialRoute: '/inventory' });
    expect(await screen.findByText(/tomato/i)).toBeInTheDocument();
    const editBtns = screen.getAllByTitle('Edit');
    await user.click(editBtns[0]);
    expect(screen.getByText(/edit item/i)).toBeInTheDocument();
    const closeBtn = screen.getByText('×');
    await user.click(closeBtn);
    await waitFor(() => {
      expect(screen.queryByText(/edit item/i)).not.toBeInTheDocument();
    });
  });

  test('save in edit modal calls PATCH /inventory/:id', async () => {
    vi.mocked(axios.patch).mockResolvedValueOnce({ data: { success: true } });
    vi.mocked(axios.get).mockImplementation(mockGet);
    const { user } = renderWithProviders(<Inventory />, { authUser: mockUser, initialRoute: '/inventory' });
    expect(await screen.findByText(/tomato/i)).toBeInTheDocument();
    const editBtns = screen.getAllByTitle('Edit');
    await user.click(editBtns[0]);
    const submitBtn = screen.getByRole('button', { name: /update item/i });
    await user.click(submitBtn);
    await waitFor(() => {
      expect(axios.patch).toHaveBeenCalledWith('/inventory/1', expect.any(Object));
    });
  });

  test('delete calls DELETE /inventory/:id', async () => {
    vi.mocked(axios.delete).mockResolvedValueOnce({ data: { success: true } });
    vi.mocked(axios.get).mockImplementation(mockGet);
    window.confirm = vi.fn(() => true);
    const { user } = renderWithProviders(<Inventory />, { authUser: mockUser, initialRoute: '/inventory' });
    expect(await screen.findByText(/tomato/i)).toBeInTheDocument();
    const deleteBtns = screen.getAllByTitle('Delete');
    await user.click(deleteBtns[0]);
    await waitFor(() => {
      expect(axios.delete).toHaveBeenCalledWith('/inventory/1');
    });
  });

  test('low-stock badge appears for ingredient below minStock', async () => {
    vi.mocked(axios.get).mockImplementation(mockGet);
    renderWithProviders(<Inventory />, { authUser: mockUser, initialRoute: '/inventory' });
    const badges = await screen.findAllByText(/low stock/i);
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  test('Export button click triggers download', async () => {
    vi.mocked(axios.get).mockImplementation((url) => {
      if (url === '/inventory') return Promise.resolve({ data: { success: true, data: inventoryItems } });
      if (url === '/inventory/export') return Promise.resolve({ data: new Blob(['csv'], { type: 'text/csv' }) });
      if (url === '/notifications/unread-count') return Promise.resolve({ data: { data: { count: 0 } } });
      return Promise.reject(new Error('unexpected'));
    });
    const { user } = renderWithProviders(<Inventory />, { authUser: mockUser, initialRoute: '/inventory' });
    const exportBtn = await screen.findByRole('button', { name: /export/i });
    await user.click(exportBtn);
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith('/inventory/export', expect.objectContaining({ responseType: 'blob' }));
    });
  });
});