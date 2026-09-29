import api from "./axios";

export const updateProfile = (payload) =>
  api.patch("/auth/update-profile", payload).then((r) => r.data);

export const updatePassword = (payload) =>
  api.patch("/auth/update-password", payload).then((r) => r.data);

export const logout = () => api.post("/auth/logout").then((r) => r.data);
