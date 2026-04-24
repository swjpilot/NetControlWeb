const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const db = require('../database/postgres-js-db');

const JWT_SECRET = process.env.JWT_SECRET || 'netcontrol-secret-key-change-in-production';
const JWT_EXPIRES_IN = '36h';

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Find user
    const result = await db.sql`
      SELECT id, username, password_hash, email, role, call_sign, name, active, force_password_change 
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
        name: user.name,
        forcePasswordChange: user.force_password_change || false
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

// Middleware to require write access (blocks readonly users)
function requireWrite(req, res, next) {
  if (req.user.role === 'readonly') {
    return res.status(403).json({ error: 'Read-only users cannot perform this action' });
  }
  next();
}

// Change password (for forced password change or user-initiated)
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    
    // Get user with current password
    const result = await db.sql`
      SELECT id, password_hash, force_password_change
      FROM users 
      WHERE id = ${req.user.userId}
    `;
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result[0];
    
    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    
    // Update password and clear force_password_change flag
    await db.sql`
      UPDATE users 
      SET password_hash = ${newPasswordHash},
          force_password_change = FALSE,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${req.user.userId}
    `;
    
    res.json({ 
      success: true,
      message: 'Password changed successfully' 
    });
    
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Forgot password - send reset email
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    // Find user by email
    const users = await db.sql`SELECT id, username, email FROM users WHERE email = ${email} AND active = true`;
    
    // Always return success to prevent email enumeration
    if (users.length === 0) {
      return res.json({ success: true, message: 'If an account with that email exists, a reset link has been sent.' });
    }

    const user = users[0];
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.sql`UPDATE users SET password_reset_token = ${token}, password_reset_expires = ${expires} WHERE id = ${user.id}`;

    // Get SMTP settings and send email
    const nodemailer = require('nodemailer');
    const smtpSettings = await db.sql`SELECT key, value FROM settings WHERE key IN ('smtp_host', 'smtp_port', 'smtp_secure', 'smtp_starttls', 'smtp_no_auth', 'smtp_username', 'smtp_password', 'smtp_from_email', 'smtp_from_name', 'app_name')`;
    const smtp = {};
    smtpSettings.forEach(s => { smtp[s.key] = s.value; });

    if (!smtp.smtp_host) {
      console.error('Forgot password: SMTP not configured');
      return res.json({ success: true, message: 'If an account with that email exists, a reset link has been sent.' });
    }

    const transportConfig = {
      host: smtp.smtp_host,
      port: parseInt(smtp.smtp_port) || 587,
      secure: smtp.smtp_secure === 'true'
    };
    if (smtp.smtp_starttls === 'true') transportConfig.requireTLS = true;
    if (smtp.smtp_no_auth !== 'true') {
      transportConfig.auth = { user: smtp.smtp_username, pass: smtp.smtp_password };
    }

    const transporter = nodemailer.createTransport(transportConfig);

    // Build reset URL
    const host = req.headers.host || 'localhost';
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const resetUrl = protocol + '://' + host + '/reset-password?token=' + token;
    const appName = smtp.app_name || 'NetControl';

    await transporter.sendMail({
      from: (smtp.smtp_from_name || appName) + ' <' + (smtp.smtp_from_email || smtp.smtp_username) + '>',
      to: user.email,
      subject: appName + ' - Password Reset',
      html: '<h2>' + appName + ' Password Reset</h2>' +
        '<p>Hello ' + (user.username || '') + ',</p>' +
        '<p>A password reset was requested for your account. Click the link below to reset your password:</p>' +
        '<p><a href="' + resetUrl + '" style="display:inline-block;padding:10px 20px;background:#0d6efd;color:#fff;text-decoration:none;border-radius:4px">Reset Password</a></p>' +
        '<p>This link expires in 1 hour.</p>' +
        '<p>If you did not request this, you can safely ignore this email.</p>'
    });

    res.json({ success: true, message: 'If an account with that email exists, a reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    // Still return success to prevent enumeration
    res.json({ success: true, message: 'If an account with that email exists, a reset link has been sent.' });
  }
});

// Reset password with token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and new password are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const users = await db.sql`SELECT id, username FROM users WHERE password_reset_token = ${token} AND password_reset_expires > NOW() AND active = true`;
    if (users.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const user = users[0];
    const passwordHash = await bcrypt.hash(password, 12);

    await db.sql`UPDATE users SET password_hash = ${passwordHash}, password_reset_token = NULL, password_reset_expires = NULL, force_password_change = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = ${user.id}`;

    res.json({ success: true, message: 'Password has been reset. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
module.exports.authenticateToken = authenticateToken;
module.exports.requireAdmin = requireAdmin;
module.exports.requireWrite = requireWrite;