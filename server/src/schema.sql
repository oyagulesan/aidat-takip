CREATE TABLE IF NOT EXISTS members (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  start_month   DATE,            -- always the 1st day of the month
  end_month     DATE,            -- NULL = still active
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_month IS NULL OR start_month IS NULL OR end_month >= start_month)
);

CREATE TABLE IF NOT EXISTS deliveries (
  id            SERIAL PRIMARY KEY,
  delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id               SERIAL PRIMARY KEY,
  member_id        INT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  amount           NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  period           DATE NOT NULL,  -- month/year the payment is for, 1st day of the month
  type             TEXT NOT NULL DEFAULT 'aidat'
                   CHECK (type IN ('aidat', 'salma', 'dergi', 'kitap', 'diger')),
  type_description TEXT,           -- what "diğer" means
  description      TEXT,
  method           TEXT CHECK (method IN ('nakit', 'iban')),
  delivery_id      INT REFERENCES deliveries(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_member_idx   ON payments(member_id);
CREATE INDEX IF NOT EXISTS payments_delivery_idx ON payments(delivery_id);

-- Key/value application settings. Missing keys fall back to defaults in code.
CREATE TABLE IF NOT EXISTS config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
