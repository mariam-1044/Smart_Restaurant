import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import EmptyState from "../shared/EmptyState";

const COLORS = [
  "var(--accent-red)",
  "var(--accent-gold)",
  "var(--accent-green)",
  "var(--accent-blue)",
  "#A78BFA",
  "#F472B6",
  "#06B6D4",
  "#F59E0B",
];

export default function WasteByIngredientChart({ data }) {
  if (!data || data.length === 0) return <EmptyState title="No data" message="" />;

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 6"
          vertical={false}
          stroke="var(--border-color)"
        />
        <XAxis
          dataKey="ingredientName"
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
          cursor={{ fill: "rgba(155,226,45,0.08)" }}
        />
        <Bar dataKey="quantity" radius={[8, 8, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
