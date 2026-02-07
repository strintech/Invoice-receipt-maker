const express = require('express');
const db = require('../database/init');
const { generateInvoicePDF } = require('../services/pdfGenerator');

const router = express.Router();

// Helper to get invoice with all related data
const getInvoiceWithDetails = (id) => {
  const invoice = db.prepare(`
    SELECT i.*,
           t.company_name as template_company_name,
           t.company_address as template_company_address,
           t.company_city as template_company_city,
           t.company_country as template_company_country,
           t.tax_id as template_tax_id,
           t.vat_number as template_vat_number,
           t.bank_name as template_bank_name,
           t.bank_account as template_bank_account,
           t.swift_code as template_swift_code,
           t.iban as template_iban,
           t.email as template_email,
           t.phone as template_phone,
           t.logo_path as template_logo_path,
           t.primary_color as template_primary_color,
           t.secondary_color as template_secondary_color,
           c.company_name as client_company_name,
           c.address as client_address,
           c.city as client_city,
           c.country as client_country,
           c.tax_id as client_tax_id,
           c.email as client_email
    FROM invoices i
    LEFT JOIN templates t ON i.template_id = t.id
    LEFT JOIN clients c ON i.client_id = c.id
    WHERE i.id = ?
  `).get(id);

  if (invoice) {
    invoice.line_items = db.prepare(`
      SELECT * FROM line_items WHERE invoice_id = ? ORDER BY sort_order ASC
    `).all(id);
  }

  return invoice;
};

// GET all invoices
router.get('/', (req, res) => {
  try {
    const { status, from_date, to_date, client_id } = req.query;

    let sql = `
      SELECT i.*, c.company_name as client_name
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ' AND i.status = ?';
      params.push(status);
    }
    if (from_date) {
      sql += ' AND i.date >= ?';
      params.push(from_date);
    }
    if (to_date) {
      sql += ' AND i.date <= ?';
      params.push(to_date);
    }
    if (client_id) {
      sql += ' AND i.client_id = ?';
      params.push(client_id);
    }

    sql += ' ORDER BY i.date DESC, i.id DESC';

    const invoices = db.prepare(sql).all(...params);
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single invoice with details
router.get('/:id', (req, res) => {
  try {
    const invoice = getInvoiceWithDetails(req.params.id);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create invoice
router.post('/', (req, res) => {
  try {
    const { template_id, client_id, invoice_number, date, currency, status, notes, line_items } = req.body;

    if (!invoice_number || !date) {
      return res.status(400).json({ error: 'Invoice number and date are required' });
    }

    // Check for duplicate invoice number
    const existing = db.prepare('SELECT id FROM invoices WHERE invoice_number = ?').get(invoice_number);
    if (existing) {
      return res.status(400).json({ error: 'Invoice number already exists' });
    }

    // Calculate total from line items
    let total = 0;
    if (line_items && line_items.length > 0) {
      total = line_items.reduce((sum, item) => {
        return sum + (parseFloat(item.unit_price) * parseFloat(item.quantity || 1));
      }, 0);
    }

    // Insert invoice
    const invoiceStmt = db.prepare(`
      INSERT INTO invoices (template_id, client_id, invoice_number, date, currency, total, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = invoiceStmt.run(
      template_id || null,
      client_id || null,
      invoice_number,
      date,
      currency || 'EUR',
      total,
      status || 'draft',
      notes || null
    );

    const invoiceId = result.lastInsertRowid;

    // Insert line items
    if (line_items && line_items.length > 0) {
      const lineItemStmt = db.prepare(`
        INSERT INTO line_items (invoice_id, description, unit_price, quantity, vat_rate, total, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      line_items.forEach((item, index) => {
        const qty = parseFloat(item.quantity) || 1;
        const price = parseFloat(item.unit_price) || 0;
        const itemTotal = qty * price;

        lineItemStmt.run(
          invoiceId,
          item.description,
          price,
          qty,
          parseFloat(item.vat_rate) || 0,
          itemTotal,
          index
        );
      });
    }

    const invoice = getInvoiceWithDetails(invoiceId);
    res.status(201).json(invoice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update invoice
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { template_id, client_id, invoice_number, date, currency, status, notes, line_items } = req.body;

    const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Check for duplicate invoice number (excluding current)
    if (invoice_number && invoice_number !== existing.invoice_number) {
      const duplicate = db.prepare('SELECT id FROM invoices WHERE invoice_number = ? AND id != ?').get(invoice_number, id);
      if (duplicate) {
        return res.status(400).json({ error: 'Invoice number already exists' });
      }
    }

    // Calculate total from line items
    let total = existing.total;
    if (line_items !== undefined) {
      total = line_items.reduce((sum, item) => {
        return sum + (parseFloat(item.unit_price) * parseFloat(item.quantity || 1));
      }, 0);
    }

    // Update invoice
    const invoiceStmt = db.prepare(`
      UPDATE invoices SET
        template_id = ?,
        client_id = ?,
        invoice_number = ?,
        date = ?,
        currency = ?,
        total = ?,
        status = ?,
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    invoiceStmt.run(
      template_id ?? existing.template_id,
      client_id ?? existing.client_id,
      invoice_number || existing.invoice_number,
      date || existing.date,
      currency || existing.currency,
      total,
      status || existing.status,
      notes ?? existing.notes,
      id
    );

    // Update line items if provided
    if (line_items !== undefined) {
      // Delete existing line items
      db.prepare('DELETE FROM line_items WHERE invoice_id = ?').run(id);

      // Insert new line items
      if (line_items.length > 0) {
        const lineItemStmt = db.prepare(`
          INSERT INTO line_items (invoice_id, description, unit_price, quantity, vat_rate, total, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        line_items.forEach((item, index) => {
          const qty = parseFloat(item.quantity) || 1;
          const price = parseFloat(item.unit_price) || 0;
          const itemTotal = qty * price;

          lineItemStmt.run(
            id,
            item.description,
            price,
            qty,
            parseFloat(item.vat_rate) || 0,
            itemTotal,
            index
          );
        });
      }
    }

    const invoice = getInvoiceWithDetails(id);
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE invoice
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Line items will be deleted automatically due to ON DELETE CASCADE
    db.prepare('DELETE FROM invoices WHERE id = ?').run(id);
    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET invoice PDF
router.get('/:id/pdf', async (req, res) => {
  try {
    const invoice = getInvoiceWithDetails(req.params.id);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const pdfBuffer = await generateInvoicePDF(invoice);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_number}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(Buffer.from(pdfBuffer));
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
