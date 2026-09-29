import React, { useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { FaTrash, FaEdit } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import useInventory from "../hooks/useInventory";
import PageHeader from "../components/shared/PageHeader";
import Card from "../components/shared/Card";
import Badge from "../components/shared/Badge";
import Button from "../components/shared/Button";
import Input from "../components/shared/Input";

const initialForm = {
  name: "",
  quantity: 0,
  unit: "kg",
  minStock: 0,
  expiryDate: "",
  costPerUnit: 0,
};

export default function Inventory() {
  const { user } = useAuth();
  const {
    items,
    filtered,
    loading,
    error,
    success,
    setError,
    searchTerm,
    setSearchTerm,
    hasActiveFilter,
    createItem,
    updateItem,
    removeItem,
    exportCsv,
  } = useInventory();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);

  const setFilteredItems = () => {};

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "quantity" || name === "minStock" || name === "costPerUnit"
          ? parseFloat(value)
          : value,
    }));
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormData(initialForm);
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      minStock: item.minStock,
      expiryDate: item.expiryDate
        ? new Date(item.expiryDate).toISOString().split("T")[0]
        : "",
      costPerUnit: item.costPerUnit || 0,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const ok = editingItem
      ? await updateItem(editingItem._id, formData)
      : await createItem(formData);
    setSubmitting(false);
    if (ok) setIsModalOpen(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this item?")) return;
    await removeItem(id);
  };

  const getStatus = (item) => {
    const expiryDate = new Date(item.expiryDate);
    const today = new Date();
    const days = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
    if (days < 0) return { tone: "danger", label: "Expired" };
    if (days <= 7) return { tone: "warning", label: "Near Expiry" };
    if (item.quantity <= item.minStock) return { tone: "warning", label: "Low Stock" };
    return { tone: "success", label: "In Stock" };
  };

  return (
    <DashboardLayout
      inventoryItems={items}
      setFilteredItems={setFilteredItems}
      onAddItem={openAddModal}
      onExport={() => exportCsv()}
      onExportFiltered={() => exportCsv({ filtered: true })}
      hasActiveFilter={hasActiveFilter}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
    >
      <div className="inventory-container">
        <PageHeader
          kicker="Stockroom"
          title="Inventory"
          subtitle="Track ingredient levels, expiry windows, and waste signals in real time."
        />

        {error && (
          <div className="alert alert-error">
            {error}
            <button className="alert-close" onClick={() => setError("")}>×</button>
          </div>
        )}
        {success && <div className="alert alert-success">{success}</div>}

        <Card padding="p-0" className="inventory-table-card geatsu-inventory-card">
          <div className="inventory-table-wrap">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Quantity</th>
                  <th>Unit</th>
                  <th>Min. Stock</th>
                  <th>Expiry</th>
                  <th>Status</th>
                  {user?.role === "admin" && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {loading && items.length === 0 ? (
                  <tr>
                    <td colSpan={user?.role === "admin" ? 7 : 6} className="inv-empty">
                      Loading inventory…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={user?.role === "admin" ? 7 : 6} className="inv-empty">
                      No items found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => {
                    const status = getStatus(item);
                    return (
                      <tr key={item._id}>
                        <td className="item-name">{item.name}</td>
                        <td>{item.quantity}</td>
                        <td>{item.unit}</td>
                        <td>{item.minStock}</td>
                        <td>{item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : "N/A"}</td>
                        <td>
                          <Badge tone={status.tone} glow={status.tone !== "success"}>
                            {status.label}
                          </Badge>
                        </td>
                        {user?.role === "admin" && (
                          <td className="actions-cell">
                            <button className="btn-icon edit" onClick={() => openEditModal(item)} title="Edit">
                              <FaEdit />
                            </button>
                            <button className="btn-icon delete" onClick={() => handleDelete(item._id)} title="Delete">
                              <FaTrash />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content geatsu-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingItem ? "Edit Item" : "Add New Item"}</h3>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="inventory-form">
              <div className="form-grid">
                <Input
                  label="Item Name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
                <Input
                  label="Quantity"
                  type="number"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleInputChange}
                  required
                  min="0"
                />
                <div className="form-group">
                  <label className="settings-label">Unit</label>
                  <select
                    className="form-select settings-select"
                    name="unit"
                    value={formData.unit}
                    onChange={handleInputChange}
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="l">l</option>
                    <option value="ml">ml</option>
                    <option value="pcs">pcs</option>
                  </select>
                </div>
                <Input
                  label="Min. Stock"
                  type="number"
                  name="minStock"
                  value={formData.minStock}
                  onChange={handleInputChange}
                  required
                  min="0"
                />
                <Input
                  label="Expiry Date"
                  type="date"
                  name="expiryDate"
                  value={formData.expiryDate}
                  onChange={handleInputChange}
                  required
                />
                <Input
                  label="Cost Per Unit (EGP)"
                  type="number"
                  name="costPerUnit"
                  value={formData.costPerUnit}
                  onChange={handleInputChange}
                  required
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="modal-footer">
                <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={submitting}>
                  {submitting ? "Saving…" : editingItem ? "Update Item" : "Add Item"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .inventory-container { padding: 28px; }

        .alert {
          padding: 12px 16px; border-radius: 12px; margin-bottom: 18px;
          font-family: var(--font-body); font-size: 14px;
          display: flex; align-items: center; justify-content: space-between;
          border: 1px solid var(--border-color);
        }
        .alert-error { background: var(--status-danger-bg); color: var(--status-danger-fg); border-color: rgba(215,38,56,0.32); }
        .alert-success { background: var(--status-success-bg); color: var(--status-success-fg); border-color: rgba(16,185,129,0.32); }
        .alert-close {
          background: transparent; border: 0; color: inherit; font-size: 18px; cursor: pointer;
        }

        .geatsu-inventory-card { padding: 0; overflow: hidden; }
        .inventory-table-wrap { overflow-x: auto; }
        .inventory-table { width: 100%; border-collapse: collapse; }
        .inventory-table th {
          text-align: left;
          padding: 14px 18px;
          background: var(--bg-elevated);
          color: var(--text-muted);
          font-family: var(--font-heading);
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          border-bottom: 1px solid var(--border-color);
        }
        .inventory-table td {
          padding: 14px 18px;
          border-bottom: 1px solid var(--border-color);
          color: var(--text-secondary);
          font-size: 14px;
        }
        .inventory-table tr:last-child td { border-bottom: 0; }
        .item-name { font-weight: 600; color: var(--text-primary); font-family: var(--font-heading); }
        .actions-cell { display: flex; gap: 8px; }
        .btn-icon {
          background: transparent;
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          width: 32px; height: 32px;
          border-radius: 8px;
          cursor: pointer;
          display: inline-flex; align-items: center; justify-content: center;
          transition: all 200ms var(--ease-out-expo);
        }
        .btn-icon:hover { transform: translateY(-1px); }
        .btn-icon.edit:hover { color: var(--accent-gold); border-color: var(--accent-gold); }
        .btn-icon.delete:hover { color: var(--accent-red); border-color: var(--accent-red); background: rgba(215,38,56,0.08); }
        .inv-empty { text-align: center; color: var(--text-muted); padding: 32px !important; }

        .geatsu-modal { width: 580px; max-width: 92vw; padding: 22px; }
        .modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color); }
        .modal-header h3 { margin: 0; font-family: var(--font-heading); font-size: 18px; }
        .form-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
        }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .settings-label {
          font-family: var(--font-heading);
          font-size: 12px; font-weight: 600;
          letter-spacing: 0.06em; text-transform: uppercase;
          color: var(--text-muted);
        }
        .settings-select {
          width: 100%;
          background: var(--bg-secondary);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 11px 12px;
          font-size: 14px;
          outline: none;
          transition: border-color 160ms var(--ease-out-expo), box-shadow 160ms var(--ease-out-expo);
        }
        [data-theme="dark"] .settings-select { background: rgba(255,255,255,0.03); }
        .settings-select:focus {
          border-color: var(--accent-gold);
          box-shadow: 0 0 0 3px rgba(155,226,45,0.18);
        }
        .modal-footer {
          display: flex; justify-content: flex-end; gap: 10px;
          margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border-color);
        }
        @media (max-width: 640px) {
          .form-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </DashboardLayout>
  );
}
