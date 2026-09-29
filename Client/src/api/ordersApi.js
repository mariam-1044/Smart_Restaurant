import api from "./axios";

export const listOrders = (params = {}) =>
  api.get("/orders", { params }).then((r) => r.data?.data ?? []);

export const getOrder = (id) =>
  api.get(`/orders/${id}`).then((r) => r.data?.data);

export const createOrder = (payload) =>
  api.post("/orders", payload).then((r) => r.data?.data);

export const updateOrderStatus = (id, status, opts = {}) =>
  api.patch(`/orders/${id}/status`, { status, ...opts }).then((r) => r.data?.data);

/** Confirm a pending order: mark it completed + paid so it lands in sales/reports. */
export const confirmOrder = (id) =>
  api.patch(`/orders/${id}/status`, { status: "completed", isPaid: true }).then((r) => r.data?.data);
