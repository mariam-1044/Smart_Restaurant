import DashboardLayout from "../layouts/DashboardLayout";
import { FaFileDownload, FaPrint, FaSyncAlt } from "react-icons/fa";
import { useEffect, useState } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { fetchDashboardStats } from "../api/dashboardApi";
import { confirmOrder } from "../api/ordersApi";
import { useToast } from "../components/toast/ToastContext";
import PageHeader from "../components/shared/PageHeader";
import Card from "../components/shared/Card";
import Button from "../components/shared/Button";
import Badge from "../components/shared/Badge";

const EGP = (n) => `${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} EGP`;

const STATUS_TONE = {
  completed: "success",
  pending: "warning",
  preparing: "warning",
  cancelled: "danger",
};

export default function Report() {
  const toast = useToast();
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({
    totalRevenue: 0,
    totalPaid: 0,
    totalOrders: 0,
    avgOrderValue: 0,
    pendingOrders: 0,
    netProfit: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [confirmingId, setConfirmingId] = useState(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const stats = await fetchDashboardStats();
      const fin = stats?.financials || {};
      const revenue = Number(fin.totalRevenue || 0);
      setSummary({
        totalRevenue: revenue,
        totalPaid: Number(fin.totalPaid || 0),
        totalOrders: Number(fin.totalOrders || 0),
        avgOrderValue: Number(fin.averageOrderValue ?? fin.avgOrderValue ?? 0),
        pendingOrders: Number(fin.pendingOrders || 0),
        netProfit: Math.round(revenue * 0.4),
      });
      setTransactions(Array.isArray(stats?.transactions) ? stats.transactions : []);
    } catch (err) {
      console.error("Error fetching report data:", err);
      setError("Couldn't load report data right now. Try refreshing in a moment.");
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (id) => {
    setConfirmingId(id);
    try {
      await confirmOrder(id);
      toast.success("Order confirmed — it now counts towards sales and reports.");
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not confirm order.");
    } finally {
      setConfirmingId(null);
    }
  };

  const handlePrint = () => window.print();

  const handleExportPDF = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const element = document.getElementById("report-content");
      if (!element) throw new Error("report-content not found");
      const original = { bg: element.style.backgroundColor, color: element.style.color };
      element.classList.add("report-pdf-mode");
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: "#FFFFFF", logging: false });
      element.classList.remove("report-pdf-mode");
      element.style.backgroundColor = original.bg;
      element.style.color = original.color;
      const imgData = canvas.toDataURL("image/png");
      const pageWidthMm = 210;
      const pageHeightMm = (canvas.height / canvas.width) * pageWidthMm;
      const pdf = new jsPDF({
        unit: "mm",
        format: [pageWidthMm, pageHeightMm],
        orientation: pageHeightMm > pageWidthMm ? "portrait" : "landscape",
      });
      pdf.addImage(imgData, "PNG", 0, 0, pageWidthMm, pageHeightMm);
      const d = new Date();
      const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      pdf.save(`geatsu-report-${stamp}.pdf`);
      toast.success("PDF exported successfully");
    } catch (err) {
      console.error("PDF export failed:", err);
      toast.error("Could not export PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="reports-container">
        <PageHeader
          kicker="Reports"
          title="Sales Reports"
          subtitle="A detailed view of your restaurant's financial performance — every figure is read live from the database."
          actions={
            <>
              <Button variant="secondary" iconLeft={<FaSyncAlt />} onClick={load} disabled={loading}>Refresh</Button>
              <Button variant="secondary" iconLeft={<FaPrint />} onClick={handlePrint}>Print</Button>
              <Button iconLeft={<FaFileDownload />} loading={isExporting} onClick={handleExportPDF}>
                {isExporting ? "Generating…" : "Export PDF"}
              </Button>
            </>
          }
        />

        {error && <div className="report-error">{error}</div>}

        <div id="report-content" className="report-content">
          <div className="summary-grid">
            <Card padding="p-5" className="summary-item-card"><Stat label="Total Revenue" value={EGP(summary.totalRevenue)} /></Card>
            <Card padding="p-5" className="summary-item-card"><Stat label="Total Paid by Customers" value={EGP(summary.totalPaid)} accent="green" /></Card>
            <Card padding="p-5" className="summary-item-card"><Stat label="Completed Orders" value={summary.totalOrders} /></Card>
            <Card padding="p-5" className="summary-item-card"><Stat label="Avg. Order Value" value={EGP(summary.avgOrderValue)} /></Card>
            <Card padding="p-5" className="summary-item-card"><Stat label="Est. Net Profit" value={`+ ${EGP(summary.netProfit)}`} accent="green" /></Card>
          </div>

          <Card padding="p-6" className="report-table-wrap">
            <div className="report-table-head">
              <h3 className="report-table-title">Recent Transactions</h3>
              {summary.pendingOrders > 0 && (
                <Badge tone="warning">{summary.pendingOrders} pending — confirm to record</Badge>
              )}
            </div>
            {loading ? (
              <p className="muted">Loading transactions…</p>
            ) : transactions.length === 0 ? (
              <p className="muted">No transactions yet. Orders placed in the POS or online will show up here.</p>
            ) : (
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx._id}>
                      <td><strong>#{tx._id.slice(-6)}</strong></td>
                      <td>{tx.createdAt ? new Date(tx.createdAt).toLocaleString() : "—"}</td>
                      <td>{tx.customerName || "Walk-in"}</td>
                      <td className="items-cell">{tx.itemsLabel}</td>
                      <td>{EGP(tx.total)}</td>
                      <td>
                        <Badge tone={tx.isPaid ? "success" : "neutral"} size="sm">
                          {tx.isPaid ? "Paid" : "Unpaid"}
                        </Badge>
                      </td>
                      <td>
                        <Badge tone={STATUS_TONE[tx.status] || "neutral"} size="sm">
                          {tx.status}
                        </Badge>
                      </td>
                      <td>
                        {tx.status === "pending" ? (
                          <Button
                            size="sm"
                            variant="gold"
                            onClick={() => handleConfirm(tx._id)}
                            loading={confirmingId === tx._id}
                          >
                            {confirmingId === tx._id ? "Confirming…" : "Confirm"}
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      </div>

      <style>{`
        .reports-container { padding: 28px; }
        .report-error {
          padding: 12px 16px; background: var(--status-warn-bg); color: var(--status-warn-fg);
          border: 1px solid rgba(245,158,11,0.32); border-radius: 12px; margin-bottom: 16px; font-size: 13px;
        }
        .summary-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 14px; margin-bottom: 22px;
        }
        .report-table-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
        .report-table-title { margin: 0; font-family: var(--font-heading); font-size: 16px; font-weight: 700; }
        .report-table { width: 100%; border-collapse: collapse; }
        .report-table th {
          text-align: left; padding: 12px 14px; background: var(--bg-elevated); color: var(--text-muted);
          font-family: var(--font-heading); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;
          border-bottom: 1px solid var(--border-color);
        }
        .report-table td { padding: 14px; border-bottom: 1px solid var(--border-color); color: var(--text-secondary); font-size: 14px; }
        .report-table tr:last-child td { border-bottom: 0; }
        .items-cell { max-width: 280px; }
        .muted { color: var(--text-muted); }

        .report-pdf-mode { background: #FFFFFF !important; color: #0F0F10 !important; padding: 24px !important; border-radius: 12px; }
        .report-pdf-mode * { color: #0F0F10 !important; background: transparent !important; border-color: rgba(15,15,16,0.12) !important; box-shadow: none !important; }
        @media print { .geatsu-page-actions { display: none !important; } }
      `}</style>
    </DashboardLayout>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="report-stat">
      <span className="report-stat-label">{label}</span>
      <span className={`report-stat-value ${accent === "green" ? "is-green" : ""}`}>{value}</span>
      <style>{`
        .report-stat { display: flex; flex-direction: column; gap: 6px; }
        .report-stat-label {
          font-family: var(--font-heading); font-size: 11px;
          letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted);
        }
        .report-stat-value {
          font-family: var(--font-heading); font-size: 22px; font-weight: 700;
          color: var(--text-primary); letter-spacing: -0.01em;
        }
        .report-stat-value.is-green { color: var(--accent-green); }
      `}</style>
    </div>
  );
}
