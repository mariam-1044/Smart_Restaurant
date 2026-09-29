import api from "./axios";

export const fetchDashboardStats = () =>
  api.get("/dashboard/stats").then((r) => r.data?.data);

export const fetchAdminDashboard = () =>
  api.get("/dashboard/admin").then((r) => r.data?.data);

export const fetchSalesReport = (period = "weekly") =>
  api.get(`/sales/report?period=${period}`).then((r) => r.data?.data);
