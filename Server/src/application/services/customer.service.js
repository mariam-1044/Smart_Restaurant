const Customer = require("../../domain/models/Customer");
const Order = require("../../domain/models/Order");
const Dish = require("../../domain/models/Dish");

exports.findOrCreateCustomer = async (name, phone) => {
  let customer = await Customer.findOne({ phone });

  if (!customer) {
    customer = await Customer.create({
      name,
      phone,
      totalOrders: 0,
      totalSpend: 0,
      lastVisit: new Date()
    });
  } else {
    customer.lastVisit = new Date();
    if (name && customer.name !== name) {
      customer.name = name;
    }
    await customer.save();
  }
  return customer;
};

exports.updateCustomerOrderHistory = async (customerId, orderId, orderItems, { paid = false } = {}) => {
  const customer = await Customer.findById(customerId);
  if (!customer) return;

  customer.totalOrders += 1;
  customer.lastVisit = new Date();
  customer.lastOrderAt = new Date();

  if (orderId) {
    customer.orderHistory.push(orderId);
  }

  let orderTotal = 0;
  orderItems.forEach((item) => {
    const dishId = item.dish || item.dishId;
    const qty = item.quantity || 1;
    orderTotal += (Number(item.priceAtTime) || 0) * qty;
    const existingFavorite = customer.favorites.find(
      (fav) => fav.dish && fav.dish.toString() === dishId.toString()
    );
    if (existingFavorite) {
      existingFavorite.count += qty;
    } else {
      customer.favorites.push({ dish: dishId, count: qty });
    }
  });

  // totalSpend reflects money actually collected — only credited once an
  // order is marked paid (online orders start unpaid and are settled later).
  if (paid && orderTotal > 0) {
    customer.totalSpend = (customer.totalSpend || 0) + orderTotal;
  }

  customer.favoritesCount = customer.favorites.length;
  await customer.save();
};

/**
 * Credit (or debit, with a negative amount) a customer's lifetime spend.
 * Used when an order is settled (marked paid) after it was placed.
 */
exports.addCustomerSpend = async (customerId, amount) => {
  if (!customerId || !amount) return;
  await Customer.findByIdAndUpdate(customerId, { $inc: { totalSpend: amount } });
};

/**
 * Remove a single dish from a customer's favorites list. This only unlinks
 * the favorite entry (and keeps favoritesCount in sync) — it does not delete
 * the dish, the customer, or anything else. Returns the updated customer, or
 * null if the customer doesn't exist.
 */
exports.removeFavorite = async (customerId, dishId) => {
  const customer = await Customer.findById(customerId);
  if (!customer) return null;
  const before = customer.favorites.length;
  customer.favorites = customer.favorites.filter(
    (fav) => !(fav.dish && fav.dish.toString() === String(dishId))
  );
  if (customer.favorites.length !== before) {
    customer.favoritesCount = customer.favorites.length;
    await customer.save();
  }
  return customer;
};

exports.getPersonalizedRecommendations = async (customerId) => {
  const customer = await Customer.findById(customerId);
  if (!customer) return [];
  return customer.favorites
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map(f => f.dish);
};

exports.getGlobalRecommendations = async () => {
  return await Dish.find({ isAvailable: true })
    .sort({ salesCount: -1 })
    .limit(5);
};

async function _buildOrderCountsMap() {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000);
  const counts = await Order.aggregate([
    { $match: { createdAt: { $gte: ninetyDaysAgo } } },
    { $group: { _id: '$customer', ordersIn90d: { $sum: 1 } } }
  ]);
  const counts60 = await Order.aggregate([
    { $match: { createdAt: { $gte: sixtyDaysAgo } } },
    { $group: { _id: '$customer', ordersIn60d: { $sum: 1 } } }
  ]);
  const map90 = new Map(counts.map(c => [String(c._id), c.ordersIn90d]));
  const map60 = new Map(counts60.map(c => [String(c._id), c.ordersIn60d]));
  return { map90, map60 };
}

exports.listAllWithTags = async function() {
  const customers = await Customer.find({}, 'name phone totalOrders totalSpend lastOrderAt favoritesCount version').lean();
  if (customers.length === 0) return [];

  const sortedSpend = customers.map(c => c.totalSpend || 0).sort((a, b) => a - b);
  const cutoffIndex = Math.floor(sortedSpend.length * 0.8);
  const highValueCutoff = sortedSpend.length > 0 ? sortedSpend[cutoffIndex] ?? Infinity : Infinity;
  const { map90, map60 } = await _buildOrderCountsMap();
  const now = Date.now();
  const days = (date) => date ? (now - new Date(date).getTime()) / 86400000 : Infinity;

  return customers.map(c => {
    const tags = [];
    const ordersIn90d = map90.get(String(c._id)) || 0;
    const ordersIn60d = map60.get(String(c._id)) || 0;
    if (ordersIn90d >= 3) tags.push('Regular');
    if ((c.totalSpend || 0) >= highValueCutoff) tags.push('High Value');
    // At-Risk: spec FR-023 says "previously qualified as Regular but no order in 60 days."
    // This implementation uses ordersIn90d >= 3 && lastOrderAt > 60d ago as a practical
    // approximation. A stricter implementation would persist a wasRegular flag.
    if (ordersIn90d >= 3 && days(c.lastOrderAt) > 60) tags.push('At Risk');
    return { ...c, tags };
  });
};

exports.getByIdWithDetail = async function(id) {
  const customer = await Customer.findById(id).lean();
  if (!customer) return null;

  const { map90, map60 } = await _buildOrderCountsMap();
  const sortedSpend = (await Customer.find({}, 'totalSpend').lean()).map(c => c.totalSpend || 0).sort((a, b) => a - b);
  const cutoffIndex = Math.floor(sortedSpend.length * 0.8);
  const highValueCutoff = sortedSpend.length > 0 ? sortedSpend[cutoffIndex] ?? Infinity : Infinity;
  const now = Date.now();
  const days = (date) => date ? (now - new Date(date).getTime()) / 86400000 : Infinity;
  const ordersIn90d = map90.get(String(customer._id)) || 0;

  const tags = [];
  if (ordersIn90d >= 3) tags.push('Regular');
  if ((customer.totalSpend || 0) >= highValueCutoff) tags.push('High Value');
  // At-Risk: same approximation as listAllWithTags — see note there (FR-023).
  if (ordersIn90d >= 3 && days(customer.lastOrderAt) > 60) tags.push('At Risk');

  const orders = await Order.find({ customer: id })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  const allDishIds = [
    ...new Set(orders.flatMap(o => o.items.map(i => i.dish?.toString())).filter(Boolean)),
    ...customer.favorites.map(f => f.dish?.toString()).filter(Boolean)
  ];
  const dishDocs = await Dish.find({ _id: { $in: allDishIds } }).select('name').lean();
  const dishNameMap = new Map(dishDocs.map(d => [d._id.toString(), d.name]));

  const orderHistory = orders.map(o => ({
    orderId: o._id,
    placedAt: o.createdAt,
    items: o.items.map(i => ({
      dishId: i.dish,
      dishName: dishNameMap.get(i.dish?.toString()) || 'Dish',
      quantity: i.quantity,
      price: i.priceAtTime
    })),
    total: o.totalPrice,
    status: o.status
  }));

  const favorites = customer.favorites
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map(f => ({ dishId: f.dish, dishName: dishNameMap.get(f.dish?.toString()) || 'Dish', orderCount: f.count }));

  return {
    ...customer,
    tags,
    orderHistory,
    favorites
  };
};