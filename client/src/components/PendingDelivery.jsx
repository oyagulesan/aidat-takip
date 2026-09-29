import { Link } from 'react-router-dom';
import { breakdown, formatMoney } from '../format.js';

const LEVELS = {
  ok: {
    label: 'Teslimat için erken',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M8.5 12.5l2.5 2.5 4.5-5" />
      </>
    ),
  },
  warn: {
    label: 'Teslimat yaklaşıyor',
    icon: (
      <>
        <path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        <path d="M12 9v4M12 17h.01" />
      </>
    ),
  },
  danger: {
    label: 'Teslimat zamanı',
    icon: (
      <>
        <path d="M8.7 3h6.6L21 8.7v6.6L15.3 21H8.7L3 15.3V8.7z" />
        <path d="M12 8v4M12 16h.01" />
      </>
    ),
  },
};

/** Below `warn` is fine, `warn`..`danger` (inclusive) is a heads-up, above `danger` a delivery is due. */
export const pendingLevel = (total, { warn, danger }) => (total > danger ? 'danger' : total >= warn ? 'warn' : 'ok');

/** Admin summary of payments not yet delivered, with a traffic-light hint. */
export default function PendingDelivery({ payments, thresholds }) {
  const { total, count } = breakdown(payments.filter((p) => !p.delivery_id));
  const level = pendingLevel(total, thresholds);
  const { label, icon } = LEVELS[level];

  return (
    <div className={`card pending-delivery level-${level}`}>
      <span className="pd-icon" title={label} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
      </span>
      <div className="pd-body">
        <span className="muted small">Teslim edilmemiş toplam</span>
        <strong className="pd-total">{formatMoney(total)}</strong>
        <span className="small">
          <span className="pd-label">{label}</span>
          <span className="muted"> · {count} ödeme</span>
        </span>
      </div>
      {level !== 'ok' && (
        <Link className="btn btn-small" to="/teslimatlar/yeni">Teslimat girişi</Link>
      )}
    </div>
  );
}
