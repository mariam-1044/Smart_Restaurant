import Chart from "../components/Chart";
import DashboardLayout from "../layouts/DashboardLayout";
import { useState, useEffect } from "react";
import api from "../api/axios";

export default function SalesAnalysis() {
  const [period, setPeriod] = useState("weekly");
  const [chartData, setChartData] = useState([]);
  const [topDishes, setTopDishes] = useState([]);
  const [underperformingDishes, setUnderperformingDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSalesData(period);
  }, [period]);

  const fetchSalesData = async (selectedPeriod) => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get(`/sales/report?period=${selectedPeriod}`);
      if (response.data.success) {
        const stats = response.data.data;

        // Sales trend chart — real revenue buckets from the report.
        const trendEntries = stats.salesTrends ? Object.entries(stats.salesTrends) : [];
        const transformedChartData = trendEntries.length
          ? trendEntries
              .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
              .map(([name, sales]) => ({ name, sales: Math.round(Number(sales) || 0) }))
          : generateDefaultChartData(selectedPeriod);
        setChartData(transformedChartData);

        // Top performing dishes — real revenue from completed orders.
        const dishes = Array.isArray(stats.topDishes) ? stats.topDishes : [];
        if (dishes.length > 0) {
          setTopDishes(dishes.slice(0, 5).map((d) => ({
            name: d.name,
            revenue: Math.round(Number(d.revenue) || 0),
            status: "OK",
          })));

          // Underperformers — lowest-revenue dishes vs. the period's average.
          const avg = dishes.reduce((s, d) => s + (Number(d.revenue) || 0), 0) / dishes.length;
          const bottom = dishes
            .slice()
            .sort((a, b) => (Number(a.revenue) || 0) - (Number(b.revenue) || 0))
            .slice(0, 3)
            .map((d) => {
              const rev = Number(d.revenue) || 0;
              const gapPct = avg > 0 ? Math.round(((rev - avg) / avg) * 100) : 0;
              return { name: d.name, revenue: Math.round(rev), gap: `${gapPct}%` };
            });
          setUnderperformingDishes(bottom.length ? bottom : generateDefaultUnderperforming());
        } else {
          setTopDishes(generateDefaultTopDishes());
          setUnderperformingDishes(generateDefaultUnderperforming());
        }
      }
    } catch (error) {
      console.error("Error fetching sales data:", error);
      setError("Failed to load real-time sales data. Showing default overview.");
      setChartData(generateDefaultChartData(selectedPeriod));
      setTopDishes(generateDefaultTopDishes());
      setUnderperformingDishes(generateDefaultUnderperforming());
    } finally {
      setLoading(false);
    }
  };

  const generateDefaultChartData = (selectedPeriod) => {
    switch (selectedPeriod) {
      case "daily":
        return [
          { name: "12 AM", sales: 100 }, { name: "3 AM", sales: 50 }, { name: "6 AM", sales: 200 },
          { name: "9 AM", sales: 400 }, { name: "12 PM", sales: 600 }, { name: "3 PM", sales: 800 },
          { name: "6 PM", sales: 1000 }, { name: "9 PM", sales: 700 },
        ];
      case "monthly":
        return [
          { name: "Week 1", sales: 5000 }, { name: "Week 2", sales: 6000 },
          { name: "Week 3", sales: 5500 }, { name: "Week 4", sales: 7000 },
        ];
      case "seasonal":
        return [
          { name: "Spring", sales: 10000 }, { name: "Summer", sales: 15000 },
          { name: "Fall", sales: 12000 }, { name: "Winter", sales: 11000 },
        ];
      default: // weekly
        return [
          { name: "Sun", sales: 200 }, { name: "Mon", sales: 350 }, { name: "Tue", sales: 420 },
          { name: "Wed", sales: 400 }, { name: "Thu", sales: 410 }, { name: "Fri", sales: 300 },
          { name: "Sat", sales: 500 },
        ];
    }
  };

  const generateDefaultTopDishes = () => [
    { name: "Chicken Breast", revenue: 13000, status: "OK" },
    { name: "Cheese", revenue: 10020, status: "Low Stock" },
    { name: "Tomato", revenue: 8296, status: "OK" },
  ];

  const generateDefaultUnderperforming = () => [
    { name: "Seafood Pasta", revenue: 1200, gap: "-15%" },
    { name: "Chicken Alfredo", revenue: 900, gap: "-22%" },
    { name: "Greek Moussaka", revenue: 750, gap: "-8%" },
  ];

  return (
    <DashboardLayout>
      <div className="main-chart-card">
        <div className="chart-header">
          <h3>Sales Overview</h3>
          <div className="chart-tabs">
            {["daily", "weekly", "monthly", "seasonal"].map(p => (
              <button
                key={p}
                className={`tab-btn ${period === p ? "active-tab" : ""}`}
                onClick={() => setPeriod(p)}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="chart-body">
          {loading ? <p>Loading chart...</p> : <Chart data={chartData} />}
        </div>
      </div>

      <div className="analysis-grid">
        <div className="table-card">
          <h3>Top Performing Dishes</h3>
          <table className="mini-table">
            <thead>
              <tr><th>Dish</th><th>Revenue</th><th>Status</th></tr>
            </thead>
            <tbody>
              {topDishes.map((dish, index) => (
                <tr key={index}>
                  <td>{dish.name}</td>
                  <td>EGP {dish.revenue.toLocaleString()}</td>
                  <td>
                    <button className={`status-btn ${dish.status.toLowerCase().replace(" ", "-")}`}>
                      {dish.status}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="table-card">
          <h3>Underperforming Dishes</h3>
          <table className="mini-table">
            <thead>
              <tr><th>Dish</th><th>Revenue</th><th>Gap</th></tr>
            </thead>
            <tbody>
              {underperformingDishes.map((dish, index) => (
                <tr key={index}>
                  <td>{dish.name}</td>
                  <td>EGP {dish.revenue.toLocaleString()}</td>
                  <td><span className="gap-text red">{dish.gap}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .main-chart-card { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); }
        .chart-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .chart-tabs { display: flex; gap: 10px; }
        .tab-btn { padding: 8px 16px; border: 1px solid #ddd; background-color: white; cursor: pointer; border-radius: 4px; transition: all 0.3s ease; }
        .tab-btn.active-tab { background-color: #2196F3; color: white; border-color: #2196F3; }
        .chart-body { height: 400px; display: flex; align-items: center; justify-content: center; }
        .analysis-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
        .table-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); }
        .mini-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        .mini-table th { padding: 12px; text-align: left; font-weight: bold; border-bottom: 2px solid #ddd; background: #f5f5f5; }
        .mini-table td { padding: 12px; border-bottom: 1px solid #eee; }
        .status-btn { padding: 4px 12px; border: none; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .status-btn.ok { background-color: #e8f5e9; color: #2e7d32; }
        .status-btn.low-stock { background-color: #fff3e0; color: #e65100; }
        .gap-text.red { color: #d32f2f; font-weight: bold; }
        @media (max-width: 768px) { .analysis-grid { grid-template-columns: 1fr; } .chart-header { flex-direction: column; gap: 15px; } }
      `}</style>
    </DashboardLayout>
  );
}
