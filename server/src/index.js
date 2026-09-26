import express from 'express';
import bcrypt from 'bcryptjs';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { query, withTransaction, migrate } from './db.js';
import { signToken, requireAuth, requireAdmin } from './auth.js';

const PAYMENT_TYPES = ['aidat', 'salma', 'dergi', 'kitap', 'diger'];
const METHODS = ['nakit', 'iban'];

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Express 4 does not catch rejected promises by itself.
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const trimOrNull = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Accepts 'YYYY-MM' or 'YYYY-MM-DD', returns 'YYYY-MM-01' or null. */
function toMonth(value, field, { required = false } = {}) {
  if (value === null || value === undefined || value === '') {
    if (required) throw new HttpError(400, `${field} zorunludur`);
    return null;
  }
  const m = /^(\d{4})-(\d{2})/.exec(String(value));
  if (!m || +m[2] < 1 || +m[2] > 12) throw new HttpError(400, `${field} geçersiz`);
  return `${m[1]}-${m[2]}-01`;
}

const app = express();
app.use(express.json());

/* ---------------------------------------------------------------- auth */

app.post('/api/auth/login', h(async (req, res) => {
  const { username, password } = req.body || {};
  const { rows } = await query('SELECT * FROM members WHERE lower(username) = lower($1)', [String(username || '').trim()]);
  const member = rows[0];
  if (!member || !(await bcrypt.compare(String(password || ''), member.password_hash))) {
    throw new HttpError(401, 'Kullanıcı adı veya şifre hatalı');
  }
  res.json({ token: signToken(member), user: { id: member.id, name: member.name, role: member.role } });
}));

app.use('/api', requireAuth);

app.get('/api/auth/me', (req, res) => res.json({ user: req.user }));

// Every user (admin or not) can change their own password.
app.post('/api/auth/password', h(async (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (typeof new_password !== 'string' || new_password.length < 4) {
    throw new HttpError(400, 'Yeni şifre en az 4 karakter olmalıdır');
  }
  const { rows } = await query('SELECT password_hash FROM members WHERE id = $1', [req.user.id]);
  if (!rows[0] || !(await bcrypt.compare(String(current_password || ''), rows[0].password_hash))) {
    throw new HttpError(400, 'Mevcut şifre hatalı');
  }
  await query('UPDATE members SET password_hash = $2 WHERE id = $1', [req.user.id, await bcrypt.hash(new_password, 10)]);
  res.status(204).end();
}));

/* ------------------------------------------------------------- members */

const MEMBER_COLUMNS = 'id, name, username, role, start_month, end_month, created_at';

/** First day of the current month in the server's local time, e.g. '2026-09-01'. */
function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * Months (as rows of `g.month`) between the member's start month and
 * min(end month, current month) that have no 'aidat' payment.
 * Expects the member aliased as `m` and the current month passed as $1.
 */
const MISSING_AIDAT_FROM = `
  generate_series(m.start_month, LEAST(COALESCE(m.end_month, $1::date), $1::date), interval '1 month') AS g(month)
  WHERE NOT EXISTS (
    SELECT 1 FROM payments p WHERE p.member_id = m.id AND p.type = 'aidat' AND p.period = g.month::date
  )`;

app.get('/api/members', requireAdmin, h(async (req, res) => {
  const { rows } = await query(
    `SELECT ${MEMBER_COLUMNS.split(', ').map((c) => 'm.' + c).join(', ')},
            (SELECT count(*)::int FROM ${MISSING_AIDAT_FROM}) AS missing_count
     FROM members m ORDER BY m.name`,
    [currentMonth()],
  );
  res.json(rows);
}));

// Member info + months with missing aidat. Admins can see anyone, users only themselves.
app.get('/api/members/:id/status', h(async (req, res) => {
  const id = Number(req.params.id);
  if (req.user.role !== 'admin' && req.user.id !== id) throw new HttpError(403, 'Bu işlem için yetkiniz yok');
  const { rows } = await query(`SELECT ${MEMBER_COLUMNS} FROM members WHERE id = $1`, [id]);
  if (!rows[0]) throw new HttpError(404, 'Kullanıcı bulunamadı');
  const missing = await query(
    `SELECT to_char(g.month, 'YYYY-MM-DD') AS month FROM members m, ${MISSING_AIDAT_FROM} AND m.id = $2
     ORDER BY g.month`,
    [currentMonth(), id],
  );
  res.json({ member: rows[0], missing_months: missing.rows.map((r) => r.month) });
}));

function parseMember(body, { isNew }) {
  const name = trimOrNull(body.name);
  const username = trimOrNull(body.username);
  const role = body.role === 'admin' ? 'admin' : 'user';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!name) throw new HttpError(400, 'İsim zorunludur');
  if (!username) throw new HttpError(400, 'Kullanıcı adı zorunludur');
  if (isNew && !password) throw new HttpError(400, 'Şifre zorunludur');
  if (password && password.length < 4) throw new HttpError(400, 'Şifre en az 4 karakter olmalıdır');
  const start_month = toMonth(body.start_month, 'Başlangıç ayı', { required: role === 'user' });
  const end_month = toMonth(body.end_month, 'Bitiş ayı');
  if (start_month && end_month && end_month < start_month) {
    throw new HttpError(400, 'Bitiş ayı başlangıç ayından önce olamaz');
  }
  return { name, username, role, password, start_month, end_month };
}

