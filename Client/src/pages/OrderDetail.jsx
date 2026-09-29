import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import api from "../api/axios";
import LoadingState from "../components/shared/LoadingState";
import EmptyState   from "../components/shared/EmptyState";
import ErrorState   from "../components/shared/ErrorState";

export default function OrderDetail() {
  const { id } = useParams();
  const [state, setState] = useState("loading");
  const [order, setOrder] = useState(null);

  useEffect(() => {
    let active = true;
    api.get(`/orders/${id}`)
      .then(r => { if (!active) return; setOrder(r.data.data ?? r.data); setState("ready"); })
      .catch(err => { if (!active) return; setState(err.response?.status === 404 ? "missing" : "error"); });
    return () => { active = false; };
  }, [id]);

  return (
    <DashboardLayout>
      <div className="p-6">
        <Link to="/sales" className="text-blue-600 text-sm">← Back to sales</Link>
        {state === "loading" && <LoadingState message="Loading order…" />}
        {state === "missing" && <EmptyState title="Order no longer available" message="" />}
        {state === "error"   && <ErrorState message="Failed to load order." />}
        {state === "ready" && order && (
          <div className="mt-4 bg-white rounded shadow p-6 space-y-2">
            <h1 className="text-2xl font-semibold">Order #{String(order._id).slice(-6)}</h1>
            <p>Total: ${(order.totalPrice ?? 0).toFixed(2)}</p>
            {order.tableNumber && <p>Table: {order.tableNumber}</p>}
            <p>Status: {order.status}</p>
            <p>Placed: {new Date(order.createdAt).toLocaleString()}</p>
            <h3 className="font-semibold pt-2">Items</h3>
            <ul className="text-sm list-disc pl-5">
              {(order.items ?? []).map((it, i) => (
                <li key={i}>{it.dish?.name ?? it.dish} × {it.quantity} — ${it.priceAtTime?.toFixed?.(2) ?? it.priceAtTime}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}