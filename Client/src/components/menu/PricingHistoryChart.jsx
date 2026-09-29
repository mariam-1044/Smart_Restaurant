import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import EmptyState from "../shared/EmptyState";

export default function PricingHistoryChart({ history }) {
  if (!history || history.length === 0) {
    return <EmptyState title="No price changes yet." message="" />;
  }

  const data = history.map(h => ({
    price: h.price,
    changedAt: h.changedAt ? new Date(h.changedAt).toLocaleDateString() : ""
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="changedAt" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="price" stroke="#4f46e5" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}