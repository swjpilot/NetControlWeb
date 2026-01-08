const express = require('express');
const router = express.Router();
const db = require('../database/postgres-js-db');
const axios = require('axios');
const xml2js = require('xml2js');
const { authenticateToken } = require('./auth-postgres-js');

// QRZ.com API session management
let qrzSession = null;
let qrzSessionExpiry = null;

// Get QRZ session key
async function getQRZSession() {
  try {
    // Check if we have a valid session
    if (qrzSession && qrzSessionExpiry && Date.now() < qrzSessionExpiry) {
      return qrzSession;
    }
    
    // Get QRZ credentials from settings
    const settings = await db.sql`
      SELECT key, value FROM settings 
      WHERE key IN ('qrz_username', 'qrz_password')
    `;
    
    const settingsMap = {};
    settings.forEach(setting => {
      settingsMap[setting.key] = setting.value;
    });
    
    if (!settingsMap.qrz_username || !settingsMap.qrz_password) {
      throw new Error('QRZ credentials not configured');
    }
    
    // Login to QRZ
    const loginUrl = 'https://xmldata.qrz.com/xml/current/';
    const loginParams = {
      username: settingsMap.qrz_username,
      password: settingsMap.qrz_password,
      agent: 'NetControl-1.1.0'
    };
    
    const response = await axios.get(loginUrl, { 
      params: loginParams,
      timeout: 10000 
    });
    
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(response.data);
    
    if (result.QRZDatabase && result.QRZDatabase.Session && result.QRZDatabase.Session[0].Key) {
      qrzSession = result.QRZDatabase.Session[0].Key[0];
      qrzSessionExpiry = Date.now() + (23 * 60 * 60 * 1000); // 23 hours
      return qrzSession;
    } else {
      throw new Error('Failed to get QRZ session key');
    }
    
  } catch (error) {
    console.error('QRZ session error:', error);
    throw error;
  }
}

// Lookup callsign on QRZ
router.get('/lookup/:callsign', authenticateToken, async (req, res) => {
  try {
    const { callsign } = req.params;
    
    if (!callsign) {
      return res.status(400).json({ error: 'Callsign is required' });
    }
    
    try {
      const sessionKey = await getQRZSession();
      
      const lookupUrl = 'https://xmldata.qrz.com/xml/current/';
      const lookupParams = {
        s: sessionKey,
        callsign: callsign.toUpperCase()
      };
      
      const response = await axios.get(lookupUrl, { 
        params: lookupParams,
        timeout: 10000 
      });
      
      const parser = new xml2js.Parser();
      const result = await parser.parseStringPromise(response.data);
      
      if (result.QRZDatabase && result.QRZDatabase.Callsign && result.QRZDatabase.Callsign[0]) {
        const callsignData = result.QRZDatabase.Callsign[0];
        
        res.json({
          callsign: callsignData.call ? callsignData.call[0] : '',
          name: callsignData.fname && callsignData.name ? 
            `${callsignData.fname[0]} ${callsignData.name[0]}` : 
            (callsignData.name ? callsignData.name[0] : ''),
          address: callsignData.addr1 ? callsignData.addr1[0] : '',
          city: callsignData.addr2 ? callsignData.addr2[0] : '',
          state: callsignData.state ? callsignData.state[0] : '',
          zip: callsignData.zip ? callsignData.zip[0] : '',
          country: callsignData.country ? callsignData.country[0] : '',
          grid: callsignData.grid ? callsignData.grid[0] : '',
          licenseClass: callsignData.class ? callsignData.class[0] : '',
          expires: callsignData.expdate ? callsignData.expdate[0] : '',
          email: callsignData.email ? callsignData.email[0] : '',
          url: callsignData.url ? callsignData.url[0] : '',
          image: callsignData.image ? callsignData.image[0] : '',
          bio: callsignData.bio ? callsignData.bio[0] : ''
        });
      } else if (result.QRZDatabase && result.QRZDatabase.Session && result.QRZDatabase.Session[0].Error) {
        const error = result.QRZDatabase.Session[0].Error[0];
        res.status(404).json({ error: `QRZ Error: ${error}` });
      } else {
        res.status(404).json({ error: 'Callsign not found' });
      }
      
    } catch (apiError) {
      console.error('QRZ API error:', apiError.message);
      
      if (apiError.message.includes('credentials not configured')) {
        res.status(503).json({ 
          error: 'QRZ credentials not configured',
          details: 'Please configure QRZ username and password in settings'
        });
      } else {
        res.status(503).json({ 
          error: 'QRZ service temporarily unavailable',
          details: 'Please try again later'
        });
      }
    }
    
  } catch (error) {
    console.error('QRZ lookup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Import operator from QRZ data
router.post('/import/:callsign', authenticateToken, async (req, res) => {
  try {
    const { callsign } = req.params;
    
    if (!callsign) {
      return res.status(400).json({ error: 'Callsign is required' });
    }
    
    // First check if operator already exists
    const existing = await db.sql`
      SELECT id FROM operators WHERE call_sign = ${callsign.toUpperCase()}
    `;
    
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Operator already exists in database' });
    }
    
    try {
      const sessionKey = await getQRZSession();
      
      const lookupUrl = 'https://xmldata.qrz.com/xml/current/';
      const lookupParams = {
        s: sessionKey,
        callsign: callsign.toUpperCase()
      };
      
      const response = await axios.get(lookupUrl, { 
        params: lookupParams,
        timeout: 10000 
      });
      
      const parser = new xml2js.Parser();
      const result = await parser.parseStringPromise(response.data);
      
      if (result.QRZDatabase && result.QRZDatabase.Callsign && result.QRZDatabase.Callsign[0]) {
        const callsignData = result.QRZDatabase.Callsign[0];
        
        const name = callsignData.fname && callsignData.name ? 
          `${callsignData.fname[0]} ${callsignData.name[0]}` : 
          (callsignData.name ? callsignData.name[0] : null);
        
        // Import into operators table
        const importResult = await db.sql`
          INSERT INTO operators (
            call_sign, name, email, address, city, state, zip, license_class, active
          ) VALUES (
            ${callsignData.call ? callsignData.call[0] : callsign.toUpperCase()},
            ${name},
            ${callsignData.email ? callsignData.email[0] : null},
            ${callsignData.addr1 ? callsignData.addr1[0] : null},
            ${callsignData.addr2 ? callsignData.addr2[0] : null},
            ${callsignData.state ? callsignData.state[0] : null},
            ${callsignData.zip ? callsignData.zip[0] : null},
            ${callsignData.class ? callsignData.class[0] : null},
            true
          ) RETURNING *
        `;
        
        res.status(201).json({
          message: 'Operator imported successfully',
          operator: importResult[0]
        });
      } else {
        res.status(404).json({ error: 'Callsign not found in QRZ database' });
      }
      
    } catch (apiError) {
      console.error('QRZ API error:', apiError.message);
      
      if (apiError.message.includes('credentials not configured')) {
        res.status(503).json({ 
          error: 'QRZ credentials not configured',
          details: 'Please configure QRZ username and password in settings'
        });
      } else {
        res.status(503).json({ 
          error: 'QRZ service temporarily unavailable',
          details: 'Please try again later'
        });
      }
    }
    
  } catch (error) {
    console.error('QRZ import error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;