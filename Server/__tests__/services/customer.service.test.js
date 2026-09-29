const { withInMemoryMongo } = require('../helpers/inMemoryMongo');
const { findOrCreateCustomer, updateCustomerOrderHistory, getPersonalizedRecommendations, getGlobalRecommendations, removeFavorite } = require('../../src/application/services/customer.service');
const Customer = require('../../src/domain/models/Customer');
const Dish = require('../../src/domain/models/Dish');
const Order = require('../../src/domain/models/Order');

describe('Customer Service', () => {
  withInMemoryMongo();

  test('findOrCreateCustomer creates a new customer when phone not found', async () => {
    const customer = await findOrCreateCustomer('John Doe', '555-1234');
    expect(customer.name).toBe('John Doe');
    expect(customer.phone).toBe('555-1234');
    expect(customer.totalOrders).toBe(0);
  });

  test('findOrCreateCustomer returns existing customer when phone matches', async () => {
    const first = await findOrCreateCustomer('Jane', '555-9999');
    const second = await findOrCreateCustomer('Janet', '555-9999');
    expect(second._id.toString()).toBe(first._id.toString());
    expect(second.name).toBe('Janet');
  });

  test('updateCustomerOrderHistory pushes orderId and updates favorites', async () => {
    const customer = await findOrCreateCustomer('Alice', '555-0001');
    const dish = await Dish.create({ name: 'Pizza', price: 10, category: 'Pizza', ingredients: [] });
    const order = await Order.create({ items: [{ dish: dish._id, quantity: 2, priceAtTime: 10 }], totalPrice: 20, status: 'completed', source: 'POS', paymentMethod: 'Cash' });
    await updateCustomerOrderHistory(customer._id, order._id, [{ dish: dish._id, quantity: 2 }]);
    const updated = await Customer.findById(customer._id);
    expect(updated.orderHistory).toHaveLength(1);
    expect(updated.totalOrders).toBe(1);
    expect(updated.favorites).toHaveLength(1);
    expect(updated.favorites[0].count).toBe(2);
  });

  test('getPersonalizedRecommendations returns top favorites', async () => {
    const customer = await findOrCreateCustomer('Bob', '555-0002');
    const d1 = await Dish.create({ name: 'Sushi', price: 15, category: 'Main', ingredients: [], isAvailable: true });
    const d2 = await Dish.create({ name: 'Burger', price: 8, category: 'Burgers', ingredients: [], isAvailable: true });
    const order = await Order.create({ items: [{ dish: d1._id, quantity: 3, priceAtTime: 15 }, { dish: d2._id, quantity: 1, priceAtTime: 8 }], totalPrice: 53, status: 'completed', source: 'POS', paymentMethod: 'Cash' });
    await updateCustomerOrderHistory(customer._id, order._id, [{ dish: d1._id, quantity: 3 }, { dish: d2._id, quantity: 1 }]);
    const recs = await getPersonalizedRecommendations(customer._id);
    expect(recs.length).toBeGreaterThan(0);
  });

  test('getGlobalRecommendations returns top available dishes', async () => {
    await Dish.create({ name: 'Global Dish', price: 12, category: 'Main', ingredients: [], isAvailable: true, salesCount: 100 });
    const recs = await getGlobalRecommendations();
    expect(recs.length).toBeGreaterThan(0);
  });

  describe('removeFavorite', () => {
    test('unlinks a single favorite and keeps favoritesCount in sync — without deleting the dish or customer', async () => {
      const d1 = await Dish.create({ name: 'Pizza', price: 12, category: 'Pizza', ingredients: [], isAvailable: true });
      const d2 = await Dish.create({ name: 'Burger', price: 8, category: 'Burgers', ingredients: [], isAvailable: true });
      const customer = await Customer.create({
        name: 'Faye', phone: '555-fav',
        favorites: [{ dish: d1._id, count: 3 }, { dish: d2._id, count: 1 }],
        favoritesCount: 2
      });

      const updated = await removeFavorite(customer._id, d1._id);
      expect(updated.favorites).toHaveLength(1);
      expect(String(updated.favorites[0].dish)).toBe(String(d2._id));
      expect(updated.favoritesCount).toBe(1);

      // Nothing else was deleted.
      expect(await Dish.findById(d1._id)).toBeTruthy();
      expect(await Customer.findById(customer._id)).toBeTruthy();
      const reloaded = await Customer.findById(customer._id);
      expect(reloaded.favorites).toHaveLength(1);
      expect(reloaded.favoritesCount).toBe(1);
    });

    test('removing a dish that is not a favorite is a no-op', async () => {
      const d1 = await Dish.create({ name: 'Pizza', price: 12, category: 'Pizza', ingredients: [], isAvailable: true });
      const customer = await Customer.create({ name: 'Faye', phone: '555-fav2', favorites: [{ dish: d1._id, count: 2 }], favoritesCount: 1 });
      const updated = await removeFavorite(customer._id, new (require('mongoose').Types.ObjectId)());
      expect(updated.favorites).toHaveLength(1);
      expect(updated.favoritesCount).toBe(1);
    });

    test('returns null for a missing customer', async () => {
      const res = await removeFavorite(new (require('mongoose').Types.ObjectId)(), new (require('mongoose').Types.ObjectId)());
      expect(res).toBeNull();
    });
  });
});