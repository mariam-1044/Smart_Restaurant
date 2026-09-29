import { describe, test, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import axios from '../../api/axios';
import { renderWithProviders } from '../../test/render';
import { mockUser } from '../../test/fixtures';
import Recommendation from '../../pages/Recommendation';

vi.mock('../../components/notifications/NotificationBell', () => ({
  default: () => null
}));

describe('Recommendation page', () => {
  const mockRecommendations = {
    success: true,
    data: [
      {
        title: 'Menu Optimization',
        description: 'Increase burger price by 5%',
        impact: '+EGP 1,200/mo',
        type: 'marketing'
      },
      {
        title: 'Waste Prevention',
        description: 'Use tomatoes for special soup',
        impact: '-15% Waste',
        type: 'waste'
      }
    ],
    didYouKnow: '"Burger" and "Fries" were ordered together 12 times this month.'
  };

  test('renders recommendation cards from /v1/ai/recommendations', async () => {
    vi.mocked(axios.get).mockImplementation((url) => {
      if (url === '/v1/ai/recommendations') return Promise.resolve({ data: mockRecommendations });
      if (url === '/notifications/unread-count') return Promise.resolve({ data: { data: { count: 0 } } });
      return Promise.reject(new Error('unexpected'));
    });
    renderWithProviders(<Recommendation />, { authUser: mockUser });

    expect(screen.getByText(/loading recommendations/i)).toBeInTheDocument();
    expect(await screen.findByText('Menu Optimization')).toBeInTheDocument();
    expect(screen.getByText('Waste Prevention')).toBeInTheDocument();
    expect(screen.getByText('+EGP 1,200/mo')).toBeInTheDocument();
    expect(screen.getByText('-15% Waste')).toBeInTheDocument();
    expect(screen.getByText(/ordered together 12 times/i)).toBeInTheDocument();
  });

  test('shows an error message and no stale cards when the API rejects', async () => {
    vi.mocked(axios.get).mockImplementation((url) => {
      if (url === '/notifications/unread-count') return Promise.resolve({ data: { data: { count: 0 } } });
      return Promise.reject(new Error('Network error'));
    });
    renderWithProviders(<Recommendation />, { authUser: mockUser });

    expect(await screen.findByText(/couldn't load ai recommendations/i)).toBeInTheDocument();
    expect(screen.queryByText('Menu Optimization')).not.toBeInTheDocument();
    expect(screen.getByText(/no recommendations to show yet/i)).toBeInTheDocument();
  });
});