const express = require('express');
const router = express.Router();
const db = require('../database/postgres-js-db');
const { authenticateToken, requireAdmin } = require('./auth-postgres-js');

// Get all settings
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await db.sql`SELECT key, value FROM settings ORDER BY key`;
    
    const settings = {};
    result.forEach(row => {
      settings[row.key] = row.value;
    });
    
    res.json({ settings });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update settings (admin only)
router.put('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { settings } = req.body;
    
    for (const [key, value] of Object.entries(settings)) {
      await db.sql`
        INSERT INTO settings (key, value, updated_at)
        VALUES (${key}, ${value}, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE SET 
          value = EXCLUDED.value, 
          updated_at = CURRENT_TIMESTAMP
      `;
    }
    
    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test QRZ connection
router.post('/test-qrz', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Test QRZ connection
    const axios = require('axios');
    const xml2js = require('xml2js');
    
    const loginUrl = 'https://xmldata.qrz.com/xml/current/';
    const loginParams = {
      username: username,
      password: password,
      agent: 'NetControl-1.1.0'
    };
    
    const response = await axios.get(loginUrl, { 
      params: loginParams,
      timeout: 10000 
    });
    
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(response.data);
    
    if (result.QRZDatabase && result.QRZDatabase.Session && result.QRZDatabase.Session[0].Key) {
      res.json({ success: true, message: 'QRZ connection successful' });
    } else {
      res.json({ success: false, message: 'Invalid QRZ credentials' });
    }
    
  } catch (error) {
    console.error('QRZ test error:', error);
    res.json({ success: false, message: 'QRZ connection failed: ' + error.message });
  }
});

// Test SMTP connection
router.post('/test-smtp', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { host, port, secure, starttls, noAuth, username, password, fromEmail } = req.body;
    
    if (!host || !port) {
      return res.status(400).json({ error: 'Host and port are required' });
    }
    
    if (!noAuth && (!username || !password)) {
      return res.status(400).json({ error: 'Username and password required when authentication is enabled' });
    }
    
    const nodemailer = require('nodemailer');
    
    const transportConfig = {
      host: host,
      port: parseInt(port),
      secure: secure === true || secure === 'true',
      requireTLS: starttls === true || starttls === 'true'
    };
    
    if (!noAuth) {
      transportConfig.auth = {
        user: username,
        pass: password
      };
    }
    
    const transporter = nodemailer.createTransporter(transportConfig);
    
    // Verify connection
    await transporter.verify();
    
    res.json({ success: true, message: 'SMTP connection successful' });
    
  } catch (error) {
    console.error('SMTP test error:', error);
    res.json({ success: false, message: 'SMTP connection failed: ' + error.message });
  }
});

// Send test email
router.post('/send-test-email', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email address is required' });
    }
    
    // Get SMTP settings
    const settings = await db.sql`
      SELECT key, value FROM settings 
      WHERE key IN ('smtp_host', 'smtp_port', 'smtp_secure', 'smtp_starttls', 'smtp_no_auth', 'smtp_username', 'smtp_password', 'smtp_from_email', 'smtp_from_name')
    `;
    
    const settingsMap = {};
    settings.forEach(setting => {
      settingsMap[setting.key] = setting.value;
    });
    
    if (!settingsMap.smtp_host || !settingsMap.smtp_port) {
      return res.status(400).json({ error: 'SMTP settings not configured' });
    }
    
    const nodemailer = require('nodemailer');
    
    const transportConfig = {
      host: settingsMap.smtp_host,
      port: parseInt(settingsMap.smtp_port),
      secure: settingsMap.smtp_secure === 'true',
      requireTLS: settingsMap.smtp_starttls === 'true'
    };
    
    if (settingsMap.smtp_no_auth !== 'true') {
      transportConfig.auth = {
        user: settingsMap.smtp_username,
        pass: settingsMap.smtp_password
      };
    }
    
    const transporter = nodemailer.createTransporter(transportConfig);
    
    const mailOptions = {
      from: `${settingsMap.smtp_from_name || 'NetControl'} <${settingsMap.smtp_from_email || settingsMap.smtp_username}>`,
      to: email,
      subject: 'NetControl Test Email',
      text: 'This is a test email from NetControl to verify SMTP configuration.',
      html: `
        <h2>NetControl Test Email</h2>
        <p>This is a test email from NetControl to verify SMTP configuration.</p>
        <p>If you received this email, your SMTP settings are working correctly.</p>
        <p>Sent at: ${new Date().toLocaleString()}</p>
      `
    };
    
    await transporter.sendMail(mailOptions);
    
    res.json({ success: true, message: `Test email sent successfully to ${email}` });
    
  } catch (error) {
    console.error('Send test email error:', error);
    res.json({ success: false, message: 'Failed to send test email: ' + error.message });
  }
});

// Reset settings
router.post('/reset', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { category } = req.body;
    
    let keysToReset = [];
    
    switch (category) {
      case 'qrz':
        keysToReset = ['qrz_username', 'qrz_password'];
        break;
      case 'smtp':
        keysToReset = ['smtp_host', 'smtp_port', 'smtp_secure', 'smtp_starttls', 'smtp_no_auth', 'smtp_username', 'smtp_password', 'smtp_from_email', 'smtp_from_name'];
        break;
      case 'app':
        keysToReset = ['app_name', 'app_description', 'default_net_control', 'default_net_frequency', 'default_net_time', 'default_grid_square', 'distance_unit'];
        break;
      case 'ui':
        keysToReset = ['theme', 'items_per_page'];
        break;
      case 'security':
        keysToReset = ['session_timeout', 'require_password_change', 'min_password_length'];
        break;
      case 'all':
        // Reset all settings to default values
        await db.sql`DELETE FROM settings`;
        await db.sql`
          INSERT INTO settings (key, value, description) VALUES
          ('app_name', 'NetControl', 'Application name'),
          ('app_description', 'Ham Radio Net Management', 'Application description'),
          ('default_net_control', '', 'Default net control callsign'),
          ('default_net_frequency', '', 'Default net frequency'),
          ('default_net_time', '', 'Default net start time'),
          ('default_grid_square', '', 'Default grid square'),
          ('distance_unit', 'miles', 'Distance unit'),
          ('smtp_host', '', 'SMTP server hostname'),
          ('smtp_port', '587', 'SMTP server port'),
          ('smtp_secure', 'false', 'Use SSL/TLS'),
          ('smtp_starttls', 'true', 'Use STARTTLS'),
          ('smtp_no_auth', 'false', 'SMTP requires no authentication'),
          ('smtp_username', '', 'SMTP username'),
          ('smtp_password', '', 'SMTP password'),
          ('smtp_from_email', 'netcontrol@example.com', 'From email address'),
          ('smtp_from_name', 'NetControl System', 'From name'),
          ('qrz_username', '', 'QRZ.com username'),
          ('qrz_password', '', 'QRZ.com password'),
          ('theme', 'light', 'UI theme'),
          ('items_per_page', '25', 'Items per page in tables'),
          ('session_timeout', '24', 'Session timeout in hours'),
          ('require_password_change', 'false', 'Require password change on first login'),
          ('min_password_length', '6', 'Minimum password length')
        `;
        return res.json({ success: true, message: 'All settings reset to defaults' });
      default:
        return res.status(400).json({ error: 'Invalid category' });
    }
    
    if (keysToReset.length > 0) {
      for (const key of keysToReset) {
        await db.sql`DELETE FROM settings WHERE key = ${key}`;
      }
    }
    
    res.json({ success: true, message: `${category.toUpperCase()} settings reset successfully` });
    
  } catch (error) {
    console.error('Reset settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;