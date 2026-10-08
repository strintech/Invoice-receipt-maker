# Invoice & Receipt Maker

Web app for creating invoices and receipts from reusable company templates and exporting them as PDFs.

- **Invoices** follow the Bosnian "faktura" layout and include a **BIHUPP10 payment QR code**, so banking apps can scan the invoice to fill in a payment order.
- **Receipts** use a clean English layout titled "RECEIPT".
- **Templates** store company details, bank info, logo, stamp, signature and brand colors.
- Templates, invoices and receipts can be forked into a pre-filled copy.

Stack: Node.js/Express, PostgreSQL (`pg`), React/Vite, Puppeteer for PDF rendering.

## Running

### Docker

```bash
docker compose up -d --build
```

Open http://localhost:3000. Postgres data lives in the `pgdata` Docker volume and uploaded images in `uploads/` (mounted from the project folder), so both survive rebuilds. Set `POSTGRES_PASSWORD` in `.env` to change the default database password. For production (mail provider, Cloudflare, DigitalOcean) see [deployment.md](deployment.md).

### Development

```bash
npm install
npm install --prefix frontend
cp .env.example .env   # optional, the defaults work
docker compose up -d db mailpit   # Postgres on :5432, Mailpit (test inbox) on http://localhost:8025
npm run dev
```

The frontend runs on http://localhost:5173 and proxies `/api` to the backend on port 3000.

### Tests

```bash
npm test
```

### Importing the old SQLite database

Older versions stored data in `data/db.sqlite`. To copy it into an empty Postgres (needs Node 22.13+):

```bash
docker compose up -d db
node backend/database/import-sqlite.js data/db.sqlite
```

It runs in one transaction, so if Postgres already has conflicting rows nothing is written.

## Accounts

Everything except the login and register pages requires an account. Register with a username, email and password (min 8 characters, one uppercase letter, one number, one special character). Log in with either the username or the email.

Registering emails a confirmation link; opening it confirms the email and starts a session. After that, a correct password signs in directly. Signing in to an account whose email isn't confirmed yet sends a fresh link instead. Links work once and expire after 15 minutes. Locally every email lands in Mailpit at http://localhost:8025. In production set `SMTP_URL`, `MAIL_FROM` and `APP_URL` (the frontend URL the links point to); see `.env.example`.

Each user gets a public handle `username#1234`. The 4-digit identifier is random and is not the primary key (users are keyed by UUID); it's there for adding people to organizations later. Passwords are hashed with scrypt, confirmation-link tokens and session tokens are stored only as SHA-256 hashes, sessions are httpOnly cookies kept in the `sessions` table for 30 days, and 10 failed logins from one IP lock that IP out for 15 minutes. Invoices, receipts, templates and clients are still shared between all accounts.

The Settings page (and the toggles in the top bar) set the account's language (English or Bosnian) and theme (light, dark or system). The language applies to the app and to generated PDFs: titles (INVOICE/FAKTURA, RECEIPT/RAČUN), labels, and which template VAT note is printed (English note in English, local note in Bosnian). UI translations live in `frontend/src/i18n.js`, keyed by the English text; document text is in `backend/services/pdfGenerator.js`.

## Payment QR code

`backend/services/bihupp.js` builds the BIHUPP10 payload, ported from [sasa-b/php-bihupp-qrcode](https://github.com/sasa-b/php-bihupp-qrcode), and renders it with the `qrcode` package. The QR code is added to an invoice when:

- the template has a **Bank Account (Tr. račun)**, and
- the invoice currency is BAM, or EUR (converted at the fixed rate of 1.95583).

## Project structure

```
backend/
  index.js                 Express entry, serves the built frontend in production
  database/init.js         Postgres pool, schema, query helpers
  database/import-sqlite.js One-off import from the old SQLite file
  routes/                  auth, templates (with uploads), clients, invoices, receipts
  services/pdfGenerator.js Invoice and receipt PDF layouts
  services/bihupp.js       BIHUPP10 payment QR code
  services/mailer.js       SMTP transport and the email confirmation link
frontend/src/
  pages/                   Auth (login/register), Dashboard, Templates, Clients, Invoices, Receipts
  components/              Layout, Sidebar, LineItems
uploads/                   Logos, stamps, signatures (git-ignored)
```

## Backups

Back up the database with `docker compose exec db pg_dump -U invoices invoices > backup.sql` and copy the `uploads/` folder. Restore with `docker compose exec -T db psql -U invoices invoices < backup.sql`.
