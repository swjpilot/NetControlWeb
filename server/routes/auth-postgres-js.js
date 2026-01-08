const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const db = require('../database/postgres-js-db');

const JWT_SECRET = process.env.JWT_SECRET || 'netcontrol-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Find user
    const result = await db.sql`
      SELECT id, username, password_hash, email, role, call_sign, name, active 
      FROM users 
      WHERE username = ${username}
    `;
    
    if (result.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result[0];
    
    if (!user.active) {
      return res.status(401).json({ error: 'Account is disabled' });
    }
    
    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Update last login
    await db.sql`
      UPDATE users 
      SET last_login = CURRENT_TIMESTAMP 
      WHERE id = ${user.id}
    `;
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        username: user.username, 
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        callSign: user.call_sign,
        name: user.name
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout (client-side token removal, but we can log it)
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

// Get current user info
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await db.sql`
      SELECT id, username, email, role, call_sign, name, active 
      FROM users 
      WHERE id = ${req.user.userId}
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
      active: user.active
    });
    
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { name, email, callSign } = req.body;
    
    const result = await db.sql`
      UPDATE users SET
        name = ${name || null},
        email = ${email || null},
        call_sign = ${callSign || null},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${req.user.userId}
      RETURNING id, username, email, role, call_sign, name, active
    `;
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result[0];
    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        callSign: user.call_sign,
        name: user.name,
        active: user.active
      }
    });
    
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change password
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    
    // Get current user
    const userResult = await db.sql`
      SELECT password_hash FROM users WHERE id = ${req.user.userId}
    `;
    
    if (userResult.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, userResult[0].password_hash);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    
    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    
    // Update password
    await db.sql`
      UPDATE users SET
        password_hash = ${newPasswordHash},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${req.user.userId}
    `;
    
    res.json({ message: 'Password changed successfully' });
    
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get users with call signs for net control dropdown
router.get('/net-control-users', authenticateToken, async (req, res) => {
  try {
    const result = await db.sql`
      SELECT id, username, name, call_sign
      FROM users 
      WHERE active = true AND call_sign IS NOT NULL AND call_sign != ''
      ORDER BY call_sign ASC
    `;
    
    res.json({
      users: result.map(user => ({
        id: user.id,
        username: user.username,
        name: user.name,
        callSign: user.call_sign
      }))
    });
    
  } catch (error) {
    console.error('Get net control users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register new user (public endpoint for registration)
router.post('/register', async (req, res) => {
  try {
    const { username, password, email, name, callSign } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
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
        username, password_hash, email, role, call_sign, name, active
      ) VALUES (
        ${username}, ${passwordHash}, ${email || null}, 'user', 
        ${callSign || null}, ${name || null}, true
      ) RETURNING id, username, email, role, call_sign, name, active, created_at
    `;
    
    const newUser = result[0];
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: newUser.id, 
        username: newUser.username, 
        role: newUser.role 
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    res.status(201).json({
      success: true,
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        callSign: newUser.call_sign,
        name: newUser.name,
        active: newUser.active
      }
    });
    
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Forgot password (placeholder - would need email service)
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Check if user exists
    const result = await db.sql`
      SELECT id, username FROM users WHERE email = ${email}
    `;
    
    if (result.length === 0) {
      // Don't reveal if email exists or not for security
      return res.json({ success: true, message: 'If the email exists, password reset instructions have been sent' });
    }
    
    // In a real implementation, you would:
    // 1. Generate a secure reset token
    // 2. Store it in database with expiration
    // 3. Send email with reset link
    
    res.json({ success: true, message: 'Password reset functionality not yet implemented' });
    
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify reset token (placeholder)
router.get('/verify-reset-token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // In a real implementation, you would verify the token from database
    res.status(400).json({ error: 'Password reset functionality not yet implemented' });
    
  } catch (error) {
    console.error('Verify reset token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset password (placeholder)
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    // In a real implementation, you would:
    // 1. Verify the token
    // 2. Update the user's password
    // 3. Invalidate the token
    
    res.status(400).json({ error: 'Password reset functionality not yet implemented' });
    
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// Middleware to require admin role
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = router;
module.exports.authenticateToken = authenticateToken;
module.exports.requireAdmin = requireAdmin;