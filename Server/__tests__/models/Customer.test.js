const { withInMemoryMongo } = require('../helpers/inMemoryMongo');
const Customer = require('../../src/domain/models/Customer');

describe('Customer Model', () => {
  withInMemoryMongo();

  test('phone is required', async () => {
    await expect(Customer.create({ name: 'NoPhone' })).rejects.toThrow();
  });

  test('phone is unique', async () => {
    await Customer.create({ name: 'C1', phone: '555-unique' });
    await expect(Customer.create({ name: 'C2', phone: '555-unique' })).rejects.toThrow();
  });

  test('orderHistory defaults to empty array', async () => {
    const cust = await Customer.create({ name: 'NewCust', phone: '555-empty' });
    expect(cust.orderHistory).toEqual([]);
  });

  test('favorites defaults to empty array', async () => {
    const cust = await Customer.create({ name: 'FavCust', phone: '555-fav' });
    expect(cust.favorites).toEqual([]);
  });
});