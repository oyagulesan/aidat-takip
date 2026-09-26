import { PAYMENT_TYPES, formatMoney } from '../format.js';

/** Total amount plus per-payment-type split. */
export default function Breakdown({ total, byType, count, title = 'Toplam' }) {
  return (
    <div className="breakdown">
      <div className="breakdown-total">
        <span className="muted">{title}</span>
        <strong>{formatMoney(total)}</strong>
        {count !== undefined && <span className="muted small">{count} ödeme</span>}
      </div>
      <div className="breakdown-types">
        {PAYMENT_TYPES.map((t) => (
          <div key={t.value} className={`breakdown-type ${byType[t.value] ? '' : 'zero'}`}>
            <span className={`badge type-${t.value}`}>{t.label}</span>
            <span>{formatMoney(byType[t.value] || 0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
