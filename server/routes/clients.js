const express = require('express');
const db = require('../database/init');

const router = express.Router();

// GET all clients
router.get('/', (req, res) => {
  try {
    const { search } = req.query;
    let clients;

    if (search) {
      clients = db.prepare(`
        SELECT * FROM clients
        WHERE company_name LIKE ? OR tax_id LIKE ? OR email LIKE ?
        ORDER BY company_name ASC
      `).all(`%${search}%`, `%${search}%`, `%${search}%`);
    } else {
      clients = db.prepare('SELECT * FROM clients ORDER BY company_name ASC').all();
    }

    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single client
router.get('/:id', (req, res) => {
  try {
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json(client);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create client
router.post('/', (req, res) => {
  try {
    const { company_name, address, city, country, tax_id, email, phone } = req.body;

    if (!company_name) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    const stmt = db.prepare(`
      INSERT INTO clients (company_name, address, city, country, tax_id, email, phone)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      company_name,
      address || null,
      city || null,
      country || null,
      tax_id || null,
      email || null,
      phone || null
    );

    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(client);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update client
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { company_name, address, city, country, tax_id, email, phone } = req.body;

    const existing = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const stmt = db.prepare(`
      UPDATE clients SET
        company_name = ?,
        address = ?,
        city = ?,
        country = ?,
        tax_id = ?,
        email = ?,
        phone = ?
      WHERE id = ?
    `);

    stmt.run(
      company_name || existing.company_name,
      address ?? existing.address,
      city ?? existing.city,
      country ?? existing.country,
      tax_id ?? existing.tax_id,
      email ?? existing.email,
      phone ?? existing.phone,
      id
    );

    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
    res.json(client);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE client
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Client not found' });
    }

    db.prepare('DELETE FROM clients WHERE id = ?').run(id);
    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
