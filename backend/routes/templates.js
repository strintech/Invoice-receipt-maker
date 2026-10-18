const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database/init');
const { buildInvoiceHTML, buildReceiptHTML } = require('../services/pdfGenerator');
const { LAYOUTS } = require('../services/layouts');
const { PATTERNS, PLACEMENTS, patternSvg } = require('../services/patterns');

const router = express.Router();

// Multipart bodies send booleans as strings, so "false" must not count as true
const isTrue = (v) => v === true || v === 'true' || v === '1' || v === 'on';

// Images are stored in the template row as data URLs (hosting disks are ephemeral).
// ponytail: fine for logos/stamps/signatures; move to object storage if images get large or many
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 // 5MB default
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|svg|webp/;
    const ext = path.extname(file.originalname).toLowerCase();
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(ext);

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  }
});

const uploadFields = upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'stamp', maxCount: 1 },
  { name: 'signature', maxCount: 1 }
]);

// MIME type from the extension (checked by fileFilter), never the client-sent one, so it's always image/*
const toDataUrl = (file) => {
  const ext = path.extname(file.originalname).toLowerCase().slice(1);
  const mimeType = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
  return `data:${mimeType};base64,${file.buffer.toString('base64')}`;
};

// Helper to delete old file (paths from before images were stored as data URLs)
const deleteFile = (filePath) => {
  if (filePath && !filePath.startsWith('data:')) {
    const fullPath = path.resolve(filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }
};

// GET all templates
router.get('/', async (req, res) => {
  try {
    const templates = await db.all('SELECT * FROM templates ORDER BY is_default DESC, name ASC');
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET layout, pattern and placement choices for the template design picker
router.get('/design-options', (req, res) => {
  res.json({
    layouts: Object.entries(LAYOUTS).map(([id, { label, description }]) => ({ id, label, description })),
    patterns: [{ id: 'none', label: 'None', svg: '' },
      ...Object.entries(PATTERNS).map(([id, label]) => ({ id, label, svg: patternSvg(id, null, 120, 120) }))],
    placements: Object.entries(PLACEMENTS).map(([id, { label }]) => ({ id, label }))
  });
});

const SAMPLE_ITEMS = [
  { description: 'Website Development', unit_price: 1200, quantity: 1, total: 1200 },
  { description: 'Hosting (12 months)', unit_price: 15, quantity: 12, total: 180 },
  { description: 'Logo Design', unit_price: 300, quantity: 1, total: 300 }
];

// POST render a sample invoice/receipt as HTML with unsaved template form values (live preview).
// Images come only from the saved template: a client-sent path would let anyone read server files.
router.post('/preview', async (req, res) => {
  try {
    const { type, template = {}, template_id } = req.body;
    const saved = template_id
      ? await db.one('SELECT logo_path, stamp_path, signature_path FROM templates WHERE id = $1', [template_id])
      : null;

    const doc = {
      invoice_number: 'INV-2601-001',
      receipt_number: 'RCP-2601-001',
      date: new Date().toISOString().slice(0, 10),
      place_of_issue: template.default_place_of_issue || 'Sarajevo',
      currency: template.default_currency || 'EUR',
      vat_rate: 0,
      notes: 'Payment due within 15 days.',
      client_company_name: 'Client Company GmbH',
      client_address: 'Example Street 1',
      client_city: '1010 Wien',
      client_tax_id: 'ATU12345678',
      line_items: SAMPLE_ITEMS,
      total: SAMPLE_ITEMS.reduce((sum, item) => sum + item.total, 0)
    };
    for (const [key, value] of Object.entries(template)) {
      if (!key.endsWith('_path')) doc[`template_${key}`] = value;
    }
    for (const key of ['logo_path', 'stamp_path', 'signature_path']) {
      doc[`template_${key}`] = saved?.[key] || null;
    }

    const opts = { lang: req.user.language };
    res.type('html').send(type === 'receipt' ? await buildReceiptHTML(doc, opts) : await buildInvoiceHTML(doc, opts));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single template
router.get('/:id', async (req, res) => {
  try {
    const template = await db.one('SELECT * FROM templates WHERE id = $1', [req.params.id]);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create template
router.post('/', uploadFields, async (req, res) => {
  try {
    const data = req.body;
    const files = req.files || {};

    // Handle file paths
    const logoPath = files.logo ? toDataUrl(files.logo[0]) : null;
    const stampPath = files.stamp ? toDataUrl(files.stamp[0]) : null;
    const signaturePath = files.signature ? toDataUrl(files.signature[0]) : null;

    const template = await db.one(`
      INSERT INTO templates (
        name, company_name, company_address, company_city, company_country,
        tax_id, vat_number, bank_name, bank_account, swift_code, iban,
        email, phone, logo_path, stamp_path, signature_path, signatory_name,
        primary_color, secondary_color, default_currency, default_vat_rate,
        vat_note_en, vat_note_local, invoice_prefix, receipt_prefix,
        default_place_of_issue, is_default, invoice_layout, receipt_layout,
        background_color, pattern, pattern_color, pattern_placement, pattern_opacity
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
        $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34
      )
      RETURNING *
    `, [
      data.name,
      data.company_name,
      data.company_address || null,
      data.company_city || null,
      data.company_country || null,
      data.tax_id || null,
      data.vat_number || null,
      data.bank_name || null,
      data.bank_account || null,
      data.swift_code || null,
      data.iban || null,
      data.email || null,
      data.phone || null,
      logoPath,
      stampPath,
      signaturePath,
      data.signatory_name || null,
      data.primary_color || '#F97316',
      data.secondary_color || '#1F2937',
      data.default_currency || 'EUR',
      parseFloat(data.default_vat_rate) || 0,
      data.vat_note_en || null,
      data.vat_note_local || null,
      data.invoice_prefix || 'INV',
      data.receipt_prefix || 'RCP',
      data.default_place_of_issue || null,
      isTrue(data.is_default),
      data.invoice_layout || 'classic',
      data.receipt_layout || 'classic',
      data.background_color || '#FFFFFF',
      data.pattern || 'none',
      data.pattern_color || '#F97316',
      data.pattern_placement || 'bottom',
      parseFloat(data.pattern_opacity) || 1
    ]);

    // If this is set as default, unset others
    if (isTrue(data.is_default)) {
      await db.run('UPDATE templates SET is_default = false WHERE id != $1', [template.id]);
    }

    res.status(201).json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update template
router.put('/:id', uploadFields, async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const files = req.files || {};

    // Get existing template
    const existing = await db.one('SELECT * FROM templates WHERE id = $1', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Handle file paths - keep existing if not updated
    let logoPath = existing.logo_path;
    let stampPath = existing.stamp_path;
    let signaturePath = existing.signature_path;

    if (files.logo) {
      deleteFile(existing.logo_path);
      logoPath = toDataUrl(files.logo[0]);
    }
    if (files.stamp) {
      deleteFile(existing.stamp_path);
      stampPath = toDataUrl(files.stamp[0]);
    }
    if (files.signature) {
      deleteFile(existing.signature_path);
      signaturePath = toDataUrl(files.signature[0]);
    }

    // Handle explicit removal of files
    if (data.remove_logo === 'true') {
      deleteFile(existing.logo_path);
      logoPath = null;
    }
    if (data.remove_stamp === 'true') {
      deleteFile(existing.stamp_path);
      stampPath = null;
    }
    if (data.remove_signature === 'true') {
      deleteFile(existing.signature_path);
      signaturePath = null;
    }

    const template = await db.one(`
      UPDATE templates SET
        name = $1, company_name = $2, company_address = $3, company_city = $4,
        company_country = $5, tax_id = $6, vat_number = $7, bank_name = $8,
        bank_account = $9, swift_code = $10, iban = $11, email = $12, phone = $13,
        logo_path = $14, stamp_path = $15, signature_path = $16, signatory_name = $17,
        primary_color = $18, secondary_color = $19, default_currency = $20,
        default_vat_rate = $21, vat_note_en = $22, vat_note_local = $23,
        invoice_prefix = $24, receipt_prefix = $25, default_place_of_issue = $26,
        is_default = $27, invoice_layout = $28, receipt_layout = $29, background_color = $30,
        pattern = $31, pattern_color = $32, pattern_placement = $33, pattern_opacity = $34, updated_at = now()
      WHERE id = $35
      RETURNING *
    `, [
      data.name || existing.name,
      data.company_name || existing.company_name,
      data.company_address ?? existing.company_address,
      data.company_city ?? existing.company_city,
      data.company_country ?? existing.company_country,
      data.tax_id ?? existing.tax_id,
      data.vat_number ?? existing.vat_number,
      data.bank_name ?? existing.bank_name,
      data.bank_account ?? existing.bank_account,
      data.swift_code ?? existing.swift_code,
      data.iban ?? existing.iban,
      data.email ?? existing.email,
      data.phone ?? existing.phone,
      logoPath,
      stampPath,
      signaturePath,
      data.signatory_name ?? existing.signatory_name,
      data.primary_color || existing.primary_color,
      data.secondary_color || existing.secondary_color,
      data.default_currency || existing.default_currency,
      data.default_vat_rate !== undefined ? (parseFloat(data.default_vat_rate) || 0) : existing.default_vat_rate,
      data.vat_note_en ?? existing.vat_note_en,
      data.vat_note_local ?? existing.vat_note_local,
      data.invoice_prefix || existing.invoice_prefix,
      data.receipt_prefix || existing.receipt_prefix,
      data.default_place_of_issue ?? existing.default_place_of_issue,
      data.is_default !== undefined ? isTrue(data.is_default) : existing.is_default,
      data.invoice_layout || existing.invoice_layout,
      data.receipt_layout || existing.receipt_layout,
      data.background_color || existing.background_color,
      data.pattern || existing.pattern,
      data.pattern_color || existing.pattern_color,
      data.pattern_placement || existing.pattern_placement,
      data.pattern_opacity !== undefined ? (parseFloat(data.pattern_opacity) || 1) : existing.pattern_opacity,
      id
    ]);

    // If this is set as default, unset others
    if (isTrue(data.is_default)) {
      await db.run('UPDATE templates SET is_default = false WHERE id != $1', [id]);
    }

    res.json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE template
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get existing template to delete files
    const existing = await db.one('SELECT * FROM templates WHERE id = $1', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Delete associated files
    deleteFile(existing.logo_path);
    deleteFile(existing.stamp_path);
    deleteFile(existing.signature_path);

    await db.run('DELETE FROM templates WHERE id = $1', [id]);
    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST set template as default
router.post('/:id/set-default', async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db.one('SELECT * FROM templates WHERE id = $1', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Make this the only default
    await db.run('UPDATE templates SET is_default = (id = $1)', [id]);

    const template = await db.one('SELECT * FROM templates WHERE id = $1', [id]);
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
