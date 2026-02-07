const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/init');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
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

// Helper to delete old file
const deleteFile = (filePath) => {
  if (filePath) {
    const fullPath = path.resolve(filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }
};

// GET all templates
router.get('/', (req, res) => {
  try {
    const templates = db.prepare('SELECT * FROM templates ORDER BY is_default DESC, name ASC').all();
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single template
router.get('/:id', (req, res) => {
  try {
    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create template
router.post('/', uploadFields, (req, res) => {
  try {
    const data = req.body;
    const files = req.files || {};

    // Handle file paths
    const logoPath = files.logo ? files.logo[0].path : null;
    const stampPath = files.stamp ? files.stamp[0].path : null;
    const signaturePath = files.signature ? files.signature[0].path : null;

    const stmt = db.prepare(`
      INSERT INTO templates (
        name, company_name, company_address, company_city, company_country,
        tax_id, vat_number, bank_name, bank_account, swift_code, iban,
        email, phone, logo_path, stamp_path, signature_path, signatory_name,
        primary_color, secondary_color, default_currency, default_vat_rate,
        vat_note_en, vat_note_local, invoice_prefix, receipt_prefix,
        default_place_of_issue, is_default
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    const result = stmt.run(
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
      data.is_default ? 1 : 0
    );

    // If this is set as default, unset others
    if (data.is_default) {
      db.prepare('UPDATE templates SET is_default = 0 WHERE id != ?').run(result.lastInsertRowid);
    }

    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update template
router.put('/:id', uploadFields, (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const files = req.files || {};

    // Get existing template
    const existing = db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Handle file paths - keep existing if not updated
    let logoPath = existing.logo_path;
    let stampPath = existing.stamp_path;
    let signaturePath = existing.signature_path;

    if (files.logo) {
      deleteFile(existing.logo_path);
      logoPath = files.logo[0].path;
    }
    if (files.stamp) {
      deleteFile(existing.stamp_path);
      stampPath = files.stamp[0].path;
    }
    if (files.signature) {
      deleteFile(existing.signature_path);
      signaturePath = files.signature[0].path;
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

    const stmt = db.prepare(`
      UPDATE templates SET
        name = ?, company_name = ?, company_address = ?, company_city = ?,
        company_country = ?, tax_id = ?, vat_number = ?, bank_name = ?,
        bank_account = ?, swift_code = ?, iban = ?, email = ?, phone = ?,
        logo_path = ?, stamp_path = ?, signature_path = ?, signatory_name = ?,
        primary_color = ?, secondary_color = ?, default_currency = ?,
        default_vat_rate = ?, vat_note_en = ?, vat_note_local = ?,
        invoice_prefix = ?, receipt_prefix = ?, default_place_of_issue = ?,
        is_default = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
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
      parseFloat(data.default_vat_rate) ?? existing.default_vat_rate,
      data.vat_note_en ?? existing.vat_note_en,
      data.vat_note_local ?? existing.vat_note_local,
      data.invoice_prefix || existing.invoice_prefix,
      data.receipt_prefix || existing.receipt_prefix,
      data.default_place_of_issue ?? existing.default_place_of_issue,
      data.is_default !== undefined ? (data.is_default ? 1 : 0) : existing.is_default,
      id
    );

    // If this is set as default, unset others
    if (data.is_default) {
      db.prepare('UPDATE templates SET is_default = 0 WHERE id != ?').run(id);
    }

    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE template
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    // Get existing template to delete files
    const existing = db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Delete associated files
    deleteFile(existing.logo_path);
    deleteFile(existing.stamp_path);
    deleteFile(existing.signature_path);

    db.prepare('DELETE FROM templates WHERE id = ?').run(id);
    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST set template as default
router.post('/:id/set-default', (req, res) => {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Unset all defaults
    db.prepare('UPDATE templates SET is_default = 0').run();
    // Set this one as default
    db.prepare('UPDATE templates SET is_default = 1 WHERE id = ?').run(id);

    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
