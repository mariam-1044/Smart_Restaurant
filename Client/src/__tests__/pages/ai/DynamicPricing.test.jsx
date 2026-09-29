import { describe, test, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from '../../../api/axios';
import { renderWithProviders } from '../../../test/render';
import { mockUser } from '../../../test/fixtures';
import DynamicPricing from '../../../pages/ai/DynamicPricing';

vi.mock('../../../api/aiCall', () => ({
  aiCall: vi.fn()
}));
vi.mock('../../../components/notifications/NotificationBell', () => ({
  default: () => null
}));

const { aiCall } = await import('../../../api/aiCall');

const mockPricingRecs = [
  {
    dishId: 'dish1',
    dishName: 'Burger',
    currentPrice: 10.0,
    suggestedPrice: 11.5,
    direction: 'up',
    confidence: 0.85,
    demandScore: 0.7,
    __version: 1
  },
  {
    dishId: 'dish2',
    dishName: 'Salad',
    currentPrice: 8.0,
    suggestedPrice: 7.0,
    direction: 'down',
    confidence: 0.6,
    demandScore: 0.4,
    __version: 1
  }
];

describe('DynamicPricing page', () => {
  test('renders pricing cards from mocked /v1/ai/pricing/suggest', async () => {
    vi.mocked(aiCall).mockResolvedValueOnce({ ok: true, data: mockPricingRecs });
    renderWithProviders(<DynamicPricing />, { authUser: mockUser });

    expect(await screen.findByText('Burger')).toBeInTheDocument();
    expect(screen.getByText('Salad')).toBeInTheDocument();
  });

  test('"Apply" button exists on pricing cards', async () => {
    vi.mocked(aiCall).mockResolvedValueOnce({ ok: true, data: mockPricingRecs });
    renderWithProviders(<DynamicPricing />, { authUser: mockUser });

    const applyButtons = await screen.findAllByRole('button', { name: /apply/i });
    expect(applyButtons.length).toBeGreaterThanOrEqual(1);
  });

  test('"Apply all" button exists in header', async () => {
    vi.mocked(aiCall).mockResolvedValueOnce({ ok: true, data: mockPricingRecs });
    renderWithProviders(<DynamicPricing />, { authUser: mockUser });

    expect(await screen.findByRole('button', { name: /apply all/i })).toBeInTheDocument();
  });

  test('shows error state when aiCall returns error', async () => {
    vi.mocked(aiCall).mockResolvedValueOnce({ ok: false, kind: 'error', message: 'Service error' });
    renderWithProviders(<DynamicPricing />, { authUser: mockUser });

    expect(await screen.findByText(/failed to load recommendations/i)).toBeInTheDocument();
  });

  test('shows AI unavailable state when aiCall returns ai_unavailable', async () => {
    vi.mocked(aiCall).mockResolvedValueOnce({ ok: false, kind: 'ai_unavailable', message: 'Service unavailable' });
    renderWithProviders(<DynamicPricing />, { authUser: mockUser });

    expect(await screen.findByText(/ai pricing service unavailable/i)).toBeInTheDocument();
  });

  test('clicking Apply on single card calls POST /v1/ai/pricing/apply', async () => {
    vi.mocked(aiCall).mockResolvedValueOnce({ ok: true, data: mockPricingRecs });
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { data: { applied: [{ dishId: 'dish1', oldPrice: 10, newPrice: 11.5 }], conflicts: [], failed: [] } } });
    vi.mocked(axios.get).mockImplementation(() => Promise.resolve({ data: { data: { count: 0 } } }));
    const { user } = renderWithProviders(<DynamicPricing />, { authUser: mockUser });
    await screen.findByText('Burger');
    const applyBtns = screen.getAllByRole('button', { name: /apply/i });
    const singleApply = applyBtns.find(btn => !btn.disabled);
    await user.click(singleApply);
    const confirmBtn = await screen.findByRole('button', { name: /^confirm|apply this pricing/i });
    await user.click(confirmBtn);
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith('/v1/ai/pricing/apply', expect.objectContaining({
        dishIds: expect.any(Array)
      }));
    });
  });
});