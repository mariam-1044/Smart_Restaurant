import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import api from "../api/axios";
import LoadingState from "../components/shared/LoadingState";
import EmptyState   from "../components/shared/EmptyState";
import ErrorState   from "../components/shared/ErrorState";

export default function InventoryDetail() {
  const { id } = useParams();
  const [state, setState] = useState("loading");
  const [ing, setIng] = useState(null);

  useEffect(() => {
    let active = true;
    api.get(`/inventory/${id}`)
      .then(r => { if (!active) return; setIng(r.data.data ?? r.data); setState("ready"); })
      .catch(err => { if (!active) return; setState(err.response?.status === 404 ? "missing" : "error"); });
    return () => { active = false; };
  }, [id]);

  return (
    <DashboardLayout>
      <div className="p-6">
        <Link to="/inventory" className="text-blue-600 text-sm">← Back to inventory</Link>
        {state === "loading" && <LoadingState message="Loading ingredient…" />}
        {state === "missing" && <EmptyState title="Item no longer available" message="This ingredient may have been deleted." />}
        {state === "error"   && <ErrorState message="Failed to load ingredient." />}
        {state === "ready" && ing && (
          <div className="mt-4 bg-white rounded shadow p-6 space-y-2">
            <h1 className="text-2xl font-semibold">{ing.name}</h1>
            <p>Quantity: {ing.quantity} {ing.unit}</p>
            <p>Min stock: {ing.minStock} {ing.unit}</p>
            <p>Cost per unit: ${(ing.costPerUnit ?? 0).toFixed(2)}</p>
            <p>Expiry: {ing.expiryDate ? new Date(ing.expiryDate).toLocaleDateString() : "—"}</p>
            <p>Waste so far: {ing.wasteQuantity ?? 0} {ing.unit}</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}