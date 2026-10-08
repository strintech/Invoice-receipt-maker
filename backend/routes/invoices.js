const express = require('express');
const db = require('../database/init');
const { generateInvoicePDF } = require('../services/pdfGenerator');

const router = express.Router();

// Insert line items for an invoice (c = transaction client)
const insertLineItems = async (c, invoiceId, lineItems) => {
  for (const [index, item] of (lineItems || []).entries()) {
    const qty = parseFloat(item.quantity) || 1;
    const price = parseFloat(item.unit_price) || 0;

    await c.query(`
      INSERT INTO line_items (invoice_id, description, unit_price, quantity, vat_rate, total, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [invoiceId, item.description, price, qty, parseFloat(item.vat_rate) || 0, qty * price, index]);
  }
};

// Helper to get invoice with all related data
const getInvoiceWithDetails = async (id) => {
  const invoice = await db.one(`
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
           t.stamp_path as template_stamp_path,
           t.signature_path as template_signature_path,
           t.signatory_name as template_signatory_name,
           t.vat_note_en as template_vat_note_en,
           t.vat_note_local as template_vat_note_local,
           t.primary_color as template_primary_color,
           t.secondary_color as template_secondary_color,
           t.invoice_layout as template_invoice_layout,
           t.receipt_layout as template_receipt_layout,
           t.background_color as template_background_color,
           t.pattern as template_pattern,
           t.pattern_color as template_pattern_color,
           t.pattern_placement as template_pattern_placement,
           t.pattern_opacity as template_pattern_opacity,
           c.company_name as client_company_name,
           c.address as client_address,
           c.city as client_city,
           c.country as client_country,
           c.tax_id as client_tax_id,
           c.email as client_email
    FROM invoices i
    LEFT JOIN templates t ON i.template_id = t.id
    LEFT JOIN clients c ON i.client_id = c.id
    WHERE i.id = $1
  `, [id]);

  if (invoice) {
    invoice.line_items = await db.all(`
      SELECT * FROM line_items WHERE invoice_id = $1 ORDER BY sort_order ASC
    `, [id]);
  }

  return invoice;
};

// GET all invoices
router.get('/', async (req, res) => {
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
      params.push(status);
      sql += ` AND i.status = $${params.length}`;
    }
    if (from_date) {
      params.push(from_date);
      sql += ` AND i.date >= $${params.length}`;
    }
    if (to_date) {
      params.push(to_date);
      sql += ` AND i.date <= $${params.length}`;
    }
    if (client_id) {
      params.push(client_id);
      sql += ` AND i.client_id = $${params.length}`;
    }

    sql += ' ORDER BY i.date DESC, i.id DESC';

    const invoices = await db.all(sql, params);
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single invoice with details
router.get('/:id', async (req, res) => {
  try {
    const invoice = await getInvoiceWithDetails(req.params.id);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create invoice
router.post('/', async (req, res) => {
  try {
    const {
      template_id, client_id, invoice_number, date, currency, status, notes, line_items,
      place_of_issue, payment_method, fiscal_number, contract_number, vat_rate
    } = req.body;

    if (!invoice_number || !date) {
      return res.status(400).json({ error: 'Invoice number and date are required' });
    }

    // Check for duplicate invoice number
    const existing = await db.one('SELECT id FROM invoices WHERE invoice_number = $1', [invoice_number]);
    if (existing) {
      return res.status(400).json({ error: 'Invoice number already exists' });
    }

    // Calculate total (incl. VAT) from line items
    const vatRateValue = parseFloat(vat_rate) || 0;
    let subtotal = 0;
    if (line_items && line_items.length > 0) {
      subtotal = line_items.reduce((sum, item) => {
        return sum + (parseFloat(item.unit_price) * parseFloat(item.quantity || 1));
      }, 0);
    }
    const total = subtotal * (1 + vatRateValue / 100);

    // Insert invoice and its line items atomically
    const invoiceId = await db.tx(async (c) => {
      const { rows: [{ id }] } = await c.query(`
        INSERT INTO invoices (
          template_id, client_id, invoice_number, date, currency, total, status, notes,
          place_of_issue, payment_method, fiscal_number, contract_number, vat_rate
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
      `, [
        template_id || null,
        client_id || null,
        invoice_number,
        date,
        currency || 'EUR',
        total,
        status || 'draft',
        notes || null,
        place_of_issue || null,
        payment_method || null,
        fiscal_number || null,
        contract_number || null,
        vatRateValue
      ]);

      await insertLineItems(c, id, line_items);
      return id;
    });

    const invoice = await getInvoiceWithDetails(invoiceId);
    res.status(201).json(invoice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update invoice
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      template_id, client_id, invoice_number, date, currency, status, notes, line_items,
      place_of_issue, payment_method, fiscal_number, contract_number, vat_rate
    } = req.body;

    const existing = await db.one('SELECT * FROM invoices WHERE id = $1', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Check for duplicate invoice number (excluding current)
    if (invoice_number && invoice_number !== existing.invoice_number) {
      const duplicate = await db.one('SELECT id FROM invoices WHERE invoice_number = $1 AND id != $2', [invoice_number, id]);
      if (duplicate) {
        return res.status(400).json({ error: 'Invoice number already exists' });
      }
    }

    // Calculate total (incl. VAT) from line items
    const vatRateValue = vat_rate !== undefined ? (parseFloat(vat_rate) || 0) : existing.vat_rate;
    let total = existing.total;
    if (line_items !== undefined) {
      const subtotal = line_items.reduce((sum, item) => {
        return sum + (parseFloat(item.unit_price) * parseFloat(item.quantity || 1));
      }, 0);
      total = subtotal * (1 + vatRateValue / 100);
    }

    // Update invoice and replace its line items atomically
    await db.tx(async (c) => {
      await c.query(`
        UPDATE invoices SET
          template_id = $1,
          client_id = $2,
          invoice_number = $3,
          date = $4,
          currency = $5,
          total = $6,
          status = $7,
          notes = $8,
          place_of_issue = $9,
          payment_method = $10,
          fiscal_number = $11,
          contract_number = $12,
          vat_rate = $13,
          updated_at = now()
        WHERE id = $14
      `, [
        template_id ?? existing.template_id,
        client_id ?? existing.client_id,
        invoice_number || existing.invoice_number,
        date || existing.date,
        currency || existing.currency,
        total,
        status || existing.status,
        notes ?? existing.notes,
        place_of_issue ?? existing.place_of_issue,
        payment_method ?? existing.payment_method,
        fiscal_number ?? existing.fiscal_number,
        contract_number ?? existing.contract_number,
        vatRateValue,
        id
      ]);

      // Update line items if provided
      if (line_items !== undefined) {
        await c.query('DELETE FROM line_items WHERE invoice_id = $1', [id]);
        await insertLineItems(c, id, line_items);
      }
    });

    const invoice = await getInvoiceWithDetails(id);
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE invoice
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db.one('SELECT * FROM invoices WHERE id = $1', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Line items will be deleted automatically due to ON DELETE CASCADE
    await db.run('DELETE FROM invoices WHERE id = $1', [id]);
    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET invoice PDF
router.get('/:id/pdf', async (req, res) => {
  try {
    const invoice = await getInvoiceWithDetails(req.params.id);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const pdfBuffer = await generateInvoicePDF(invoice, { bw: req.query.bw === '1', lang: req.user.language });

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