function uniqueUsername(err) {
  if (err.code === '23505') throw new HttpError(409, 'Bu kullanıcı adı zaten kullanılıyor');
  throw err;
}

app.post('/api/members', requireAdmin, h(async (req, res) => {
  const m = parseMember(req.body || {}, { isNew: true });
  const { rows } = await query(
    `INSERT INTO members (name, username, password_hash, role, start_month, end_month)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${MEMBER_COLUMNS}`,
    [m.name, m.username, await bcrypt.hash(m.password, 10), m.role, m.start_month, m.end_month],
  ).catch(uniqueUsername);
  res.status(201).json(rows[0]);
}));

app.put('/api/members/:id', requireAdmin, h(async (req, res) => {
  const id = Number(req.params.id);
  const m = parseMember(req.body || {}, { isNew: false });
  if (id === req.user.id && m.role !== 'admin') {
    throw new HttpError(400, 'Kendi admin yetkinizi kaldıramazsınız');
  }
  const hash = m.password ? await bcrypt.hash(m.password, 10) : null;
  const { rows } = await query(
    `UPDATE members SET name = $2, username = $3, role = $4, start_month = $5, end_month = $6,
            password_hash = COALESCE($7, password_hash)
     WHERE id = $1 RETURNING ${MEMBER_COLUMNS}`,
    [id, m.name, m.username, m.role, m.start_month, m.end_month, hash],
  ).catch(uniqueUsername);
  if (!rows[0]) throw new HttpError(404, 'Kullanıcı bulunamadı');
  res.json(rows[0]);
}));

app.delete('/api/members/:id', requireAdmin, h(async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) throw new HttpError(400, 'Kendinizi silemezsiniz');
  const { rows } = await query('SELECT count(*)::int AS n FROM payments WHERE member_id = $1', [id]);
  if (rows[0].n > 0) {
    throw new HttpError(409, 'Bu kullanıcının ödemeleri var, silinemez. Bitiş ayı girerek pasife alabilirsiniz.');
  }
  await query('DELETE FROM members WHERE id = $1', [id]);
  res.status(204).end();
}));

/* ------------------------------------------------------------ payments */

const PAYMENT_SELECT = `
  SELECT p.id, p.member_id, m.name AS member_name, p.amount, p.period, p.type, p.type_description,
         p.description, p.method, p.delivery_id, d.delivery_date, p.created_at
  FROM payments p
  JOIN members m ON m.id = p.member_id
  LEFT JOIN deliveries d ON d.id = p.delivery_id`;

// Users only ever see their own payments; admins see everything.
app.get('/api/payments', h(async (req, res) => {
  const where = [];
  const params = [];
  if (req.user.role !== 'admin') {
    params.push(req.user.id);
    where.push(`p.member_id = $${params.length}`);
  }
  if (req.query.undelivered === '1') where.push('p.delivery_id IS NULL');
  if (req.query.member_id) {
    params.push(Number(req.query.member_id));
    where.push(`p.member_id = $${params.length}`);
  }
  const { rows } = await query(
    `${PAYMENT_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY p.created_at DESC`,
    params,
  );
  res.json(rows);
}));

app.get('/api/payments/:id', requireAdmin, h(async (req, res) => {
  const { rows } = await query(`${PAYMENT_SELECT} WHERE p.id = $1`, [Number(req.params.id)]);
  if (!rows[0]) throw new HttpError(404, 'Ödeme bulunamadı');
  res.json(rows[0]);
}));

function parsePayment(body) {
  const member_id = Number(body.member_id);
  if (!Number.isInteger(member_id) || member_id <= 0) throw new HttpError(400, 'Kullanıcı seçiniz');
  const amount = Number(String(body.amount ?? '').replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, 'Geçerli bir miktar giriniz');
  const period = toMonth(body.period, 'Ay / yıl', { required: true });
  const type = body.type || 'aidat';
  if (!PAYMENT_TYPES.includes(type)) throw new HttpError(400, 'Geçersiz ödeme tipi');
  const method = trimOrNull(body.method);
  if (method && !METHODS.includes(method)) throw new HttpError(400, 'Geçersiz ödeme şekli');
  return {
    member_id,
    amount: Math.round(amount * 100) / 100,
    period,
    type,
    type_description: type === 'diger' ? trimOrNull(body.type_description) : null,
    description: trimOrNull(body.description),
    method,
  };
}

async function assertMemberExists(id) {
  const { rowCount } = await query('SELECT 1 FROM members WHERE id = $1', [id]);
  if (!rowCount) throw new HttpError(400, 'Seçilen kullanıcı bulunamadı');
}

