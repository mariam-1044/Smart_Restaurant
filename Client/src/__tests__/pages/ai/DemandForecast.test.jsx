import { describe, test, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from '../../../api/axios';
import { renderWithProviders } from '../../../test/render';
import { mockUser } from '../../../test/fixtures';
import DemandForecast from '../../../pages/ai/DemandForecast';

vi.mock('../../../api/aiCall', () => ({
  aiCall: vi.fn()
}));
vi.mock('../../../components/notifications/NotificationBell', () => ({
  default: () => null
}));
vi.mock('../../../components/ai/ForecastChart', () => ({
  default: () => <div data-testid="forecast-chart">Chart</div>
}));
vi.mock('../../../components/ai/DemandAlertBanner', () => ({
  default: () => <div data-testid="demand-alert">Alert</div>
}));
vi.mock('../../../components/ai/StaffingSuggestionCard', () => ({
  default: () => <div data-testid="staffing-card">Staffing</div>
}));

const { aiCall } = await import('../../../api/aiCall');

const mockDishes = [
  { _id: 'dish1', name: 'Burger' },
  { _id: 'dish2', name: 'Pizza' }
];

const mockForecast = {
  dishName: 'Burger',
  dishId: 'dish1',
  historyStatus: 'sufficient',
  forecast: [
    { date: '2026-05-05', predictedQuantity: 30, lowerBound: 20, upperBound: 40 },
    { date: '2026-05-06', predictedQuantity: 35, lowerBound: 25, upperBound: 45 }
  ],
  spikeAlert: { triggered: false },
  staffingSuggestion: { recommended: 3, reason: 'High demand expected' }
};

describe('DemandForecast page', () => {
  test('renders dish selector from mocked /menu', async () => {
    vi.mocked(axios.get).mockImplementation((url) => {
      if (url === '/menu') return Promise.resolve({ data: { success: true, data: mockDishes } });
      if (url === '/notifications/unread-count') return Promise.resolve({ data: { data: { count: 0 } } });
      return Promise.reject(new Error('unexpected'));
    });
    renderWithProviders(<DemandForecast />, { authUser: mockUser });

    expect(await screen.findByText('Burger')).toBeInTheDocument();
    expect(screen.getByText('Pizza')).toBeInTheDocument();
  });

  test('period toggle buttons exist (7d / 30d)', async () => {
    vi.mocked(axios.get).mockImplementation((url) => {
      if (url === '/menu') return Promise.resolve({ data: { success: true, data: mockDishes } });
      if (url === '/notifications/unread-count') return Promise.resolve({ data: { data: { count: 0 } } });
      return Promise.reject(new Error('unexpected'));
    });
    renderWithProviders(<DemandForecast />, { authUser: mockUser });

    expect(await screen.findByRole('button', { name: '7d' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30d' })).toBeInTheDocument();
  });

  test('shows forecast data when dish selected and aiCall succeeds', async () => {
    const user = userEvent.setup();
    vi.mocked(axios.get).mockImplementation((url) => {
      if (url === '/menu') return Promise.resolve({ data: { success: true, data: mockDishes } });
      if (url === '/notifications/unread-count') return Promise.resolve({ data: { data: { count: 0 } } });
      return Promise.reject(new Error('unexpected'));
    });
    vi.mocked(aiCall).mockResolvedValueOnce({ ok: true, data: mockForecast });

    renderWithProviders(<DemandForecast />, { authUser: mockUser });

    const select = await screen.findByRole('combobox');
    await user.selectOptions(select, 'dish1');

    expect(await screen.findByText(/2026-05-05/i)).toBeInTheDocument();
    expect(screen.getByText(/2026-05-06/i)).toBeInTheDocument();
  });

  test('shows error state when menu API rejects', async () => {
    vi.mocked(axios.get).mockImplementation((url) => {
      if (url === '/notifications/unread-count') return Promise.resolve({ data: { data: { count: 0 } } });
      return Promise.reject(new Error('Network error'));
    });
    renderWithProviders(<DemandForecast />, { authUser: mockUser });

    expect(await screen.findByText(/failed to load dishes/i)).toBeInTheDocument();
  });

  test('shows error state when forecast aiCall fails', async () => {
    const user = userEvent.setup();
    vi.mocked(axios.get).mockImplementation((url) => {
      if (url === '/menu') return Promise.resolve({ data: { success: true, data: mockDishes } });
      if (url === '/notifications/unread-count') return Promise.resolve({ data: { data: { count: 0 } } });
      return Promise.reject(new Error('unexpected'));
    });
    vi.mocked(aiCall).mockResolvedValueOnce({ ok: false, kind: 'error', message: 'Forecast failed' });

    renderWithProviders(<DemandForecast />, { authUser: mockUser });

    const select = await screen.findByRole('combobox');
    await user.selectOptions(select, 'dish1');

    expect(await screen.findByText(/failed to load forecast/i)).toBeInTheDocument();
  });
});