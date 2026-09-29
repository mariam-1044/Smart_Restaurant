import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/react';
import WasteByIngredientChart from '../../../components/waste/WasteByIngredientChart';

describe('WasteByIngredientChart', () => {
  test('renders with data without throwing', () => {
    const data = [
      { ingredientName: 'Tomato', quantity: 10 },
      { ingredientName: 'Milk', quantity: 5 }
    ];
    expect(() => render(<WasteByIngredientChart data={data} />)).not.toThrow();
  });

  test('renders empty state when data is empty', () => {
    expect(() => render(<WasteByIngredientChart data={[]} />)).not.toThrow();
  });
});