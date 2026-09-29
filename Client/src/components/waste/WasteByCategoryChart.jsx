import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import EmptyState from "../shared/EmptyState";

const COLORS = [
  "#D72638",
  "#C9A227",
  "#10B981",
  "#3B82F6",
  "#A78BFA",
  "#F472B6",
];

export default function WasteByCategoryChart({ data }) {
  if (!data || data.length === 0) return <EmptyState title="No data" message="" />;

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={data}
          dataKey="quantity"
          nameKey="category"
          cx="50%"
          cy="50%"
          innerRadius={45}
          outerRadius={85}
          paddingAngle={2}
          stroke="var(--bg-card)"
          strokeWidth={2}
        >
          {data.map((_, idx) => (
            <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-color)",
            borderRadius: 12,
            color: "var(--text-primary)",
            boxShadow: "var(--shadow-elev)",
            fontSize: 12,
          }}
        />
        <Legend
          iconType="circle"
          wrapperStyle={{
            fontSize: 12,
            fontFamily: "var(--font-heading)",
            color: "var(--text-secondary)",
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
