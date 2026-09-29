import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/react';
import WasteTrendChart from '../../../components/waste/WasteTrendChart';

describe('WasteTrendChart', () => {
  test('renders with data without throwing', () => {
    const data = [
      { date: '2026-05-01', quantity: 5 },
      { date: '2026-05-02', quantity: 8 }
    ];
    expect(() => render(<WasteTrendChart data={data} />)).not.toThrow();
  });

  test('renders empty state when data is empty', () => {
    expect(() => render(<WasteTrendChart data={[]} />)).not.toThrow();
  });
});