const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../database/db');
const { authenticateToken } = require('./auth');

const QRZ_BASE_URL = 'https://xmldata.qrz.com/xml/current/';

// Get QRZ session key
async function getQRZSession() {
  try {
    // Get QRZ credentials from settings
    const username = await db.get('SELECT value FROM settings WHERE key = ?', ['qrz_username']);
    const password = await db.get('SELECT value FROM settings WHERE key = ?', ['qrz_password']);
    
    if (!username?.value || !password?.value) {
      throw new Error('QRZ credentials not configured. Please set them in Settings.');
    }
    
    // Request session key
    const response = await axios.get(`${QRZ_BASE_URL}?username=${username.value}&password=${password.value}`);
    const xml = response.data;
    
    // Parse session key from XML
    const keyMatch = xml.match(/<Key>([^<]+)<\/Key>/);
    const errorMatch = xml.match(/<Error>([^<]+)<\/Error>/);
    
    if (errorMatch) {
      throw new Error(`QRZ Error: ${errorMatch[1]}`);
    }
    
    if (!keyMatch) {
      throw new Error('Unable to get QRZ session key');
    }
    
    return keyMatch[1];
  } catch (error) {
    console.error('QRZ session error:', error.message);
    throw error;
  }
}

// Parse QRZ XML response
function parseQRZResponse(xml) {
  const data = {};
  
  // Helper function to extract value from XML tag
  const extractValue = (tag) => {
    const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
    return match ? match[1] : null;
  };
  
  // Extract all relevant fields
  data.callSign = extractValue('call');
  data.name = [
    extractValue('fname'),
    extractValue('mi'),
    extractValue('name')
  ].filter(Boolean).join(' ') || null;
  
  data.address = extractValue('addr1');
  data.city = extractValue('addr2');
  data.state = extractValue('state');
  data.zip = extractValue('zip');
  data.country = extractValue('country');
  data.county = extractValue('county');
  
  data.email = extractValue('email');
  data.phone = extractValue('phone');
  data.phoneCell = extractValue('cell');
  data.website = extractValue('url');
  
  data.licenseClass = extractValue('class');
  data.expirationDate = extractValue('expdate');
  data.grid = extractValue('grid');
  
  // Additional fields
  data.born = extractValue('born');
  data.qslMgr = extractValue('qslmgr');
  data.lotw = extractValue('lotw');
  data.eqsl = extractValue('eqsl');
  
  return data;
}

// Lookup callsign (with authentication)
router.get('/lookup/:callsign', authenticateToken, async (req, res) => {
  try {
    const callSign = req.params.callsign.toUpperCase().trim();
    
    if (!callSign) {
      return res.status(400).json({ error: 'Callsign is required' });
    }
    
    // Validate callsign format
    if (!/^[A-Z0-9\/]+$/.test(callSign)) {
      return res.status(400).json({ error: 'Invalid callsign format' });
    }
    
    // Check cache first (cache for 24 hours)
    const cached = await db.get(`
      SELECT * FROM qrz_cache 
      WHERE call_sign = ? AND cached_at > datetime('now', '-24 hours')
    `, [callSign]);
    
    if (cached) {
      console.log(`QRZ cache hit for ${callSign}`);
      
      // Convert database row to response format
      const result = {
        callSign: cached.call_sign,
        name: [cached.name_first, cached.name_mi, cached.name_last].filter(Boolean).join(' ') || null,
        address: cached.address_line1,
        city: cached.city,
        state: cached.state,
        zip: cached.zip,
        country: cached.country,
        county: cached.county,
        email: cached.email_address,
        phone: cached.phone_home,
        phoneCell: cached.phone_cell,
        licenseClass: cached.license_class,
        expirationDate: cached.expiration_date,
        grid: cached.grid,
        distance: cached.distance,
        cached: true
      };
      
      return res.json(result);
    }
    
    // Get QRZ session
    const sessionKey = await getQRZSession();
    
    // Lookup callsign
    const response = await axios.get(`${QRZ_BASE_URL}?s=${sessionKey}&callsign=${callSign}`);
    const xml = response.data;
    
    // Check for errors
    const errorMatch = xml.match(/<Error>([^<]+)<\/Error>/);
    if (errorMatch) {
      return res.status(404).json({ error: `QRZ Error: ${errorMatch[1]}` });
    }
    
    // Parse response
    const data = parseQRZResponse(xml);
    
    if (!data.callSign) {
      return res.status(404).json({ error: 'Callsign not found' });
    }
    
    // Cache the result
    try {
      await db.run(`
        INSERT OR REPLACE INTO qrz_cache (
          call_sign, name_first, name_mi, name_last, name_nick,
          address_line1, address_line2, city, state, zip,
          phone_cell, phone_home, email_address,
          license_class, expiration_date, country, county, grid, distance,
          cached_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        data.callSign,
        data.name ? data.name.split(' ')[0] : null, // First name
        data.name ? data.name.split(' ')[1] : null, // Middle initial
        data.name ? data.name.split(' ').slice(2).join(' ') : null, // Last name
        null, // Nick name
        data.address,
        null, // Address line 2
        data.city,
        data.state,
        data.zip,
        data.phoneCell,
        data.phone,
        data.email,
        data.licenseClass,
        data.expirationDate,
        data.country,
        data.county,
        data.grid,
        null // Distance
      ]);
      
      console.log(`Cached QRZ data for ${callSign}`);
    } catch (cacheError) {
      console.error('Error caching QRZ data:', cacheError);
      // Don't fail the request if caching fails
    }
    
    // Return the result
    res.json({
      ...data,
      cached: false
    });
    
  } catch (error) {
    console.error('QRZ lookup error:', error);
    
    if (error.message.includes('credentials not configured')) {
      return res.status(400).json({ error: error.message });
    }
    
    if (error.message.includes('QRZ Error')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'QRZ lookup failed' });
  }
});

// Get lookup history (with authentication)
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    
    const history = await db.all(`
      SELECT call_sign, name_first, name_mi, name_last, cached_at
      FROM qrz_cache 
      ORDER BY cached_at DESC 
      LIMIT ?
    `, [limit]);
    
    const formattedHistory = history.map(item => ({
      callSign: item.call_sign,
      name: [item.name_first, item.name_mi, item.name_last].filter(Boolean).join(' ') || null,
      lookedUpAt: item.cached_at
    }));
    
    res.json({ history: formattedHistory });
  } catch (error) {
    console.error('Error fetching QRZ history:', error);
    res.status(500).json({ error: 'Failed to fetch lookup history' });
  }
});

// Clear cache (admin only)
router.delete('/cache', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const result = await db.run('DELETE FROM qrz_cache');
    
    res.json({ 
      message: 'QRZ cache cleared successfully',
      deletedCount: result.changes
    });
  } catch (error) {
    console.error('Error clearing QRZ cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

module.exports = router;