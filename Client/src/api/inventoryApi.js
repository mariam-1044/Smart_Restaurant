import api from "./axios";

/**
 * Inventory API surface — all inventory-related axios calls live here.
 * Components should not call axios directly.
 */
export const listInventory = () =>
  api.get("/inventory").then((r) => r.data?.data ?? []);

export const getInventoryItem = (id) =>
  api.get(`/inventory/${id}`).then((r) => r.data?.data);

export const createInventoryItem = (payload) =>
  api.post("/inventory", payload).then((r) => r.data?.data);

export const updateInventoryItem = (id, payload) =>
  api.patch(`/inventory/${id}`, payload).then((r) => r.data?.data);

export const deleteInventoryItem = (id) =>
  api.delete(`/inventory/${id}`).then((r) => r.data);

export const listNearExpiry = () =>
  api.get("/inventory/near-expiry").then((r) => r.data?.data ?? []);

/**
 * Trigger a CSV export. Returns a Blob; caller is responsible for the download.
 */
export const exportInventoryCsv = ({ filtered = false, search = "" } = {}) => {
  const params = new URLSearchParams();
  if (filtered) params.set("filtered", "true");
  if (search) params.set("search", search);
  const qs = params.toString();
  const url = qs ? `/inventory/export?${qs}` : "/inventory/export";
  return api.get(url, { responseType: "blob" }).then((r) => r.data);
};

/**
 * Convenience: trigger a browser download for the export blob.
 * Returns a promise that resolves once the download has started.
 */
export const downloadInventoryCsv = async (opts = {}) => {
  const blob = await exportInventoryCsv(opts);
  const objectUrl = window.URL.createObjectURL(new Blob([blob]));
  const ts = new Date().toISOString().slice(0, 10);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.setAttribute(
    "download",
    opts.filtered ? `inventory-filtered-${ts}.csv` : `inventory-${ts}.csv`
  );
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
};
