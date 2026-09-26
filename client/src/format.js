export const PAYMENT_TYPES = [
  { value: 'aidat', label: 'Aidat' },
  { value: 'salma', label: 'Salma' },
  { value: 'dergi', label: 'Dergi' },
  { value: 'kitap', label: 'Kitap' },
  { value: 'diger', label: 'Diğer' },
];
export const typeLabel = (v) => PAYMENT_TYPES.find((t) => t.value === v)?.label ?? v;

export const METHODS = [
  { value: 'nakit', label: 'Nakit' },
  { value: 'iban', label: 'IBAN' },
];
export const methodLabel = (v) => METHODS.find((m) => m.value === v)?.label ?? '';

export const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

const money = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' });
export const formatMoney = (n) => money.format(Number(n) || 0);

/** '2026-09-01' -> 'Eylül 2026' */
export function formatMonth(d) {
  if (!d) return '';
  const [y, m] = d.split('-');
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

/** '2026-09-26' -> '26.09.2026' */
export function formatDate(d) {
  if (!d) return '';
  const [y, m, day] = d.slice(0, 10).split('-');
  return `${day}.${m}.${y}`;
}

/** ISO timestamp -> '26.09.2026 14:05' (local time) */
export function formatDateTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const currentMonth = () => todayISO().slice(0, 7) + '-01';

/** Sum amounts, total + per type. */
export function breakdown(payments) {
  const byType = {};
  let total = 0;
  // Work in cents to avoid floating point drift.
  for (const p of payments) {
    const cents = Math.round(p.amount * 100);
    total += cents;
    byType[p.type] = (byType[p.type] || 0) + cents;
  }
  for (const k in byType) byType[k] /= 100;
  return { total: total / 100, byType, count: payments.length };
}
