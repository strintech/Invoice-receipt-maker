const { Pool, types } = require('pg');

// Return DATE columns as 'YYYY-MM-DD' strings instead of timezone-shifted JS Dates
types.setTypeParser(types.builtins.DATE, (v) => v);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const schema = `
  -- Company templates (reusable company profiles)
  CREATE TABLE IF NOT EXISTS templates (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    company_name TEXT NOT NULL,
    company_address TEXT,
    company_city TEXT,
    company_country TEXT,
    tax_id TEXT,
    vat_number TEXT,
    bank_name TEXT,
    bank_account TEXT,
    swift_code TEXT,
    iban TEXT,
    email TEXT,
    phone TEXT,
    logo_path TEXT,
    stamp_path TEXT,
    signature_path TEXT,
    signatory_name TEXT,
    primary_color TEXT DEFAULT '#F97316',
    secondary_color TEXT DEFAULT '#1F2937',
    default_currency TEXT DEFAULT 'EUR',
    default_vat_rate DOUBLE PRECISION DEFAULT 0,
    vat_note_en TEXT,
    vat_note_local TEXT,
    invoice_prefix TEXT DEFAULT 'INV',
    receipt_prefix TEXT DEFAULT 'RCP',
    default_place_of_issue TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );

  -- Document design (layouts and patterns: backend/services/layouts.js, patterns.js)
  ALTER TABLE templates ADD COLUMN IF NOT EXISTS invoice_layout TEXT DEFAULT 'classic';
  ALTER TABLE templates ADD COLUMN IF NOT EXISTS receipt_layout TEXT DEFAULT 'classic';
  ALTER TABLE templates ADD COLUMN IF NOT EXISTS background_color TEXT DEFAULT '#FFFFFF';
  ALTER TABLE templates ADD COLUMN IF NOT EXISTS pattern TEXT DEFAULT 'none';
  ALTER TABLE templates ADD COLUMN IF NOT EXISTS pattern_color TEXT DEFAULT '#F97316';
  ALTER TABLE templates ADD COLUMN IF NOT EXISTS pattern_placement TEXT DEFAULT 'bottom';
  ALTER TABLE templates ADD COLUMN IF NOT EXISTS pattern_opacity DOUBLE PRECISION DEFAULT 1;

  -- Saved clients
  CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    company_name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    country TEXT,
    tax_id TEXT,
    email TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  -- Invoices
  CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    template_id INTEGER REFERENCES templates(id) ON DELETE SET NULL,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    invoice_number TEXT NOT NULL UNIQUE,
    date DATE NOT NULL,
    currency TEXT DEFAULT 'EUR',
    total DOUBLE PRECISION DEFAULT 0,
    status TEXT DEFAULT 'draft',
    notes TEXT,
    place_of_issue TEXT,
    payment_method TEXT,
    fiscal_number TEXT,
    contract_number TEXT,
    vat_rate DOUBLE PRECISION DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );

  -- Receipts
  CREATE TABLE IF NOT EXISTS receipts (
    id SERIAL PRIMARY KEY,
    template_id INTEGER REFERENCES templates(id) ON DELETE SET NULL,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    receipt_number TEXT NOT NULL UNIQUE,
    date DATE NOT NULL,
    place_of_issue TEXT,
    fiscal_number TEXT,
    currency TEXT DEFAULT 'EUR',
    secondary_currency TEXT DEFAULT 'BAM',
    exchange_rate DOUBLE PRECISION DEFAULT 1.95583,
    vat_rate DOUBLE PRECISION DEFAULT 0,
    subtotal DOUBLE PRECISION DEFAULT 0,
    vat_amount DOUBLE PRECISION DEFAULT 0,
    total DOUBLE PRECISION DEFAULT 0,
    total_secondary DOUBLE PRECISION DEFAULT 0,
    vat_note_en TEXT,
    vat_note_local TEXT,
    status TEXT DEFAULT 'draft',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );

  -- Line items (shared for both invoices and receipts)
  CREATE TABLE IF NOT EXISTS line_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
    receipt_id INTEGER REFERENCES receipts(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    unit_price DOUBLE PRECISION NOT NULL,
    quantity DOUBLE PRECISION DEFAULT 1,
    vat_rate DOUBLE PRECISION DEFAULT 0,
    total DOUBLE PRECISION NOT NULL,
    sort_order INTEGER DEFAULT 0,
    CHECK (
      (invoice_id IS NOT NULL AND receipt_id IS NULL) OR
      (invoice_id IS NULL AND receipt_id IS NOT NULL)
    )
  );

  -- User accounts. Public handle is username#identifier; identifier is NOT the primary key
  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL,
    identifier TEXT NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS users_username_key ON users (lower(username));
  CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (lower(email));
  -- Settings page: UI + document language and UI theme
  ALTER TABLE users ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en';
  ALTER TABLE users ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'system';
  -- Password login needs a confirmed email; accounts from before this column count as confirmed
  ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT true;
  ALTER TABLE users ALTER COLUMN email_verified SET DEFAULT false;

  -- Login sessions (only the SHA-256 of the cookie token is stored)
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
  );

  -- Single-use email confirmation links sent after registering (SHA-256 of the token)
  CREATE TABLE IF NOT EXISTS login_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
  );

  -- Indexes for better query performance
  CREATE INDEX IF NOT EXISTS idx_invoices_template ON invoices(template_id);
  CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
  CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date);
  CREATE INDEX IF NOT EXISTS idx_receipts_template ON receipts(template_id);
  CREATE INDEX IF NOT EXISTS idx_receipts_client ON receipts(client_id);
  CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(date);
  CREATE INDEX IF NOT EXISTS idx_line_items_invoice ON line_items(invoice_id);
  CREATE INDEX IF NOT EXISTS idx_line_items_receipt ON line_items(receipt_id);
`;

const init = async () => {
  await pool.query(schema);
  console.log('Database schema initialized successfully');
};

// Run fn(client) inside a transaction; rolls back if it throws
const tx = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  init,
  tx,
  all: async (sql, params) => (await pool.query(sql, params)).rows,
  one: async (sql, params) => (await pool.query(sql, params)).rows[0],
  run: (sql, params) => pool.query(sql, params)
};
