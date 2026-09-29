import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listInventory,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  downloadInventoryCsv,
} from "../api/inventoryApi";

/**
 * useInventory — owns inventory state, CRUD, search filter, and CSV export.
 * Returns ergonomic primitives that the page just renders.
 */
export default function useInventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listInventory();
      setItems(data);
    } catch {
      setError("Failed to load inventory data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return items;
    return items.filter((it) => it.name.toLowerCase().includes(term));
  }, [items, searchTerm]);

  const createItem = useCallback(
    async (payload) => {
      setError("");
      setSuccess("");
      try {
        await createInventoryItem(payload);
        setSuccess("Item added successfully!");
        await fetchAll();
        return true;
      } catch (err) {
        setError(err.response?.data?.message || "Error saving item");
        return false;
      }
    },
    [fetchAll]
  );

  const updateItem = useCallback(
    async (id, payload) => {
      setError("");
      setSuccess("");
      try {
        await updateInventoryItem(id, payload);
        setSuccess("Item updated successfully!");
        await fetchAll();
        return true;
      } catch (err) {
        setError(err.response?.data?.message || "Error saving item");
        return false;
      }
    },
    [fetchAll]
  );

  const removeItem = useCallback(
    async (id) => {
      setError("");
      setSuccess("");
      try {
        await deleteInventoryItem(id);
        setSuccess("Item deleted successfully!");
        await fetchAll();
        return true;
      } catch {
        setError("Error deleting item");
        return false;
      }
    },
    [fetchAll]
  );

  const exportCsv = useCallback(
    async ({ filtered = false } = {}) => {
      try {
        await downloadInventoryCsv({ filtered, search: searchTerm });
        return true;
      } catch {
        setError("Error exporting inventory");
        return false;
      }
    },
    [searchTerm]
  );

  return {
    items,
    filtered,
    loading,
    error,
    success,
    setError,
    setSuccess,
    searchTerm,
    setSearchTerm,
    hasActiveFilter: Boolean(searchTerm.trim()),
    refresh: fetchAll,
    createItem,
    updateItem,
    removeItem,
    exportCsv,
  };
}
