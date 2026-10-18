require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Initialize database
const db = require('./database/init');

// Import routes
const { router: authRouter, requireAuth } = require('./routes/auth');
const templatesRouter = require('./routes/templates');
const clientsRouter = require('./routes/clients');
const invoicesRouter = require('./routes/invoices');
const receiptsRouter = require('./routes/receipts');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Proxy hops in front of the app (Firebase Hosting -> Cloud Run); needed for req.secure and req.ip
app.set('trust proxy', Number(process.env.TRUST_PROXY) || false);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.resolve(uploadDir)));

// API Routes (everything except /api/auth requires a logged-in user)
app.use('/api/auth', authRouter);
app.use('/api', requireAuth);
app.use('/api/templates', templatesRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/receipts', receiptsRouter);

// Utility endpoint to get next document number
app.get('/api/next-number/:type', async (req, res, next) => {
  const { type } = req.params;
  const year = new Date().getFullYear().toString().slice(-2);
  const month = (new Date().getMonth() + 1).toString().padStart(2, '0');

  let table, column, prefix;

  if (type === 'invoice') {
    table = 'invoices';
    column = 'invoice_number';
    prefix = 'INV';
  } else if (type === 'receipt') {
    table = 'receipts';
    column = 'receipt_number';
    prefix = 'RCP';
  } else {
    return res.status(400).json({ error: 'Invalid type. Use "invoice" or "receipt".' });
  }

  try {
    // Get default template prefix if exists
    const defaultTemplate = await db.one('SELECT * FROM templates WHERE is_default');
    if (defaultTemplate) {
      prefix = type === 'invoice' ? defaultTemplate.invoice_prefix : defaultTemplate.receipt_prefix;
    }

    // Count existing documents this year
    const pattern = `${prefix}-${year}%`;
    const count = await db.one(`SELECT COUNT(*)::int as count FROM ${table} WHERE ${column} LIKE $1`, [pattern]);
    const nextNum = (count.count + 1).toString().padStart(3, '0');

    res.json({
      number: `${prefix}-${year}${month}-${nextNum}`,
      prefix,
      year,
      month,
      sequence: nextNum
    });
  } catch (error) {
    next(error);
  }
});

// Serve React app in production
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '../frontend/dist');
  app.use(express.static(clientBuildPath));

  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Graceful shutdown
const shutdown = async () => {
  console.log('\nShutting down gracefully...');
  await db.pool.end();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

db.init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  })
  .catch((error) => {
    console.error('Database initialization failed:', error);
    process.exit(1);
  });

module.exports = app;
