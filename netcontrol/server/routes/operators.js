const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticateToken } = require('./auth');

// Get all operators (with authentication)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { search, class: licenseClass, limit = 25, offset = 0 } = req.query;
    
    let baseQuery = `
      FROM operators o
      LEFT JOIN users u ON o.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    
    // Add search filter
    if (search) {
      baseQuery += ` AND (
        o.call_sign LIKE ? OR 
        o.name LIKE ? OR 
        o.location LIKE ? OR
        o.street LIKE ?
      )`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }
    
    // Add license class filter
    if (licenseClass) {
      baseQuery += ` AND o.class = ?`;
      params.push(licenseClass);
    }
    
    // Get total count
    const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
    const totalResult = await db.get(countQuery, params);
    const total = totalResult.total;
    
    // Get paginated results
    const dataQuery = `
      SELECT o.*, u.username as created_by_username
      ${baseQuery}
      ORDER BY o.call_sign ASC 
      LIMIT ? OFFSET ?
    `;
    const operators = await db.all(dataQuery, [...params, parseInt(limit), parseInt(offset)]);
    
    res.json({ 
      operators,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore: (parseInt(offset) + operators.length) < total
    });
  } catch (error) {
    console.error('Error fetching operators:', error);
    res.status(500).json({ error: 'Failed to fetch operators' });
  }
});

// Get single operator (with authentication)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const operator = await db.get(`
      SELECT o.*, u.username as created_by_username
      FROM operators o
      LEFT JOIN users u ON o.created_by = u.id
      WHERE o.id = ?
    `, [id]);
    
    if (!operator) {
      return res.status(404).json({ error: 'Operator not found' });
    }
    
    res.json({ operator });
  } catch (error) {
    console.error('Error fetching operator:', error);
    res.status(500).json({ error: 'Failed to fetch operator' });
  }
});

// Create new operator (with authentication)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      callSign,
      name,
      street,
      location,
      comment,
      class: licenseClass,
      grid,
      email
    } = req.body;
    
    // Validate required fields
    if (!callSign) {
      return res.status(400).json({ error: 'Callsign is required' });
    }
    
    // Validate callsign format
    if (!/^[A-Z0-9/]+$/i.test(callSign)) {
      return res.status(400).json({ error: 'Invalid callsign format' });
    }
    
    // Check if callsign already exists
    const existing = await db.get('SELECT id FROM operators WHERE call_sign = ?', [callSign.toUpperCase()]);
    if (existing) {
      return res.status(400).json({ error: 'Callsign already exists' });
    }
    
    // Validate email format if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    // Insert new operator
    const result = await db.run(`
      INSERT INTO operators (
        call_sign, name, street, location, comment, class, grid, email,
        has_comments, has_traffic, acknowledged, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      callSign.toUpperCase(),
      name || null,
      street || null,
      location || null,
      comment || null,
      licenseClass || null,
      grid ? grid.toUpperCase() : null,
      email || null,
      comment ? 1 : 0, // has_comments
      0, // has_traffic
      0, // acknowledged
      req.user.id
    ]);
    
    // Fetch the created operator
    const newOperator = await db.get(`
      SELECT o.*, u.username as created_by_username
      FROM operators o
      LEFT JOIN users u ON o.created_by = u.id
      WHERE o.id = ?
    `, [result.id]);
    
    console.log(`Operator ${callSign} created by user ${req.user.username}`);
    
    res.status(201).json({ 
      message: 'Operator created successfully',
      operator: newOperator
    });
  } catch (error) {
    console.error('Error creating operator:', error);
    res.status(500).json({ error: 'Failed to create operator' });
  }
});

// Update operator (with authentication)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      callSign,
      name,
      street,
      location,
      comment,
      class: licenseClass,
      grid,
      email
    } = req.body;
    
    // Check if operator exists
    const existing = await db.get('SELECT * FROM operators WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Operator not found' });
    }
    
    // Validate required fields
    if (!callSign) {
      return res.status(400).json({ error: 'Callsign is required' });
    }
    
    // Validate callsign format
    if (!/^[A-Z0-9/]+$/i.test(callSign)) {
      return res.status(400).json({ error: 'Invalid callsign format' });
    }
    
    // Check if callsign already exists (excluding current operator)
    const duplicateCallsign = await db.get(
      'SELECT id FROM operators WHERE call_sign = ? AND id != ?', 
      [callSign.toUpperCase(), id]
    );
    if (duplicateCallsign) {
      return res.status(400).json({ error: 'Callsign already exists' });
    }
    
    // Validate email format if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    // Update operator
    await db.run(`
      UPDATE operators SET
        call_sign = ?, name = ?, street = ?, location = ?, comment = ?,
        class = ?, grid = ?, email = ?, has_comments = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      callSign.toUpperCase(),
      name || null,
      street || null,
      location || null,
      comment || null,
      licenseClass || null,
      grid ? grid.toUpperCase() : null,
      email || null,
      comment ? 1 : 0, // has_comments
      id
    ]);
    
    // Fetch the updated operator
    const updatedOperator = await db.get(`
      SELECT o.*, u.username as created_by_username
      FROM operators o
      LEFT JOIN users u ON o.created_by = u.id
      WHERE o.id = ?
    `, [id]);
    
    console.log(`Operator ${callSign} updated by user ${req.user.username}`);
    
    res.json({ 
      message: 'Operator updated successfully',
      operator: updatedOperator
    });
  } catch (error) {
    console.error('Error updating operator:', error);
    res.status(500).json({ error: 'Failed to update operator' });
  }
});

// Delete operator (with authentication)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if operator exists
    const existing = await db.get('SELECT call_sign FROM operators WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Operator not found' });
    }
    
    // Check if operator is referenced in any sessions
    const sessionCount = await db.get(`
      SELECT COUNT(*) as count FROM session_participants 
      WHERE operator_id = ?
    `, [id]);
    
    if (sessionCount.count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete operator - referenced in net sessions' 
      });
    }
    
    // Delete operator
    await db.run('DELETE FROM operators WHERE id = ?', [id]);
    
    console.log(`Operator ${existing.call_sign} deleted by user ${req.user.username}`);
    
    res.json({ message: 'Operator deleted successfully' });
  } catch (error) {
    console.error('Error deleting operator:', error);
    res.status(500).json({ error: 'Failed to delete operator' });
  }
});

// Get operator statistics (with authentication)
router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const stats = await db.all(`
      SELECT 
        COUNT(*) as total_operators,
        COUNT(CASE WHEN class = 'Technician' THEN 1 END) as technician,
        COUNT(CASE WHEN class = 'General' THEN 1 END) as general,
        COUNT(CASE WHEN class = 'Amateur Extra' THEN 1 END) as extra,
        COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) as with_email,
        COUNT(CASE WHEN has_comments = 1 THEN 1 END) as with_comments
      FROM operators
    `);
    
    res.json({ stats: stats[0] });
  } catch (error) {
    console.error('Error fetching operator stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Search operators by callsign prefix (for autocomplete)
router.get('/search/callsign', authenticateToken, async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    
    if (!q || q.length < 1) {
      return res.json({ operators: [] });
    }
    
    const operators = await db.all(`
      SELECT call_sign, name FROM operators 
      WHERE call_sign LIKE ? 
      ORDER BY call_sign ASC 
      LIMIT ?
    `, [`${q.toUpperCase()}%`, parseInt(limit)]);
    
    res.json({ operators });
  } catch (error) {
    console.error('Error searching operators:', error);
    res.status(500).json({ error: 'Failed to search operators' });
  }
});

module.exports = router;