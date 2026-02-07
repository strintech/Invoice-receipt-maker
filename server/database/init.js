const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DATABASE_PATH || './data/db.sqlite';
const dbDir = path.dirname(dbPath);

// Ensure database directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
const initSchema = () => {
  db.exec(`
    -- Company templates (reusable company profiles)
    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      default_vat_rate REAL DEFAULT 0,
      vat_note_en TEXT,
      vat_note_local TEXT,
      invoice_prefix TEXT DEFAULT 'INV',
      receipt_prefix TEXT DEFAULT 'RCP',
      default_place_of_issue TEXT,
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Saved clients
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL,
      address TEXT,
      city TEXT,
      country TEXT,
      tax_id TEXT,
      email TEXT,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Invoices
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER REFERENCES templates(id) ON DELETE SET NULL,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      invoice_number TEXT NOT NULL UNIQUE,
      date DATE NOT NULL,
      currency TEXT DEFAULT 'EUR',
      total REAL DEFAULT 0,
      status TEXT DEFAULT 'draft',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Receipts
    CREATE TABLE IF NOT EXISTS receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER REFERENCES templates(id) ON DELETE SET NULL,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      receipt_number TEXT NOT NULL UNIQUE,
      date DATE NOT NULL,
      place_of_issue TEXT,
      fiscal_number TEXT,
      currency TEXT DEFAULT 'EUR',
      secondary_currency TEXT DEFAULT 'BAM',
      exchange_rate REAL DEFAULT 1.95583,
      vat_rate REAL DEFAULT 0,
      subtotal REAL DEFAULT 0,
      vat_amount REAL DEFAULT 0,
      total REAL DEFAULT 0,
      total_secondary REAL DEFAULT 0,
      vat_note_en TEXT,
      vat_note_local TEXT,
      status TEXT DEFAULT 'draft',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Line items (shared for both invoices and receipts)
    CREATE TABLE IF NOT EXISTS line_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
      receipt_id INTEGER REFERENCES receipts(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      unit_price REAL NOT NULL,
      quantity REAL DEFAULT 1,
      vat_rate REAL DEFAULT 0,
      total REAL NOT NULL,
      sort_order INTEGER DEFAULT 0,
      CHECK (
        (invoice_id IS NOT NULL AND receipt_id IS NULL) OR
        (invoice_id IS NULL AND receipt_id IS NOT NULL)
      )
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
  `);

  console.log('Database schema initialized successfully');
};

// Initialize schema on first import
initSchema();

module.exports = db;
