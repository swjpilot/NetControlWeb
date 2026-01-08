const express = require('express');
const router = express.Router();
const db = require('../database/postgres-js-db');
const { authenticateToken } = require('./auth-postgres-js');

// Get all operators (with authentication)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { search, class: licenseClass, limit = 25, offset = 0 } = req.query;
    
    let whereConditions = [];
    let searchParams = [];
    
    // Add search filter
    if (search) {
      whereConditions.push(`(
        call_sign ILIKE $${searchParams.length + 1} OR 
        name ILIKE $${searchParams.length + 2} OR 
        city ILIKE $${searchParams.length + 3} OR
        address ILIKE $${searchParams.length + 4}
      )`);
      const searchParam = `%${search}%`;
      searchParams.push(searchParam, searchParam, searchParam, searchParam);
    }
    
    // Add license class filter
    if (licenseClass) {
      whereConditions.push(`license_class = $${searchParams.length + 1}`);
      searchParams.push(licenseClass);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM operators ${whereClause}`;
    const countResult = await db.sql.unsafe(countQuery, searchParams);
    const total = parseInt(countResult[0].count);
    
    // Get operators with pagination
    const dataQuery = `
      SELECT id, call_sign, name, email, phone, 
             address as street, 
             CASE 
               WHEN city IS NOT NULL AND state IS NOT NULL THEN CONCAT(city, ', ', state)
               WHEN city IS NOT NULL THEN city
               WHEN state IS NOT NULL THEN state
               ELSE NULL
             END as location,
             city, state, zip, 
             license_class as class, 
             active, 
             notes as comment, 
             created_at, updated_at
      FROM operators 
      ${whereClause}
      ORDER BY call_sign ASC
      LIMIT $${searchParams.length + 1} OFFSET $${searchParams.length + 2}
    `;
    searchParams.push(parseInt(limit), parseInt(offset));
    
    const operators = await db.sql.unsafe(dataQuery, searchParams);
    
    res.json({
      operators,
      total,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < total
      }
    });
    
  } catch (error) {
    console.error('Get operators error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single operator
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.sql`
      SELECT id, call_sign, name, email, phone, 
             address as street, 
             CASE 
               WHEN city IS NOT NULL AND state IS NOT NULL THEN CONCAT(city, ', ', state)
               WHEN city IS NOT NULL THEN city
               WHEN state IS NOT NULL THEN state
               ELSE NULL
             END as location,
             city, state, zip, 
             license_class as class, 
             active, 
             notes as comment, 
             created_at, updated_at
      FROM operators 
      WHERE id = ${id}
    `;
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Operator not found' });
    }
    
    res.json(result[0]);
    
  } catch (error) {
    console.error('Get operator error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new operator
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      call_sign,
      name,
      email,
      phone,
      address,
      city,
      state,
      zip,
      license_class,
      notes
    } = req.body;
    
    if (!call_sign) {
      return res.status(400).json({ error: 'Call sign is required' });
    }
    
    // Check if call sign already exists
    const existing = await db.sql`
      SELECT id FROM operators WHERE call_sign = ${call_sign}
    `;
    
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Call sign already exists' });
    }
    
    const result = await db.sql`
      INSERT INTO operators (
        call_sign, name, email, phone, address, city, state, zip, 
        license_class, notes, active
      ) VALUES (
        ${call_sign}, ${name || null}, ${email || null}, ${phone || null}, 
        ${address || null}, ${city || null}, ${state || null}, ${zip || null},
        ${license_class || null}, ${notes || null}, true
      ) RETURNING *
    `;
    
    res.status(201).json({ operator: result[0] });
    
  } catch (error) {
    console.error('Create operator error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update operator
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      call_sign,
      name,
      email,
      phone,
      address,
      city,
      state,
      zip,
      license_class,
      notes,
      active
    } = req.body;
    
    if (!call_sign) {
      return res.status(400).json({ error: 'Call sign is required' });
    }
    
    // Check if call sign already exists for different operator
    const existing = await db.sql`
      SELECT id FROM operators WHERE call_sign = ${call_sign} AND id != ${id}
    `;
    
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Call sign already exists' });
    }
    
    const result = await db.sql`
      UPDATE operators SET
        call_sign = ${call_sign},
        name = ${name || null},
        email = ${email || null},
        phone = ${phone || null},
        address = ${address || null},
        city = ${city || null},
        state = ${state || null},
        zip = ${zip || null},
        license_class = ${license_class || null},
        notes = ${notes || null},
        active = ${active !== undefined ? active : true},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Operator not found' });
    }
    
    res.json(result[0]);
    
  } catch (error) {
    console.error('Update operator error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete operator
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.sql`
      DELETE FROM operators WHERE id = ${id} RETURNING *
    `;
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Operator not found' });
    }
    
    res.json({ message: 'Operator deleted successfully' });
    
  } catch (error) {
    console.error('Delete operator error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;