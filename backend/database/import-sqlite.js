// One-off: copy data from the old SQLite database into an empty Postgres database.
// Usage (Node 22.13+): DATABASE_URL=postgres://... node backend/database/import-sqlite.js [data/db.sqlite]
require('dotenv').config();
const { DatabaseSync } = require('node:sqlite');
const db = require('./init');

// Parents before children so foreign keys resolve
const TABLES = ['templates', 'clients', 'invoices', 'receipts', 'line_items'];

const main = async () => {
  const sqlite = new DatabaseSync(process.argv[2] || 'data/db.sqlite', { readOnly: true });
  await db.init();

  await db.tx(async (c) => {
    for (const table of TABLES) {
      const rows = sqlite.prepare(`SELECT * FROM ${table}`).all();
      for (const row of rows) {
        const cols = Object.keys(row);
        await c.query(
          `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})`,
          cols.map((col) => (col.endsWith('_at') && row[col] ? `${row[col]}Z` : row[col])) // SQLite timestamps are UTC
        );
      }
      // Continue ids after the imported ones
      await c.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(MAX(id), 0) + 1, false) FROM ${table}`);
      console.log(`${table}: ${rows.length} rows`);
    }
  });

  await db.pool.end();
};

main().catch((error) => {
  console.error('Import failed (nothing was written):', error.message);
  process.exit(1);
});
