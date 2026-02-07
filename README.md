Project Structure

  Invoice_Reciept_Maker/
  ├── package.json              # Root config with dev scripts
  ├── .env                      # Environment variables
  ├── Dockerfile                # Multi-stage Docker build
  ├── docker-compose.yml        # Container orchestration
  ├── server/
  │   ├── index.js              # Express server entry
  │   ├── database/init.js      # SQLite schema
  │   ├── routes/
  │   │   ├── templates.js      # Template CRUD + file uploads
  │   │   ├── clients.js        # Client CRUD
  │   │   ├── invoices.js       # Invoice CRUD + PDF
  │   │   └── receipts.js       # Receipt CRUD + PDF
  │   └── services/
  │       └── pdfGenerator.js   # Puppeteer PDF generation
  ├── client/
  │   ├── package.json          # React/Vite config
  │   ├── vite.config.js        # Dev proxy setup
  │   ├── src/
  │   │   ├── App.jsx           # Router setup
  │   │   ├── components/
  │   │   │   ├── Layout.jsx
  │   │   │   ├── Sidebar.jsx
  │   │   │   └── LineItems.jsx
  │   │   ├── pages/
  │   │   │   ├── Dashboard.jsx
  │   │   │   ├── Templates.jsx
  │   │   │   ├── Clients.jsx
  │   │   │   ├── Invoices.jsx
  │   │   │   └── Receipts.jsx
  │   │   └── styles/main.css
  ├── uploads/                  # Logo, stamp, signature storage
  └── data/                     # SQLite database

  To Run

  Development:
  npm install
  cd client && npm install && cd ..
  npm run dev

  Docker:
  sudo docker compose up --build

  Access at http://localhost:3000

  Features

  - Create/edit company templates with logos, stamps, signatures
  - Manage clients for quick selection
  - Generate invoices with line items and PDF export
  - Generate receipts with VAT, currency conversion, and PDF export
  - Professional PDF layouts matching the reference format