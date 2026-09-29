import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/react';
import WasteByCategoryChart from '../../../components/waste/WasteByCategoryChart';

describe('WasteByCategoryChart', () => {
  test('renders with data without throwing', () => {
    const data = [
      { category: 'Produce', quantity: 10 },
      { category: 'Dairy', quantity: 5 }
    ];
    expect(() => render(<WasteByCategoryChart data={data} />)).not.toThrow();
  });

  test('renders empty state when data is empty', () => {
    expect(() => render(<WasteByCategoryChart data={[]} />)).not.toThrow();
  });
});