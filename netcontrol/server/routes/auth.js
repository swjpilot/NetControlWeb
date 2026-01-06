const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const db = require('../database/db');

const JWT_SECRET = process.env.JWT_SECRET || 'netcontrol-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

// Register new user (admin only)
router.post('/register', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, password, email, role = 'user', callSign, name } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    if (role !== 'user' && role !== 'admin') {
      return res.status(400).json({ error: 'Role must be either "user" or "admin"' });
    }
    
    // Check if user already exists
    const existingUser = await db.get(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );
    
    if (existingUser) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }
    
    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Create user
    const result = await db.run(`
      INSERT INTO users (username, password_hash, email, role, call_sign, name, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [username, hashedPassword, email, role, callSign, name, req.user.id]);
    
    const newUser = await db.get(
      'SELECT id, username, email, role, call_sign, name, created_at FROM users WHERE id = ?',
      [result.id]
    );
    
    res.status(201).json({
      message: 'User created successfully',
      user: newUser
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Find user
    const user = await db.get(
      'SELECT * FROM users WHERE username = ? AND active = 1',
      [username]
    );
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Update last login
    await db.run(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
      [user.id]
    );
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role,
        callSign: user.call_sign
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    res.json({
      message: 'Login successful',
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
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await db.get(
      'SELECT id, username, email, role, call_sign, name, created_at, last_login FROM users WHERE id = ?',
      [req.user.id]
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { email, callSign, name } = req.body;
    
    await db.run(`
      UPDATE users SET 
        email = ?, call_sign = ?, name = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [email, callSign, name, req.user.id]);
    
    const updatedUser = await db.get(
      'SELECT id, username, email, role, call_sign, name FROM users WHERE id = ?',
      [req.user.id]
    );
    
    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Change password
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    
    // Get current user
    const user = await db.get('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    
    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Update password
    await db.run(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, req.user.id]
    );
    
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Get all users (admin only)
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await db.all(`
      SELECT 
        id, username, email, role, call_sign, name, active,
        created_at, last_login,
        (SELECT username FROM users u2 WHERE u2.id = users.created_by) as created_by_username
      FROM users 
      ORDER BY created_at DESC
    `);
    
    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Update user (admin only)
router.put('/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { email, role, callSign, name, active } = req.body;
    
    // Don't allow changing your own role
    if (parseInt(userId) === req.user.id && role !== req.user.role) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }
    
    await db.run(`
      UPDATE users SET 
        email = ?, role = ?, call_sign = ?, name = ?, active = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [email, role, callSign, name, active ? 1 : 0, userId]);
    
    const updatedUser = await db.get(
      'SELECT id, username, email, role, call_sign, name, active FROM users WHERE id = ?',
      [userId]
    );
    
    res.json({
      message: 'User updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Reset user password (admin only)
router.put('/users/:userId/reset-password', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;
    
    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    // Get user info for logging
    const user = await db.get('SELECT username FROM users WHERE id = ?', [userId]);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Update password
    await db.run(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, userId]
    );
    
    console.log(`Password reset for user ${user.username} by admin ${req.user.username}`);
    
    res.json({ 
      message: `Password reset successfully for user ${user.username}`,
      username: user.username
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Delete user (admin only)
router.delete('/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Don't allow deleting yourself
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    const result = await db.run('DELETE FROM users WHERE id = ?', [userId]);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Logout (client-side token removal, but we can track it server-side if needed)
router.post('/logout', authenticateToken, (req, res) => {
  res.json({ message: 'Logout successful' });
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

// Export middleware for use in other routes
// Get users with callsigns for net control selection
router.get('/net-control-users', authenticateToken, async (req, res) => {
  try {
    const users = await db.all(`
      SELECT id, username, name, call_sign
      FROM users 
      WHERE call_sign IS NOT NULL AND call_sign != ''
      ORDER BY call_sign ASC
    `);
    
    res.json({ users });
  } catch (error) {
    console.error('Error fetching net control users:', error);
    res.status(500).json({ error: 'Failed to fetch net control users' });
  }
});

module.exports = router;
module.exports.authenticateToken = authenticateToken;
module.exports.requireAdmin = requireAdmin;