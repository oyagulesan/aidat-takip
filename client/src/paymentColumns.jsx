import { formatDate, formatDateTime, formatMoney, formatMonth, methodLabel, typeLabel } from './format.js';

/** Column definitions shared by every payments table. */
export function paymentColumns({ showMember = true, showDelivery = true } = {}) {
  const cols = [
    {
      key: 'created_at',
      label: 'Giriş tarihi',
      value: (r) => r.created_at,
      text: (r) => formatDateTime(r.created_at).slice(0, 10),
      render: (r) => formatDateTime(r.created_at),
    },
  ];
  if (showMember) cols.push({ key: 'member_name', label: 'İsim' });
  cols.push(
    {
      key: 'period',
      label: 'Ay / Yıl',
      text: (r) => formatMonth(r.period),
    },
    {
      key: 'type',
      label: 'Tip',
      text: (r) => typeLabel(r.type),
      render: (r) => (
        <>
          <span className={`badge type-${r.type}`}>{typeLabel(r.type)}</span>
          {r.type_description && <span className="muted small"> {r.type_description}</span>}
        </>
      ),
    },
    {
      key: 'amount',
      label: 'Miktar',
      align: 'right',
      text: (r) => formatMoney(r.amount),
    },
    {
      key: 'method',
      label: 'Ödeme şekli',
      value: (r) => methodLabel(r.method),
    },
    {
      key: 'description',
      label: 'Açıklama',
      render: (r) => <span className="desc">{r.description}</span>,
    },
  );
  if (showDelivery) {
    cols.push({
      key: 'delivery_date',
      label: 'Teslimat',
      text: (r) => (r.delivery_date ? formatDate(r.delivery_date) : 'Teslim edilmedi'),
      render: (r) =>
        r.delivery_date ? (
          <span className="badge delivered">{formatDate(r.delivery_date)}</span>
        ) : (
          <span className="badge pending">Teslim edilmedi</span>
        ),
    });
  }
  return cols;
}
