import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function ForecastChart({ data }) {
  if (!data || data.length === 0) return null;

  const chartData = data.map((d) => ({
    date: d.date ? new Date(d.date).toLocaleDateString() : "",
    predictedQuantity: d.predictedQuantity ?? 0,
    lowerBound: d.lowerBound ?? 0,
    upperBound: d.upperBound ?? 0,
    band: (d.upperBound ?? 0) - (d.lowerBound ?? 0),
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={chartData} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="forecastBand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-gold)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--accent-gold)" stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="forecastLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--accent-red)" />
            <stop offset="100%" stopColor="var(--accent-gold)" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="var(--border-color)" />
        <XAxis
          dataKey="date"
          axisLine={false}
          tickLine={false}
          tick={{
            fill: "var(--text-muted)",
            fontSize: 11,
            fontFamily: "var(--font-heading)",
          }}
          dy={8}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{
            fill: "var(--text-muted)",
            fontSize: 11,
            fontFamily: "var(--font-heading)",
          }}
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
          cursor={{
            stroke: "var(--accent-gold)",
            strokeWidth: 1,
            strokeDasharray: "3 3",
          }}
        />
        <Area
          type="monotone"
          dataKey="upperBound"
          stroke="none"
          fill="url(#forecastBand)"
        />
        <Line
          type="monotone"
          dataKey="lowerBound"
          stroke="var(--text-muted)"
          strokeDasharray="3 3"
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="predictedQuantity"
          stroke="url(#forecastLine)"
          strokeWidth={2.5}
          dot={{
            r: 4,
            fill: "var(--accent-red)",
            stroke: "var(--bg-secondary)",
            strokeWidth: 2,
          }}
          activeDot={{ r: 6 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
