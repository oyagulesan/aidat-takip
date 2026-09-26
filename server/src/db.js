import pg from 'pg';
import bcrypt from 'bcryptjs';
import { readFile } from 'node:fs/promises';

// Keep DATE as 'YYYY-MM-DD' strings (avoid timezone shifts) and NUMERIC as numbers.
pg.types.setTypeParser(1082, (v) => v);
pg.types.setTypeParser(1700, (v) => parseFloat(v));

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://aidat:aidat@localhost:5432/aidat',
});

export const query = (text, params) => pool.query(text, params);

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function migrate() {
  const sql = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  await pool.query(sql);

  const { rowCount } = await pool.query(`SELECT 1 FROM members WHERE role = 'admin' LIMIT 1`);
  if (rowCount === 0) {
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    await pool.query(
      `INSERT INTO members (name, username, password_hash, role) VALUES ($1, $2, $3, 'admin')`,
      ['Yönetici', username, await bcrypt.hash(password, 10)],
    );
    console.log(`İlk admin kullanıcısı oluşturuldu: ${username} (şifreyi ilk girişten sonra değiştirin)`);
  }
}
