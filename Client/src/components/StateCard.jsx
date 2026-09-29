export default function StatCard({ title, value }) {
  return (
    <div className="stat-card">
      <h4>{title}</h4>
      <span>{value}</span>
    </div>
  );
}