const express = require('express');
const db = require('../database/init');

const router = express.Router();

// GET all clients
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let clients;

    if (search) {
      clients = await db.all(`
        SELECT * FROM clients
        WHERE company_name ILIKE $1 OR tax_id ILIKE $1 OR email ILIKE $1
        ORDER BY company_name ASC
      `, [`%${search}%`]);
    } else {
      clients = await db.all('SELECT * FROM clients ORDER BY company_name ASC');
    }

    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single client
router.get('/:id', async (req, res) => {
  try {
    const client = await db.one('SELECT * FROM clients WHERE id = $1', [req.params.id]);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json(client);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create client
router.post('/', async (req, res) => {
  try {
    const { company_name, address, city, country, tax_id, email, phone } = req.body;

    if (!company_name) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    const client = await db.one(`
      INSERT INTO clients (company_name, address, city, country, tax_id, email, phone)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      company_name,
      address || null,
      city || null,
      country || null,
      tax_id || null,
      email || null,
      phone || null
    ]);

    res.status(201).json(client);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update client
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { company_name, address, city, country, tax_id, email, phone } = req.body;

    const existing = await db.one('SELECT * FROM clients WHERE id = $1', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const client = await db.one(`
      UPDATE clients SET
        company_name = $1,
        address = $2,
        city = $3,
        country = $4,
        tax_id = $5,
        email = $6,
        phone = $7
      WHERE id = $8
      RETURNING *
    `, [
      company_name || existing.company_name,
      address ?? existing.address,
      city ?? existing.city,
      country ?? existing.country,
      tax_id ?? existing.tax_id,
      email ?? existing.email,
      phone ?? existing.phone,
      id
    ]);

    res.json(client);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE client
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db.one('SELECT * FROM clients WHERE id = $1', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Client not found' });
    }

    await db.run('DELETE FROM clients WHERE id = $1', [id]);
    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
