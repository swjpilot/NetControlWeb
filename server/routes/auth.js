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
      console.log(`Login attempt failed: User '${username}' not found or inactive`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    console.log(`Login attempt for user '${username}' (ID: ${user.id})`);
    console.log(`Password hash in database: ${user.password_hash.substring(0, 20)}...`);
    
    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    console.log(`Password verification result: ${validPassword}`);
    console.log(`Provided password length: ${password.length}`);
    
    if (!validPassword) {
      console.log(`Login failed for user '${username}': Invalid password`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    console.log(`Login successful for user '${username}'`);
    
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
    
    console.log(`Hashing password for user ${user.username}: ${newPassword.length} characters`);
    
    // Update password
    await db.run(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, userId]
    );
    
    console.log(`Password reset for user ${user.username} by admin ${req.user.username}`);
    console.log(`New password hash length: ${hashedPassword.length}`);
    
    // Verify the password was actually updated
    const updatedUser = await db.get('SELECT password_hash FROM users WHERE id = ?', [userId]);
    console.log(`Password hash in database matches: ${updatedUser.password_hash === hashedPassword}`);
    
    res.json({ 
      message: `Password reset successfully for user ${user.username}`,
      username: user.username
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Forgot password - send reset email
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Find user by email
    const user = await db.get('SELECT id, username, email FROM users WHERE email = ? AND active = 1', [email]);
    
    if (!user) {
      // Don't reveal if email exists or not for security
      return res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    }
    
    // Generate reset token
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    
    // Clean up old tokens for this user
    await db.run('DELETE FROM password_reset_tokens WHERE user_id = ?', [user.id]);
    
    // Store reset token
    await db.run(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, token, expiresAt.toISOString()]
    );
    
    // Send reset email
    const EmailService = require('../utils/emailService');
    const emailService = new EmailService();
    
    const resetUrl = `${req.protocol}://${req.get('host')}/reset-password?token=${token}`;
    
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c3e50;">NetControl Password Reset</h2>
        <p>Hello ${user.username},</p>
        <p>You requested a password reset for your NetControl account. Click the link below to reset your password:</p>
        <p style="margin: 20px 0;">
          <a href="${resetUrl}" style="background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Reset Password
          </a>
        </p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this password reset, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${resetUrl}">${resetUrl}</a>
        </p>
      </div>
    `;
    
    const emailText = `
NetControl Password Reset

Hello ${user.username},

You requested a password reset for your NetControl account. Visit the following link to reset your password:

${resetUrl}

This link will expire in 1 hour.

If you didn't request this password reset, you can safely ignore this email.
    `;
    
    await emailService.sendEmail({
      to: user.email,
      subject: 'NetControl Password Reset',
      html: emailHtml,
      text: emailText
    });
    
    console.log(`Password reset email sent to ${user.email} for user ${user.username}`);
    
    res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

// Reset password with token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    // Find valid token
    const resetToken = await db.get(`
      SELECT rt.*, u.username, u.email 
      FROM password_reset_tokens rt
      JOIN users u ON rt.user_id = u.id
      WHERE rt.token = ? AND rt.used = 0 AND rt.expires_at > datetime('now')
    `, [token]);
    
    if (!resetToken) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    
    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Update password
    await db.run(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, resetToken.user_id]
    );
    
    // Mark token as used
    await db.run('UPDATE password_reset_tokens SET used = 1 WHERE id = ?', [resetToken.id]);
    
    console.log(`Password reset completed for user ${resetToken.username}`);
    
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Verify reset token
router.get('/verify-reset-token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    const resetToken = await db.get(`
      SELECT rt.*, u.username 
      FROM password_reset_tokens rt
      JOIN users u ON rt.user_id = u.id
      WHERE rt.token = ? AND rt.used = 0 AND rt.expires_at > datetime('now')
    `, [token]);
    
    if (!resetToken) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    
    res.json({ 
      valid: true, 
      username: resetToken.username,
      expiresAt: resetToken.expires_at
    });
  } catch (error) {
    console.error('Verify reset token error:', error);
    res.status(500).json({ error: 'Failed to verify reset token' });
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