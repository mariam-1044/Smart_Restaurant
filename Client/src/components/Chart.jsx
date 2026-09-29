import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

/**
 * Gusteau-themed area chart. Uses CSS variables so it adapts to
 * Gusteau Light + Gusteau Dark automatically.
 */
export default function Chart({ data, color = "var(--accent-active)" }) {
  return (
    <div style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="geatsuColorSales" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.45} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 6"
            vertical={false}
            stroke="var(--border-color)"
          />

          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-heading)" }}
            dy={10}
          />

          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-heading)" }}
            width={36}
          />

          <Tooltip
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid var(--border-color)",
              background: "var(--bg-secondary)",
              color: "var(--text-primary)",
              boxShadow: "var(--shadow-elev)",
              fontSize: 12,
            }}
            cursor={{ stroke: "var(--accent-gold)", strokeWidth: 1, strokeDasharray: "3 3" }}
          />

          <Area
            type="monotone"
            dataKey="sales"
            stroke={color}
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#geatsuColorSales)"
            activeDot={{ r: 6, fill: color, stroke: "var(--bg-secondary)", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
