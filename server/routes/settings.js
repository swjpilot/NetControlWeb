const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticateToken, requireAdmin } = require('./auth');
const EmailService = require('../utils/emailService');

// Get all application settings (admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const settings = await db.all('SELECT key, value FROM settings ORDER BY key');
    
    // Convert to object format and exclude sensitive data from response
    const settingsObj = {};
    settings.forEach(setting => {
      // Don't send passwords in plain text
      if (setting.key === 'qrz_password') {
        settingsObj[setting.key] = setting.value ? '••••••••' : '';
      } else {
        settingsObj[setting.key] = setting.value;
      }
    });
    
    res.json({ settings: settingsObj });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update application settings (admin only)
router.put('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { settings } = req.body;
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings object is required' });
    }
    
    // Define allowed settings with validation
    const allowedSettings = {
      // QRZ Settings
      qrz_username: { type: 'string', maxLength: 100 },
      qrz_password: { type: 'string', maxLength: 100 },
      
      // Application Settings
      app_name: { type: 'string', maxLength: 100, default: 'NetControl' },
      app_description: { type: 'string', maxLength: 200, default: 'Ham Radio Net Management' },
      
      // Net Settings
      default_net_control: { type: 'string', maxLength: 20 },
      default_net_frequency: { type: 'string', maxLength: 20 },
      default_net_time: { type: 'string', maxLength: 10 },
      
      // Email Settings
      smtp_host: { type: 'string', maxLength: 100 },
      smtp_port: { type: 'number', min: 1, max: 65535 },
      smtp_secure: { type: 'boolean' },
      smtp_no_auth: { type: 'boolean' },
      smtp_username: { type: 'string', maxLength: 100 },
      smtp_password: { type: 'string', maxLength: 100 },
      smtp_from_email: { type: 'string', maxLength: 100 },
      smtp_from_name: { type: 'string', maxLength: 100 },
      
      // Grid Settings
      default_grid_square: { type: 'string', maxLength: 10 },
      distance_unit: { type: 'string', enum: ['miles', 'kilometers'], default: 'miles' },
      
      // Database Settings
      auto_backup_enabled: { type: 'boolean', default: false },
      auto_backup_interval: { type: 'number', min: 1, max: 168, default: 24 }, // hours
      
      // UI Settings
      theme: { type: 'string', enum: ['light', 'dark', 'auto'], default: 'light' },
      items_per_page: { type: 'number', min: 10, max: 500, default: 50 },
      
      // Security Settings
      session_timeout: { type: 'number', min: 1, max: 168, default: 24 }, // hours
      require_password_change: { type: 'boolean', default: false },
      min_password_length: { type: 'number', min: 6, max: 50, default: 6 }
    };
    
    const updatedSettings = {};
    
    // Validate and process each setting
    for (const [key, value] of Object.entries(settings)) {
      if (!allowedSettings[key]) {
        continue; // Skip unknown settings
      }
      
      const config = allowedSettings[key];
      let processedValue = value;
      
      // Type validation
      if (config.type === 'string') {
        if (typeof value !== 'string') {
          return res.status(400).json({ error: `${key} must be a string` });
        }
        if (config.maxLength && value.length > config.maxLength) {
          return res.status(400).json({ error: `${key} must be ${config.maxLength} characters or less` });
        }
      } else if (config.type === 'number') {
        processedValue = parseInt(value);
        if (isNaN(processedValue)) {
          return res.status(400).json({ error: `${key} must be a number` });
        }
        if (config.min && processedValue < config.min) {
          return res.status(400).json({ error: `${key} must be at least ${config.min}` });
        }
        if (config.max && processedValue > config.max) {
          return res.status(400).json({ error: `${key} must be at most ${config.max}` });
        }
      } else if (config.type === 'boolean') {
        processedValue = Boolean(value);
      }
      
      // Enum validation
      if (config.enum && !config.enum.includes(processedValue)) {
        return res.status(400).json({ error: `${key} must be one of: ${config.enum.join(', ')}` });
      }
      
      // Don't update password if it's the masked value
      if (key === 'qrz_password' && value === '••••••••') {
        continue;
      }
      
      updatedSettings[key] = processedValue;
    }
    
    // Update settings in database
    for (const [key, value] of Object.entries(updatedSettings)) {
      await db.run(`
        INSERT OR REPLACE INTO settings (key, value, updated_at) 
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `, [key, value.toString()]);
    }
    
    // Log the settings change
    console.log(`Settings updated by user ${req.user.username}:`, Object.keys(updatedSettings));
    
    res.json({ 
      message: 'Settings updated successfully',
      updated: Object.keys(updatedSettings)
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Get specific setting value (for internal use)
router.get('/:key', authenticateToken, async (req, res) => {
  try {
    const { key } = req.params;
    
    const setting = await db.get('SELECT value FROM settings WHERE key = ?', [key]);
    
    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    
    // Don't return sensitive settings to non-admin users
    if (!req.user.role === 'admin' && ['qrz_password', 'smtp_password'].includes(key)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json({ key, value: setting.value });
  } catch (error) {
    console.error('Error fetching setting:', error);
    res.status(500).json({ error: 'Failed to fetch setting' });
  }
});

// Test QRZ connection (admin only)
router.post('/test-qrz', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'QRZ username and password are required' });
    }
    
    // Test QRZ connection
    const axios = require('axios');
    const QRZ_BASE_URL = 'https://xmldata.qrz.com/xml/current/';
    
    try {
      const response = await axios.get(`${QRZ_BASE_URL}?username=${username}&password=${password}`);
      const xml = response.data;
      
      // Parse XML to check for session key or error
      const keyMatch = xml.match(/<Key>([^<]+)<\/Key>/);
      const errorMatch = xml.match(/<Error>([^<]+)<\/Error>/);
      
      if (keyMatch) {
        res.json({ 
          success: true, 
          message: 'QRZ connection successful',
          sessionKey: keyMatch[1].substring(0, 8) + '...' // Show partial key for confirmation
        });
      } else if (errorMatch) {
        res.json({ 
          success: false, 
          message: `QRZ Error: ${errorMatch[1]}` 
        });
      } else {
        res.json({ 
          success: false, 
          message: 'Unable to parse QRZ response' 
        });
      }
    } catch (qrzError) {
      res.json({ 
        success: false, 
        message: `QRZ connection failed: ${qrzError.message}` 
      });
    }
  } catch (error) {
    console.error('Error testing QRZ connection:', error);
    res.status(500).json({ error: 'Failed to test QRZ connection' });
  }
});