app.post('/api/payments', requireAdmin, h(async (req, res) => {
  const p = parsePayment(req.body || {});
  await assertMemberExists(p.member_id);
  const { rows } = await query(
    `INSERT INTO payments (member_id, amount, period, type, type_description, description, method)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [p.member_id, p.amount, p.period, p.type, p.type_description, p.description, p.method],
  );
  res.status(201).json({ id: rows[0].id });
}));

app.put('/api/payments/:id', requireAdmin, h(async (req, res) => {
  const p = parsePayment(req.body || {});
  await assertMemberExists(p.member_id);
  const id = Number(req.params.id);
  const current = await query('SELECT delivery_id FROM payments WHERE id = $1', [id]);
  if (!current.rows[0]) throw new HttpError(404, 'Ödeme bulunamadı');
  if (current.rows[0].delivery_id) {
    throw new HttpError(409, 'Teslim edilmiş ödeme değiştirilemez. Önce teslimatı silin.');
  }
  await query(
    `UPDATE payments SET member_id = $2, amount = $3, period = $4, type = $5, type_description = $6,
            description = $7, method = $8
     WHERE id = $1`,
    [id, p.member_id, p.amount, p.period, p.type, p.type_description, p.description, p.method],
  );
  res.json({ id });
}));

app.delete('/api/payments/:id', requireAdmin, h(async (req, res) => {
  const { rows } = await query('SELECT delivery_id FROM payments WHERE id = $1', [Number(req.params.id)]);
  if (!rows[0]) throw new HttpError(404, 'Ödeme bulunamadı');
  if (rows[0].delivery_id) {
    throw new HttpError(409, 'Teslim edilmiş ödeme silinemez. Önce teslimatı silin.');
  }
  await query('DELETE FROM payments WHERE id = $1', [Number(req.params.id)]);
  res.status(204).end();
}));

/* ---------------------------------------------------------- deliveries */

app.get('/api/deliveries', requireAdmin, h(async (req, res) => {
  const { rows } = await query(`
    SELECT d.id, d.delivery_date, d.description, d.created_at,
           count(p.id)::int AS payment_count,
           COALESCE(sum(p.amount), 0) AS total
    FROM deliveries d
    LEFT JOIN payments p ON p.delivery_id = d.id
    GROUP BY d.id
    ORDER BY d.delivery_date DESC, d.id DESC`);
  // Per-type breakdown in a second pass keeps the SQL simple.
  const { rows: byType } = await query(`
    SELECT delivery_id, type, sum(amount) AS total
    FROM payments WHERE delivery_id IS NOT NULL GROUP BY delivery_id, type`);
  const map = new Map(rows.map((r) => [r.id, { ...r, by_type: {} }]));
  for (const r of byType) map.get(r.delivery_id).by_type[r.type] = r.total;
  res.json([...map.values()]);
}));

app.get('/api/deliveries/:id/payments', requireAdmin, h(async (req, res) => {
  const { rows } = await query(`${PAYMENT_SELECT} WHERE p.delivery_id = $1 ORDER BY p.created_at DESC`, [
    Number(req.params.id),
  ]);
  res.json(rows);
}));

app.post('/api/deliveries', requireAdmin, h(async (req, res) => {
  const body = req.body || {};
  const ids = [...new Set((body.payment_ids || []).map(Number).filter(Number.isInteger))];
  if (!ids.length) throw new HttpError(400, 'En az bir ödeme seçiniz');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(body.delivery_date || '') ? body.delivery_date : null;
  if (!date) throw new HttpError(400, 'Teslimat tarihi geçersiz');

  const id = await withTransaction(async (client) => {
    const { rows } = await client.query(
      'INSERT INTO deliveries (delivery_date, description) VALUES ($1, $2) RETURNING id',
      [date, trimOrNull(body.description)],
    );
    const deliveryId = rows[0].id;
    const upd = await client.query(
      'UPDATE payments SET delivery_id = $1 WHERE id = ANY($2::int[]) AND delivery_id IS NULL',
      [deliveryId, ids],
    );
    if (upd.rowCount !== ids.length) {
      throw new HttpError(409, 'Seçilen ödemelerden bazıları zaten teslim edilmiş veya silinmiş. Listeyi yenileyin.');
    }
    return deliveryId;
  });
  res.status(201).json({ id });
}));

app.delete('/api/deliveries/:id', requireAdmin, h(async (req, res) => {
  // payments.delivery_id is ON DELETE SET NULL, so the payments become undelivered again.
  const { rowCount } = await query('DELETE FROM deliveries WHERE id = $1', [Number(req.params.id)]);
  if (!rowCount) throw new HttpError(404, 'Teslimat bulunamadı');
  res.status(204).end();
}));

/* ------------------------------------------------------ static + errors */

const dist = fileURLToPath(new URL('../../client/dist', import.meta.url));
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile('index.html', { root: dist }));
}

app.use('/api', (req, res) => res.status(404).json({ error: 'Bulunamadı' }));

app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Geçersiz istek' });
  console.error(err);
  res.status(500).json({ error: 'Sunucu hatası' });
});

const port = Number(process.env.PORT) || 4000;
await migrate();
app.listen(port, () => console.log(`API http://localhost:${port}`));
