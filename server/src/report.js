import ExcelJS from 'exceljs';

const TYPES = [
  ['aidat', 'Aidat'],
  ['salma', 'Salma'],
  ['dergi', 'Dergi'],
  ['kitap', 'Kitap'],
  ['diger', 'Diğer'],
];
const TYPE_LABEL = Object.fromEntries(TYPES);
const METHOD_LABEL = { nakit: 'Nakit', iban: 'IBAN' };
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

const MONEY = '#,##0.00 "₺"';
const DATE = 'dd.mm.yyyy';
const DATETIME = 'dd.mm.yyyy hh:mm';
const MONTH_FMT = 'mmmm yyyy';

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F6F5C' } };
const MONTH_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F1ED' } };
const TOTAL_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F4F7' } };

const monthKey = (iso) => iso.slice(0, 7); // 'YYYY-MM'
const monthLabel = (key) => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
/** 'YYYY-MM-DD' -> Date at UTC midnight, which Excel shows as that calendar day. */
const dateOnly = (iso) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);
/** Timestamp -> Date whose UTC fields are the server's local wall clock (Excel has no time zones). */
const wallClock = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000);
const localDateISO = (d) => wallClock(d).toISOString().slice(0, 10);
const cents = (n) => Math.round(n * 100);

function groupBy(items, keyFn) {
  const map = new Map();
  for (const it of items) {
    const k = keyFn(it);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(it);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function setupSheet(ws, columns) {
  ws.columns = columns.map(({ header, key, width, numFmt }) => ({ header, key, width, style: numFmt ? { numFmt } : {} }));
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  head.fill = HEADER_FILL;
  head.alignment = { vertical: 'middle' };
  head.height = 20;
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.properties.outlineProperties = { summaryBelow: true };
}

function monthHeader(ws, label, colCount) {
  const row = ws.addRow([label]);
  row.font = { bold: true, size: 12 };
  for (let c = 1; c <= colCount; c++) row.getCell(c).fill = MONTH_FILL;
  return row;
}

function totalRow(ws, values, colCount, { grand = false } = {}) {
  const row = ws.addRow(values);
  row.font = { bold: true };
  for (let c = 1; c <= colCount; c++) {
    row.getCell(c).fill = TOTAL_FILL;
    row.getCell(c).border = { top: { style: grand ? 'double' : 'thin' } };
  }
  return row;
}

/* --------------------------------------------------------------- sheets */

function paymentsSheet(wb, payments) {
  const ws = wb.addWorksheet('Ödemeler');
  const columns = [
    { header: 'Ay / Yıl', key: 'period', width: 16, numFmt: MONTH_FMT },
    { header: 'İsim', key: 'member', width: 24 },
    { header: 'Tip', key: 'type', width: 10 },
    { header: 'Diğer açıklaması', key: 'type_description', width: 18 },
    { header: 'Miktar', key: 'amount', width: 14, numFmt: MONEY },
    { header: 'Ödeme şekli', key: 'method', width: 12 },
    { header: 'Açıklama', key: 'description', width: 32 },
    { header: 'Giriş tarihi', key: 'created_at', width: 17, numFmt: DATETIME },
    { header: 'Teslimat tarihi', key: 'delivery_date', width: 15, numFmt: DATE },
  ];
  setupSheet(ws, columns);
  const n = columns.length;

  let grand = 0;
  for (const [key, rows] of groupBy(payments, (p) => monthKey(p.period))) {
    monthHeader(ws, monthLabel(key), n);
    rows.sort((a, b) => a.member_name.localeCompare(b.member_name, 'tr') || a.created_at - b.created_at);
    for (const p of rows) {
      const row = ws.addRow({
        period: dateOnly(p.period),
        member: p.member_name,
        type: TYPE_LABEL[p.type],
        type_description: p.type_description || '',
        amount: p.amount,
        method: METHOD_LABEL[p.method] || '',
        description: p.description || '',
        created_at: wallClock(p.created_at),
        delivery_date: p.delivery_date ? dateOnly(p.delivery_date) : 'Teslim edilmedi',
      });
      row.outlineLevel = 1;
    }
    const sum = rows.reduce((s, p) => s + cents(p.amount), 0);
    grand += sum;
    const t = totalRow(ws, { member: `${monthLabel(key)} toplamı (${rows.length} ödeme)`, amount: sum / 100 }, n);
    t.getCell('amount').numFmt = MONEY;
    ws.addRow([]);
  }
  const g = totalRow(ws, { member: `GENEL TOPLAM (${payments.length} ödeme)`, amount: grand / 100 }, n, { grand: true });
  g.getCell('amount').numFmt = MONEY;
}

function deliveriesSheet(wb, deliveries, payments) {
  const ws = wb.addWorksheet('Teslimatlar');
  const columns = [
    { header: 'Teslimat tarihi', key: 'date', width: 15, numFmt: DATE },
    { header: 'Açıklama', key: 'description', width: 30 },
    { header: 'Ödeme adedi', key: 'count', width: 12 },
    ...TYPES.map(([k, label]) => ({ header: label, key: k, width: 13, numFmt: MONEY })),
    { header: 'Toplam', key: 'total', width: 15, numFmt: MONEY },
  ];
  setupSheet(ws, columns);
  const n = columns.length;

  const byDelivery = new Map(deliveries.map((d) => [d.id, []]));
  for (const p of payments) if (p.delivery_id) byDelivery.get(p.delivery_id)?.push(p);

  const sumOf = (list) => {
    const out = { count: list.length, total: 0 };
    for (const [k] of TYPES) out[k] = 0;
    for (const p of list) {
      out[p.type] += cents(p.amount);
      out.total += cents(p.amount);
    }
    for (const k of ['total', ...TYPES.map(([k]) => k)]) out[k] /= 100;
    return out;
  };
  const moneyCells = (row) => [...TYPES.map(([k]) => k), 'total'].forEach((k) => (row.getCell(k).numFmt = MONEY));

  for (const [key, list] of groupBy(deliveries, (d) => monthKey(d.delivery_date))) {
    monthHeader(ws, monthLabel(key), n);
    list.sort((a, b) => a.delivery_date.localeCompare(b.delivery_date) || a.id - b.id);
    for (const d of list) {
      const row = ws.addRow({ date: dateOnly(d.delivery_date), description: d.description || '', ...sumOf(byDelivery.get(d.id)) });
      row.outlineLevel = 1;
    }
    const monthPayments = list.flatMap((d) => byDelivery.get(d.id));
    moneyCells(totalRow(ws, { description: `${monthLabel(key)} toplamı (${list.length} teslimat)`, ...sumOf(monthPayments) }, n));
    ws.addRow([]);
  }
  const delivered = payments.filter((p) => p.delivery_id);
  moneyCells(totalRow(ws, { description: `GENEL TOPLAM (${deliveries.length} teslimat)`, ...sumOf(delivered) }, n, { grand: true }));

  const pending = payments.filter((p) => !p.delivery_id);
  if (pending.length) {
    ws.addRow([]);
    const row = ws.addRow({ description: 'Henüz teslim edilmemiş', ...sumOf(pending) });
    row.font = { italic: true };
    moneyCells(row);
  }
}

function summarySheet(wb, payments) {
  const ws = wb.addWorksheet('Aylık Özet');
  const columns = [
    { header: 'Ay / Yıl', key: 'period', width: 16, numFmt: MONTH_FMT },
    { header: 'Ödeme adedi', key: 'count', width: 12 },
    ...TYPES.map(([k, label]) => ({ header: label, key: k, width: 13, numFmt: MONEY })),
    { header: 'Toplam', key: 'total', width: 15, numFmt: MONEY },
    { header: 'Teslim edilen', key: 'delivered', width: 15, numFmt: MONEY },
    { header: 'Teslim edilmemiş', key: 'pending', width: 16, numFmt: MONEY },
  ];
  setupSheet(ws, columns);
  const n = columns.length;
  const keys = [...TYPES.map(([k]) => k), 'total', 'delivered', 'pending'];

  const sumOf = (list) => {
    const out = { count: list.length };
    for (const k of keys) out[k] = 0;
    for (const p of list) {
      const c = cents(p.amount);
      out[p.type] += c;
      out.total += c;
      out[p.delivery_id ? 'delivered' : 'pending'] += c;
    }
    for (const k of keys) out[k] /= 100;
    return out;
  };

  for (const [key, list] of groupBy(payments, (p) => monthKey(p.period))) {
    ws.addRow({ period: dateOnly(`${key}-01`), ...sumOf(list) });
  }
  const g = totalRow(ws, { period: 'TOPLAM', ...sumOf(payments) }, n, { grand: true });
  keys.forEach((k) => (g.getCell(k).numFmt = MONEY));
  ws.addRow([]);
  ws.addRow(['Ay / Yıl, ödemenin ait olduğu aydır (giriş tarihi değil).']).font = { italic: true, color: { argb: 'FF6B7482' } };
}

const PAID_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F1ED' } };
const DEBT_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE2E0' } };
const OUT_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F4F7' } };
const SHORT_MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

/** 'YYYY-MM' -> next 'YYYY-MM' */
function nextMonth(key) {
  let [y, m] = key.split('-').map(Number);
  if (++m > 12) [y, m] = [y + 1, 1];
  return `${y}-${String(m).padStart(2, '0')}`;
}

/**
 * Member × month matrix of aidat payments. A month is a debt when it lies between the member's
 * start month and min(end month, current month) and has no 'aidat' payment — the same rule as
 * the app's "eksik aidat".
 */
function aidatDebtSheet(wb, members, payments) {
  const ws = wb.addWorksheet('Aidat Borçları');
  const current = monthKey(localDateISO(new Date()));
  const tracked = members.filter((m) => m.start_month).sort((a, b) => a.name.localeCompare(b.name, 'tr'));

  // Paid aidat per member per month
  const paid = new Map(); // `${memberId}|YYYY-MM` -> amount in cents
  for (const p of payments) {
    if (p.type !== 'aidat') continue;
    const k = `${p.member_id}|${monthKey(p.period)}`;
    paid.set(k, (paid.get(k) || 0) + cents(p.amount));
  }

  const months = [];
  if (tracked.length) {
    const first = tracked.map((m) => monthKey(m.start_month)).sort()[0];
    for (let k = first; k <= current; k = nextMonth(k)) months.push(k);
  }

  const fixed = [
    { header: 'İsim', key: 'name', width: 24 },
    { header: 'Başlangıç', key: 'start', width: 12, numFmt: 'mm.yyyy' },
    { header: 'Bitiş', key: 'end', width: 12, numFmt: 'mm.yyyy' },
    { header: 'Borçlu ay', key: 'debt', width: 10 },
  ];
  setupSheet(ws, [
    ...fixed,
    ...months.map((k) => ({ header: `${SHORT_MONTHS[Number(k.slice(5)) - 1]} ${k.slice(0, 4)}`, key: k, width: 11 })),
  ]);
  ws.views = [{ state: 'frozen', xSplit: fixed.length, ySplit: 1 }];
  ws.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

  const debtPerMonth = Object.fromEntries(months.map((k) => [k, 0]));
  let totalDebt = 0;

  for (const m of tracked) {
    const from = monthKey(m.start_month);
    const to = m.end_month && monthKey(m.end_month) < current ? monthKey(m.end_month) : current;
    const row = ws.addRow({
      name: m.name,
      start: dateOnly(m.start_month),
      end: m.end_month ? dateOnly(m.end_month) : 'Devam',
    });
    let debt = 0;
    for (const k of months) {
      const cell = row.getCell(k);
      cell.alignment = { horizontal: 'center' };
      if (k < from || k > to) {
        cell.fill = OUT_FILL;
        continue;
      }
      const amount = paid.get(`${m.id}|${k}`);
      if (amount) {
        cell.value = amount / 100;
        cell.numFmt = MONEY;
        cell.fill = PAID_FILL;
      } else {
        cell.value = 'Borç';
        cell.fill = DEBT_FILL;
        cell.font = { bold: true, color: { argb: 'FFB3261E' } };
        debt++;
        debtPerMonth[k]++;
      }
    }
    const d = row.getCell('debt');
    d.value = debt;
    d.alignment = { horizontal: 'center' };
    if (debt) d.font = { bold: true, color: { argb: 'FFB3261E' } };
    totalDebt += debt;
  }

  const t = totalRow(ws, { name: 'Borçlu kişi sayısı', debt: totalDebt, ...debtPerMonth }, fixed.length + months.length, { grand: true });
  t.alignment = { horizontal: 'center' };
  t.getCell('name').alignment = { horizontal: 'left' };

  ws.addRow([]);
  const note = (text, fill) => {
    const r = ws.addRow([text]);
    r.font = { italic: true, color: { argb: 'FF6B7482' } };
    if (fill) r.getCell(1).fill = fill;
  };
  note('Tutar: o ay için ödenen aidat', PAID_FILL);
  note('Borç: o ay için aidat ödemesi yok', DEBT_FILL);
  note('Gri: kullanıcının başlangıç–bitiş aralığı dışında', OUT_FILL);
  note(`Bu aya (${monthLabel(current)}) kadar hesaplanmıştır. Sadece "Aidat" tipindeki ödemeler sayılır.`);
}

/**
 * members: rows with id, name, start_month, end_month
 * payments: rows with member_id, member_name, amount, period, type, type_description, description, method,
 *           delivery_id, delivery_date, created_at (Date)
 * deliveries: rows with id, delivery_date, description
 */
export async function buildReport({ members, payments, deliveries }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Aidat Takip';
  wb.created = new Date();
  paymentsSheet(wb, payments);
  deliveriesSheet(wb, deliveries, payments);
  aidatDebtSheet(wb, members, payments);
  summarySheet(wb, payments);
  return wb.xlsx.writeBuffer();
}

export const reportFileName = () => `aidat-rapor-${localDateISO(new Date())}.xlsx`;
