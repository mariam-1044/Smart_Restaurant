import api from "./axios";

export const listMenu = () =>
  api.get("/menu").then((r) => r.data?.data ?? []);

export const createDish = (payload) =>
  api.post("/menu", payload).then((r) => r.data?.data);

export const updateDish = (id, payload) =>
  api.patch(`/menu/${id}`, payload).then((r) => r.data?.data);

export const deleteDish = (id, version) =>
  api
    .delete(`/menu/${id}`, { data: { __version: version } })
    .then((r) => r.data);

export const toggleDishAvailability = (dish) =>
  updateDish(dish._id, { isAvailable: !dish.isAvailable, __version: dish.version });
