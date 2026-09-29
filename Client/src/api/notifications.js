import api from "./axios";

export const list        = ({ before, limit = 20 } = {}) =>
  api.get("/notifications", { params: { before, limit } }).then(r => r.data.data);

export const unreadCount = () =>
  api.get("/notifications/unread-count").then(r => r.data.data.count);

export const markRead    = (id) =>
  api.patch(`/notifications/${id}/read`).then(r => r.data.data);

export const markAllRead = () =>
  api.patch("/notifications/read-all").then(r => r.data.data);