import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import EmptyState from "../shared/EmptyState";

export default function WasteTrendChart({ data }) {
  if (!data || data.length === 0) return <EmptyState title="No data" message="" />;

  const chartData = data.map((d) => ({
    date: d.date ? new Date(d.date).toLocaleDateString() : "",
    quantity: d.quantity ?? 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="wasteTrendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-red)" stopOpacity={0.4} />
            <stop offset="100%" stopColor="var(--accent-red)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 6"
          vertical={false}
          stroke="var(--border-color)"
        />
        <XAxis
          dataKey="date"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-heading)" }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-heading)" }}
          width={36}
        />
        <Tooltip
          contentStyle={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-color)",
            borderRadius: 12,
            color: "var(--text-primary)",
            boxShadow: "var(--shadow-elev)",
            fontSize: 12,
          }}
          cursor={{ stroke: "var(--accent-gold)", strokeWidth: 1, strokeDasharray: "3 3" }}
        />
        <Area
          type="monotone"
          dataKey="quantity"
          stroke="var(--accent-red)"
          strokeWidth={2.5}
          fill="url(#wasteTrendFill)"
          dot={{ r: 4, fill: "var(--accent-red)", stroke: "var(--bg-secondary)", strokeWidth: 2 }}
          activeDot={{ r: 6 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
