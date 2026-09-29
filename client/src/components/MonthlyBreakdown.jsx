import Breakdown from './Breakdown.jsx';
import { breakdown, formatMonth } from '../format.js';

/** One Breakdown per payment month (oldest first), then the overall total. */
export default function MonthlyBreakdown({ payments }) {
  const byMonth = new Map();
  for (const p of payments) {
    if (!byMonth.has(p.period)) byMonth.set(p.period, []);
    byMonth.get(p.period).push(p);
  }
  const months = [...byMonth.keys()].sort();

  return (
    <div className="monthly-breakdown">
      {months.map((m) => (
        <Breakdown key={m} title={formatMonth(m)} {...breakdown(byMonth.get(m))} />
      ))}
      <div className="monthly-total">
        <Breakdown title="Genel toplam" {...breakdown(payments)} />
      </div>
    </div>
  );
}
