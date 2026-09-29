const orderService = require("../../application/services/order.service");
const customerService = require("../../application/services/customer.service");
const logger = require("../../infrastructure/config/logger");

exports.getCustomerProfile = async (req, res) => {
  try {
    const { phone, name } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: "Phone number is required." });
    }

    const customer = await customerService.findOrCreateCustomer(name, phone);
    
    const orders = await orderService.getAllOrders({ customer: customer._id });
    
    const personalized = await customerService.getPersonalizedRecommendations(customer._id);
    const global = await customerService.getGlobalRecommendations();

    res.status(200).json({
      success: true,
      data: {
        customer,
        orderHistory: orders,
        recommendations: {
          personalized,
          global
        }
      }
    });
  } catch (error) {
    logger.error(`Error in getCustomerProfile: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.placeCustomerOrder = async (req, res) => {
  try {
    const { customerName, customerPhone, items, paymentMethod } = req.body;

    if (!customerPhone || !items || items.length === 0) {
      return res.status(400).json({ success: false, message: "Phone and items are required." });
    }

    const orderData = {
      items,
      source: "Online",
      paymentMethod: paymentMethod || "Cash",
      isPaid: false,
    };

    const customerInfo = { name: customerName, phone: customerPhone };
    const order = await orderService.createOrder(orderData, customerInfo);

    res.status(201).json({
      success: true,
      message: "Order placed successfully!",
      data: order,
    });
  } catch (error) {
    logger.error(`Error placing customer order: ${error.message}`);
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getCustomerRecommendations = async (req, res) => {
  try {
    const { phone } = req.params;
    const customer = await customerService.findOrCreateCustomer("", phone);
    const personalized = await customerService.getPersonalizedRecommendations(customer._id);
    const global = await customerService.getGlobalRecommendations();

    res.status(200).json({
      success: true,
      data: { personalized, global },
    });
  } catch (error) {
    logger.error(`Error getting recommendations: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.listAll = async (req, res, next) => {
  try {
    const customers = await customerService.listAllWithTags();
    res.json({ success: true, data: customers });
  } catch (e) { next(e); }
};

exports.removeFavorite = async (req, res, next) => {
  try {
    const updated = await customerService.removeFavorite(req.params.id, req.params.dishId);
    if (!updated) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({
      success: true,
      data: { _id: updated._id, favoritesCount: updated.favoritesCount, favorites: updated.favorites }
    });
  } catch (e) { next(e); }
};

exports.getById = async (req, res, next) => {
  try {
    const detail = await customerService.getByIdWithDetail(req.params.id);
    if (!detail) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, data: detail });
  } catch (e) { next(e); }
};