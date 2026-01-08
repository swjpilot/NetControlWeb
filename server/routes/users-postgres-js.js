const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../database/postgres-js-db');
const { authenticateToken, requireAdmin } = require('./auth-postgres-js');

// Get all users (admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { limit = 25, offset = 0, search } = req.query;
    
    let whereConditions = [];
    let searchParams = [];
    
    if (search) {
      whereConditions.push(`(
        username ILIKE $${searchParams.length + 1} OR 
        name ILIKE $${searchParams.length + 2} OR 
        email ILIKE $${searchParams.length + 3} OR
        call_sign ILIKE $${searchParams.length + 4}
      )`);
      const searchParam = `%${search}%`;
      searchParams.push(searchParam, searchParam, searchParam, searchParam);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM users ${whereClause}`;
    const countResult = await db.sql.unsafe(countQuery, searchParams);
    const total = parseInt(countResult[0].count);
    
    // Get users with pagination
    const dataQuery = `
      SELECT id, username, email, role, call_sign, name, active, 
             created_at, updated_at, last_login
      FROM users 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${searchParams.length + 1} OFFSET $${searchParams.length + 2}
    `;
    searchParams.push(parseInt(limit), parseInt(offset));
    
    const users = await db.sql.unsafe(dataQuery, searchParams);
    
    // Remove password hashes from response
    const safeUsers = users.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      callSign: user.call_sign,
      name: user.name,
      active: user.active,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      lastLogin: user.last_login
    }));
    
    res.json({
      users: safeUsers,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < total
      }
    });
    
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single user (admin only)
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.sql`
      SELECT id, username, email, role, call_sign, name, active, 
             created_at, updated_at, last_login
      FROM users 
      WHERE id = ${id}
    `;
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result[0];
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      callSign: user.call_sign,
      name: user.name,
      active: user.active,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      lastLogin: user.last_login
    });
    
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new user (admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, password, email, role, callSign, name } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    if (role && !['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    // Check if username already exists
    const existing = await db.sql`
      SELECT id FROM users WHERE username = ${username}
    `;
    
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    // Check if email already exists (if provided)
    if (email) {
      const existingEmail = await db.sql`
        SELECT id FROM users WHERE email = ${email}
      `;
      
      if (existingEmail.length > 0) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    
    const result = await db.sql`
      INSERT INTO users (
        username, password_hash, email, role, call_sign, name, active, created_by
      ) VALUES (
        ${username}, ${passwordHash}, ${email || null}, ${role || 'user'}, 
        ${callSign || null}, ${name || null}, true, ${req.user.userId}
      ) RETURNING id, username, email, role, call_sign, name, active, created_at
    `;
    
    const newUser = result[0];
    res.status(201).json({
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
      callSign: newUser.call_sign,
      name: newUser.name,
      active: newUser.active,
      createdAt: newUser.created_at
    });
    
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user (admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, role, callSign, name, active } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    if (role && !['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    // Check if username already exists for different user
    const existingUsername = await db.sql`
      SELECT id FROM users WHERE username = ${username} AND id != ${id}
    `;
    
    if (existingUsername.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    // Check if email already exists for different user (if provided)
    if (email) {
      const existingEmail = await db.sql`
        SELECT id FROM users WHERE email = ${email} AND id != ${id}
      `;
      
      if (existingEmail.length > 0) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }
    
    const result = await db.sql`
      UPDATE users SET
        username = ${username},
        email = ${email || null},
        role = ${role || 'user'},
        call_sign = ${callSign || null},
        name = ${name || null},
        active = ${active !== undefined ? active : true},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING id, username, email, role, call_sign, name, active, updated_at
    `;
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result[0];
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      callSign: user.call_sign,
      name: user.name,
      active: user.active,
      updatedAt: user.updated_at
    });
    
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset user password (admin only)
router.put('/:id/reset-password', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    
    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required' });
    }
    
    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);
    
    const result = await db.sql`
      UPDATE users SET
        password_hash = ${passwordHash},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING id
    `;
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: 'Password reset successfully' });
    
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Prevent deleting yourself
    if (parseInt(id) === req.user.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    const result = await db.sql`
      DELETE FROM users WHERE id = ${id} RETURNING *
    `;
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: 'User deleted successfully' });
    
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;