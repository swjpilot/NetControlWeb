const express = require('express');
const router = express.Router();
const db = require('../database/postgres-js-db');
const { authenticateToken, requireWrite } = require('./auth-postgres-js');

// Get all operators (with authentication)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { search, class: licenseClass, limit = 25, offset = 0, sort = 'call_sign', order = 'asc' } = req.query;
    
    // Validate sort field to prevent SQL injection
    const allowedSortFields = {
      'call_sign': 'call_sign',
      'name': 'name',
      'location': 'city',
      'class': 'license_class',
      'updated_at': 'updated_at'
    };
    const sortField = allowedSortFields[sort] || 'call_sign';
    const sortOrder = order === 'desc' ? 'DESC' : 'ASC';
    
    let whereConditions = [];
    let searchParams = [];
    
    // Add search filter
    if (search) {
      const p1 = '$' + (searchParams.length + 1);
      const p2 = '$' + (searchParams.length + 2);
      const p3 = '$' + (searchParams.length + 3);
      const p4 = '$' + (searchParams.length + 4);
      whereConditions.push('(' +
        'call_sign ILIKE ' + p1 + ' OR ' +
        'name ILIKE ' + p2 + ' OR ' +
        'city ILIKE ' + p3 + ' OR ' +
        'address ILIKE ' + p4 +
      ')');
      const searchParam = '%' + search + '%';
      searchParams.push(searchParam, searchParam, searchParam, searchParam);
    }
    
    // Add license class filter
    if (licenseClass) {
      whereConditions.push('license_class = $' + (searchParams.length + 1));
      searchParams.push(licenseClass);
    }
    
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    // Get total count
    const countQuery = 'SELECT COUNT(*) as count FROM operators ' + whereClause;
    const countResult = await db.sql.unsafe(countQuery, searchParams);
    const total = parseInt(countResult[0].count);
    
    // Get operators with pagination - compute placeholders before pushing
    const limitParam = '$' + (searchParams.length + 1);
    const offsetParam = '$' + (searchParams.length + 2);
    const dataQuery =
      'SELECT id, call_sign, name, email, phone, ' +
      'address as street, ' +
      'CASE ' +
        'WHEN city IS NOT NULL AND state IS NOT NULL THEN CONCAT(city, \', \', state) ' +
        'WHEN city IS NOT NULL THEN city ' +
        'WHEN state IS NOT NULL THEN state ' +
        'ELSE NULL ' +
      'END as location, ' +
      'city, state, zip, ' +
      'license_class as class, ' +
      'preferred_name, ' +
      'active, ' +
      'notes as comment, ' +
      'created_at, updated_at ' +
      'FROM operators ' +
      whereClause + ' ' +
      'ORDER BY ' + sortField + ' ' + sortOrder + ' ' +
      'LIMIT ' + limitParam + ' OFFSET ' + offsetParam;
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
             preferred_name,
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
      preferred_name,
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
        license_class, preferred_name, notes, active
      ) VALUES (
        ${call_sign}, ${name || null}, ${email || null}, ${phone || null}, 
        ${address || null}, ${city || null}, ${state || null}, ${zip || null},
        ${license_class || null}, ${preferred_name || null}, ${notes || null}, true
      ) RETURNING *
    `;
    
    res.status(201).json({ operator: result[0] });
    
  } catch (error) {
    console.error('Create operator error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upsert operator (insert or update if call sign exists) - used by QRZ lookup
router.post('/upsert', authenticateToken, async (req, res) => {
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
    
    // Check if operator already exists
    const existing = await db.sql`
      SELECT id FROM operators WHERE UPPER(call_sign) = UPPER(${call_sign})
    `;
    
    if (existing.length > 0) {
      // Update existing operator with new QRZ data
      const result = await db.sql`
        UPDATE operators SET
          name = COALESCE(NULLIF(${name || null}, ''), name),
          email = COALESCE(NULLIF(${email || null}, ''), email),
          phone = COALESCE(NULLIF(${phone || null}, ''), phone),
          address = COALESCE(NULLIF(${address || null}, ''), address),
          city = COALESCE(NULLIF(${city || null}, ''), city),
          state = COALESCE(NULLIF(${state || null}, ''), state),
          zip = COALESCE(NULLIF(${zip || null}, ''), zip),
          license_class = COALESCE(NULLIF(${license_class || null}, ''), license_class),
          notes = COALESCE(NULLIF(${notes || null}, ''), notes),
          updated_at = CURRENT_TIMESTAMP
        WHERE UPPER(call_sign) = UPPER(${call_sign})
        RETURNING *
      `;
      return res.json({ operator: result[0], updated: true });
    }
    
    // Insert new operator
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
    
    res.status(201).json({ operator: result[0], updated: false });
    
  } catch (error) {
    console.error('Upsert operator error:', error);
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
      preferred_name,
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
        preferred_name = ${preferred_name || null},
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

// Update operator preferred name only
router.patch('/:id/preferred-name', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { preferred_name } = req.body;
    
    const result = await db.sql`
      UPDATE operators SET
        preferred_name = ${preferred_name || null},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING id, preferred_name
    `;
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Operator not found' });
    }
    
    res.json(result[0]);
  } catch (error) {
    console.error('Update preferred name error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update operator from QRZ data
router.post('/:id/update-from-qrz', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get current operator
    const existing = await db.sql`SELECT * FROM operators WHERE id = ${id}`;
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Operator not found' });
    }
    const operator = existing[0];

    // Look up on QRZ
    const { getQRZSession, mapLicenseClass } = require('./qrz-postgres-js');
    const axios = require('axios');
    const xml2js = require('xml2js');

    const sessionKey = await getQRZSession();
    const response = await axios.get('https://xmldata.qrz.com/xml/current/', {
      params: { s: sessionKey, callsign: operator.call_sign.toUpperCase() },
      timeout: 10000
    });

    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(response.data);

    // Handle session expiry — retry once
    if (result.QRZDatabase && result.QRZDatabase.Session && result.QRZDatabase.Session[0].Error) {
      const errMsg = result.QRZDatabase.Session[0].Error[0];
      if (errMsg.toLowerCase().includes('session') || errMsg.toLowerCase().includes('invalid')) {
        // Force new session by clearing cache (getQRZSession handles this internally on next call)
        const freshKey = await getQRZSession();
        const retry = await axios.get('https://xmldata.qrz.com/xml/current/', {
          params: { s: freshKey, callsign: operator.call_sign.toUpperCase() },
          timeout: 10000
        });
        const retryResult = await parser.parseStringPromise(retry.data);
        if (retryResult.QRZDatabase && retryResult.QRZDatabase.Callsign) {
          Object.assign(result, retryResult);
        } else {
          return res.status(404).json({ error: 'QRZ lookup failed: ' + errMsg });
        }
      } else {
        return res.status(404).json({ error: 'QRZ: ' + errMsg });
      }
    }

    if (!result.QRZDatabase || !result.QRZDatabase.Callsign || !result.QRZDatabase.Callsign[0]) {
      return res.status(404).json({ error: 'Call sign not found on QRZ' });
    }

    const qrz = result.QRZDatabase.Callsign[0];
    const qrzFullName = [qrz.fname ? qrz.fname[0] : '', qrz.name ? qrz.name[0] : ''].filter(Boolean).join(' ');
    const qrzFirstName = qrz.fname ? qrz.fname[0] : '';

    // Only preserve existing preferred_name — don't auto-create one
    const newPreferredName = operator.preferred_name || null;

    // Update operator with QRZ data
    const updated = await db.sql`
      UPDATE operators SET
        name = ${qrzFullName || operator.name},
        preferred_name = ${newPreferredName || operator.preferred_name || null},
        address = ${qrz.addr1 ? qrz.addr1[0] : operator.address},
        city = ${qrz.addr2 ? qrz.addr2[0] : operator.city},
        state = ${qrz.state ? qrz.state[0] : operator.state},
        zip = ${qrz.zip ? qrz.zip[0] : operator.zip},
        email = ${qrz.email ? qrz.email[0] : operator.email},
        license_class = ${qrz.class ? mapLicenseClass(qrz.class[0]) : operator.license_class},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    res.json({
      success: true,
      operator: updated[0],
      preferred_name_set: newPreferredName !== operator.preferred_name,
      qrz_name: qrzFullName
    });
  } catch (error) {
    console.error('Update from QRZ error:', error);
    res.status(500).json({ error: error.message || 'QRZ update failed' });
  }
});

module.exports = router;
