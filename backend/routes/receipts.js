const express = require('express');
const db = require('../database/init');
const { generateReceiptPDF } = require('../services/pdfGenerator');

const router = express.Router();

// Insert line items for a receipt (c = transaction client)
const insertLineItems = async (c, receiptId, lineItems, vatRateValue) => {
  for (const [index, item] of (lineItems || []).entries()) {
    const qty = parseFloat(item.quantity) || 1;
    const price = parseFloat(item.unit_price) || 0;

    await c.query(`
      INSERT INTO line_items (receipt_id, description, unit_price, quantity, vat_rate, total, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [receiptId, item.description, price, qty, parseFloat(item.vat_rate) || vatRateValue, qty * price, index]);
  }
};

// Helper to get receipt with all related data
const getReceiptWithDetails = async (id) => {
  const receipt = await db.one(`
    SELECT r.*,
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
           t.primary_color as template_primary_color,
           t.secondary_color as template_secondary_color,
           t.invoice_layout as template_invoice_layout,
           t.receipt_layout as template_receipt_layout,
           t.background_color as template_background_color,
           t.pattern as template_pattern,
           t.pattern_color as template_pattern_color,
           t.pattern_placement as template_pattern_placement,
           t.pattern_opacity as template_pattern_opacity,
           t.vat_note_en as template_vat_note_en,
           t.vat_note_local as template_vat_note_local,
           c.company_name as client_company_name,
           c.address as client_address,
           c.city as client_city,
           c.country as client_country,
           c.tax_id as client_tax_id,
           c.email as client_email
    FROM receipts r
    LEFT JOIN templates t ON r.template_id = t.id
    LEFT JOIN clients c ON r.client_id = c.id
    WHERE r.id = $1
  `, [id]);

  if (receipt) {
    receipt.line_items = await db.all(`
      SELECT * FROM line_items WHERE receipt_id = $1 ORDER BY sort_order ASC
    `, [id]);
  }

  return receipt;
};

// GET all receipts
router.get('/', async (req, res) => {
  try {
    const { status, from_date, to_date, client_id } = req.query;

    let sql = `
      SELECT r.*, c.company_name as client_name
      FROM receipts r
      LEFT JOIN clients c ON r.client_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      sql += ` AND r.status = $${params.length}`;
    }
    if (from_date) {
      params.push(from_date);
      sql += ` AND r.date >= $${params.length}`;
    }
    if (to_date) {
      params.push(to_date);
      sql += ` AND r.date <= $${params.length}`;
    }
    if (client_id) {
      params.push(client_id);
      sql += ` AND r.client_id = $${params.length}`;
    }

    sql += ' ORDER BY r.date DESC, r.id DESC';

    const receipts = await db.all(sql, params);
    res.json(receipts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single receipt with details
router.get('/:id', async (req, res) => {
  try {
    const receipt = await getReceiptWithDetails(req.params.id);
    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }
    res.json(receipt);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create receipt
router.post('/', async (req, res) => {
  try {
    const {
      template_id, client_id, receipt_number, date, place_of_issue, fiscal_number,
      currency, secondary_currency, exchange_rate, vat_rate,
      vat_note_en, vat_note_local, status, notes, line_items
    } = req.body;

    if (!receipt_number || !date) {
      return res.status(400).json({ error: 'Receipt number and date are required' });
    }

    // Check for duplicate receipt number
    const existing = await db.one('SELECT id FROM receipts WHERE receipt_number = $1', [receipt_number]);
    if (existing) {
      return res.status(400).json({ error: 'Receipt number already exists' });
    }

    // Calculate totals from line items
    let subtotal = 0;
    let vatAmount = 0;
    const vatRateValue = parseFloat(vat_rate) || 0;
    const exchangeRateValue = parseFloat(exchange_rate) || 1.95583;

    if (line_items && line_items.length > 0) {
      subtotal = line_items.reduce((sum, item) => {
        return sum + (parseFloat(item.unit_price) * parseFloat(item.quantity || 1));
      }, 0);
    }

    vatAmount = subtotal * (vatRateValue / 100);
    const total = subtotal + vatAmount;
    const totalSecondary = total * exchangeRateValue;

    // Insert receipt and its line items atomically
    const receiptId = await db.tx(async (c) => {
      const { rows: [{ id }] } = await c.query(`
        INSERT INTO receipts (
          template_id, client_id, receipt_number, date, place_of_issue, fiscal_number,
          currency, secondary_currency, exchange_rate, vat_rate,
          subtotal, vat_amount, total, total_secondary,
          vat_note_en, vat_note_local, status, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING id
      `, [
        template_id || null,
        client_id || null,
        receipt_number,
        date,
        place_of_issue || null,
        fiscal_number || null,
        currency || 'EUR',
        secondary_currency || 'BAM',
        exchangeRateValue,
        vatRateValue,
        subtotal,
        vatAmount,
        total,
        totalSecondary,
        vat_note_en || null,
        vat_note_local || null,
        status || 'draft',
        notes || null
      ]);

      await insertLineItems(c, id, line_items, vatRateValue);
      return id;
    });

    const receipt = await getReceiptWithDetails(receiptId);
    res.status(201).json(receipt);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update receipt
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      template_id, client_id, receipt_number, date, place_of_issue, fiscal_number,
      currency, secondary_currency, exchange_rate, vat_rate,
      vat_note_en, vat_note_local, status, notes, line_items
    } = req.body;

    const existing = await db.one('SELECT * FROM receipts WHERE id = $1', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    // Check for duplicate receipt number (excluding current)
    if (receipt_number && receipt_number !== existing.receipt_number) {
      const duplicate = await db.one('SELECT id FROM receipts WHERE receipt_number = $1 AND id != $2', [receipt_number, id]);
      if (duplicate) {
        return res.status(400).json({ error: 'Receipt number already exists' });
      }
    }

    // Calculate totals from line items
    let subtotal = existing.subtotal;
    let vatAmount = existing.vat_amount;
    let total = existing.total;
    let totalSecondary = existing.total_secondary;

    const vatRateValue = vat_rate !== undefined ? (parseFloat(vat_rate) || 0) : existing.vat_rate;
    const exchangeRateValue = exchange_rate !== undefined ? (parseFloat(exchange_rate) || 1.95583) : existing.exchange_rate;

    if (line_items !== undefined) {
      subtotal = line_items.reduce((sum, item) => {
        return sum + (parseFloat(item.unit_price) * parseFloat(item.quantity || 1));
      }, 0);
      vatAmount = subtotal * (vatRateValue / 100);
      total = subtotal + vatAmount;
      totalSecondary = total * exchangeRateValue;
    }

    // Update receipt and replace its line items atomically
    await db.tx(async (c) => {
      await c.query(`
        UPDATE receipts SET
          template_id = $1,
          client_id = $2,
          receipt_number = $3,
          date = $4,
          place_of_issue = $5,
          fiscal_number = $6,
          currency = $7,
          secondary_currency = $8,
          exchange_rate = $9,
          vat_rate = $10,
          subtotal = $11,
          vat_amount = $12,
          total = $13,
          total_secondary = $14,
          vat_note_en = $15,
          vat_note_local = $16,
          status = $17,
          notes = $18,
          updated_at = now()
        WHERE id = $19
      `, [
        template_id ?? existing.template_id,
        client_id ?? existing.client_id,
        receipt_number || existing.receipt_number,
        date || existing.date,
        place_of_issue ?? existing.place_of_issue,
        fiscal_number ?? existing.fiscal_number,
        currency || existing.currency,
        secondary_currency || existing.secondary_currency,
        exchangeRateValue,
        vatRateValue,
        subtotal,
        vatAmount,
        total,
        totalSecondary,
        vat_note_en ?? existing.vat_note_en,
        vat_note_local ?? existing.vat_note_local,
        status || existing.status,
        notes ?? existing.notes,
        id
      ]);

      // Update line items if provided
      if (line_items !== undefined) {
        await c.query('DELETE FROM line_items WHERE receipt_id = $1', [id]);
        await insertLineItems(c, id, line_items, vatRateValue);
      }
    });

    const receipt = await getReceiptWithDetails(id);
    res.json(receipt);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE receipt
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db.one('SELECT * FROM receipts WHERE id = $1', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    // Line items will be deleted automatically due to ON DELETE CASCADE
    await db.run('DELETE FROM receipts WHERE id = $1', [id]);
    res.json({ message: 'Receipt deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET receipt PDF
router.get('/:id/pdf', async (req, res) => {
  try {
    const receipt = await getReceiptWithDetails(req.params.id);
    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    const pdfBuffer = await generateReceiptPDF(receipt, { bw: req.query.bw === '1', lang: req.user.language });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${receipt.receipt_number}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(Buffer.from(pdfBuffer));
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
