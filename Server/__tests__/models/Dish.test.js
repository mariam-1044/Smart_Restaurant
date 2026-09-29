const { withInMemoryMongo } = require('../helpers/inMemoryMongo');
const Dish = require('../../src/domain/models/Dish');

describe('Dish Model', () => {
  withInMemoryMongo();

  test('price must be >= 0', async () => {
    await expect(Dish.create({ name: 'BadDish', price: -10, category: 'Pizza' })).rejects.toThrow();
  });

  test('isAvailable defaults to true', async () => {
    const dish = await Dish.create({ name: 'AvailDish', price: 10, category: 'Pizza' });
    expect(dish.isAvailable).toBe(true);
  });

  test('ingredients array with ingredient and quantity', async () => {
    const ingredientId = new (require('mongoose').Types.ObjectId)();
    const dish = await Dish.create({ name: 'IngDish', price: 15, category: 'Pizza', ingredients: [{ ingredient: ingredientId, quantity: 0.5 }] });
    expect(dish.ingredients).toHaveLength(1);
    expect(dish.ingredients[0].quantity).toBe(0.5);
  });
});