// Test SMTP connection (admin only)
router.post('/test-smtp', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { host, port, secure, noAuth, username, password, fromEmail } = req.body;
    
    if (!host || !port) {
      return res.status(400).json({ error: 'SMTP host and port are required' });
    }
    
    // If authentication is required, validate username and password
    if (!noAuth && (!username || !password)) {
      return res.status(400).json({ error: 'Username and password are required when authentication is enabled' });
    }
    
    const nodemailer = require('nodemailer');
    
    try {
      // Create transporter configuration
      const transporterConfig = {
        host,
        port: parseInt(port),
        secure: Boolean(secure)
      };
      
      // Only add auth if authentication is required
      if (!noAuth && username && password) {
        transporterConfig.auth = {
          user: username,
          pass: password
        };
      }
      
      // Create transporter
      const transporter = nodemailer.createTransport(transporterConfig);
      
      // Verify connection
      await transporter.verify();
      
      res.json({ 
        success: true, 
        message: 'SMTP connection successful' 
      });
    } catch (smtpError) {
      res.json({ 
        success: false, 
        message: `SMTP connection failed: ${smtpError.message}` 
      });
    }
  } catch (error) {
    console.error('Error testing SMTP connection:', error);
    res.status(500).json({ error: 'Failed to test SMTP connection' });
  }
});

// Send test email (admin only)
router.post('/send-test-email', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email address is required' });
    }
    
    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    const emailService = new EmailService();
    
    try {
      await emailService.sendTestEmail(email);
      
      res.json({ 
        success: true, 
        message: `Test email sent successfully to ${email}` 
      });
    } catch (emailError) {
      res.json({ 
        success: false, 
        message: `Failed to send test email: ${emailError.message}` 
      });
    }
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

// Reset settings to defaults (admin only)
router.post('/reset', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { category } = req.body;
    
    let keysToDelete = [];
    
    if (category === 'qrz') {
      keysToDelete = ['qrz_username', 'qrz_password'];
    } else if (category === 'smtp') {
      keysToDelete = ['smtp_host', 'smtp_port', 'smtp_secure', 'smtp_no_auth', 'smtp_username', 'smtp_password', 'smtp_from_email', 'smtp_from_name'];
    } else if (category === 'all') {
      // Reset all non-system settings
      keysToDelete = [
        'qrz_username', 'qrz_password', 'app_name', 'app_description',
        'default_net_control', 'default_net_frequency', 'default_net_time',
        'smtp_host', 'smtp_port', 'smtp_secure', 'smtp_no_auth', 'smtp_username', 'smtp_password', 'smtp_from_email', 'smtp_from_name',
        'default_grid_square', 'distance_unit', 'auto_backup_enabled', 'auto_backup_interval',
        'theme', 'items_per_page', 'session_timeout', 'require_password_change', 'min_password_length'
      ];
    } else {
      return res.status(400).json({ error: 'Invalid category' });
    }
    
    // Delete specified settings
    for (const key of keysToDelete) {
      await db.run('DELETE FROM settings WHERE key = ?', [key]);
    }
    
    console.log(`Settings reset by user ${req.user.username}:`, keysToDelete);
    
    res.json({ 
      message: `${category} settings reset to defaults`,
      reset: keysToDelete
    });
  } catch (error) {
    console.error('Error resetting settings:', error);
    res.status(500).json({ error: 'Failed to reset settings' });
  }
});

module.exports = router;