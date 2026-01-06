const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../database/db');
const { authenticateToken } = require('./auth');

// Fetch pre-check-in data from BRARS website
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('Fetching pre-check-in data from BRARS...');
    
    const response = await axios.get('https://brars.hamsunite.org/cgi-bin/preCheckIn', {
      timeout: 10000,
      headers: {
        'User-Agent': 'NetControl-Web-App/1.0'
      }
    });
    
    const htmlContent = response.data;
    console.log('Raw HTML content:', htmlContent);
    
    // Parse the HTML content to extract participant data
    const participants = parsePreCheckInData(htmlContent);
    
    console.log('Parsed participants:', participants);
    
    res.json({
      participants,
      fetchedAt: new Date().toISOString(),
      source: 'BRARS Pre-Net CheckIn'
    });
  } catch (error) {
    console.error('Error fetching pre-check-in data:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch pre-check-in data',
      details: error.message 
    });
  }
});

function parsePreCheckInData(htmlContent) {
  const participants = [];
  
  try {
    // Look for lines that contain call signs and participant info
    // Based on the format: "N2SWJ, Scott, Greer, Yes"
    const lines = htmlContent.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines and lines that don't contain participant data
      if (!trimmedLine || trimmedLine.length < 10) continue;
      
      // Look for lines with the pattern: CALLSIGN, Name, Location, Announce
      const participantMatch = trimmedLine.match(/([A-Z0-9]+),\s*([^,]+),\s*([^,]+),\s*(Yes|No)/i);
      
      if (participantMatch) {
        const [, callSign, firstName, location, announce] = participantMatch;
        
        participants.push({
          callSign: callSign.trim().toUpperCase(),
          firstName: firstName.trim(),
          location: location.trim(),
          announce: announce.trim().toLowerCase() === 'yes',
          source: 'BRARS Pre-CheckIn'
        });
      }
    }
    
    // If no participants found with regex, try a simpler approach
    if (participants.length === 0) {
      console.log('No participants found with regex, trying simpler parsing...');
      
      // Look for any line that starts with a call sign pattern
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Simple pattern: starts with letters/numbers (call sign)
        if (/^[A-Z0-9]{3,}/.test(trimmedLine) && trimmedLine.includes(',')) {
          const parts = trimmedLine.split(',').map(p => p.trim());
          
          if (parts.length >= 3) {
            participants.push({
              callSign: parts[0].toUpperCase(),
              firstName: parts[1] || '',
              location: parts[2] || '',
              announce: parts[3] ? parts[3].toLowerCase() === 'yes' : false,
              source: 'BRARS Pre-CheckIn'
            });
          }
        }
      }
    }
    
  } catch (error) {
    console.error('Error parsing pre-check-in data:', error);
  }
  
  return participants;
}

// Process pre-check-in participants with QRZ lookup and operator creation
router.post('/process', authenticateToken, async (req, res) => {
  try {
    const { participants, sessionId } = req.body;
    
    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ error: 'No participants provided' });
    }
    
    const results = [];
    const errors = [];
    
    for (const participant of participants) {
      try {
        const result = await processParticipant(participant, sessionId, req.user.id, req.headers.authorization);
        results.push(result);
      } catch (error) {
        console.error(`Error processing participant ${participant.callSign}:`, error);
        errors.push({
          callSign: participant.callSign,
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      processed: results.length,
      errors: errors.length,
      results,
      errors
    });
  } catch (error) {
    console.error('Error processing pre-check-in participants:', error);
    res.status(500).json({ error: 'Failed to process participants' });
  }
});

async function processParticipant(participant, sessionId, userId, authHeader) {
  const { callSign, firstName, location } = participant;
  
  console.log(`Processing participant: ${callSign} (${firstName}, ${location})`);
  
  // Check if operator already exists in database
  let operator = await db.get(
    'SELECT * FROM operators WHERE UPPER(call_sign) = UPPER(?)', 
    [callSign]
  );
  
  let operatorCreated = false;
  let hasQRZData = false;
  
  if (!operator) {
    console.log(`Operator ${callSign} not found in database, performing QRZ lookup...`);
    
    // Perform QRZ lookup
    try {
      const qrzData = await performQRZLookup(callSign, authHeader);
      
      if (qrzData && qrzData.callSign) {
        console.log(`QRZ data found for ${callSign}:`, qrzData);
        // Create operator from QRZ data
        operator = await createOperatorFromQRZ(qrzData, firstName, location);
        operatorCreated = true;
        hasQRZData = true;
        console.log(`Created operator ${callSign} from QRZ data with ID ${operator.id}`);
      } else {
        console.log(`No QRZ data found for ${callSign}, creating basic operator record`);
        // Create basic operator record with pre-check-in data
        const result = await db.run(`
          INSERT INTO operators (
            call_sign, name, location, comment, created_at, updated_at
          ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
          callSign.toUpperCase(),
          firstName || '',
          location || '',
          `Added from BRARS pre-check-in on ${new Date().toLocaleDateString()}`
        ]);
        
        operator = await db.get('SELECT * FROM operators WHERE id = ?', [result.id]);
        operatorCreated = true;
        console.log(`Created basic operator ${callSign} with ID ${operator.id}`);
      }
    } catch (qrzError) {
      console.error(`QRZ lookup failed for ${callSign}:`, qrzError.message);
      
      // Create basic operator record as fallback
      try {
        const result = await db.run(`
          INSERT INTO operators (
            call_sign, name, location, comment, created_at, updated_at
          ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
          callSign.toUpperCase(),
          firstName || '',
          location || '',
          `Added from BRARS pre-check-in on ${new Date().toLocaleDateString()} (QRZ lookup failed)`
        ]);
        
        operator = await db.get('SELECT * FROM operators WHERE id = ?', [result.id]);
        operatorCreated = true;
        console.log(`Created fallback operator ${callSign} with ID ${operator.id}`);
      } catch (createError) {
        console.error(`Failed to create fallback operator for ${callSign}:`, createError.message);
        // Continue without operator record
      }
    }
  } else {
    console.log(`Operator ${callSign} found in database with ID ${operator.id}`);
  }
  
  // Add participant to session
  const participantData = {
    session_id: sessionId,
    operator_id: operator ? operator.id : null,
    call_sign: callSign.toUpperCase(),
    check_in_time: new Date().toTimeString().slice(0, 5),
    notes: `Pre-checked-in from BRARS (${firstName}, ${location})${operatorCreated ? (hasQRZData ? ' - Operator created from QRZ' : ' - Basic operator created') : ''}`
  };
  
  console.log('Adding participant with data:', participantData);
  
  // Check if participant already exists in this session
  const existingParticipant = await db.get(`
    SELECT id FROM session_participants 
    WHERE session_id = ? AND (
      (operator_id IS NOT NULL AND operator_id = ?) OR 
      (UPPER(call_sign) = UPPER(?))
    )
  `, [sessionId, operator?.id, callSign]);
  
  if (existingParticipant) {
    throw new Error(`${callSign} is already checked into this session`);
  }
  
  // Add participant
  const result = await db.run(`
    INSERT INTO session_participants (
      session_id, operator_id, call_sign, check_in_time, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `, [
    participantData.session_id,
    participantData.operator_id,
    participantData.call_sign,
    participantData.check_in_time,
    participantData.notes
  ]);
  
  console.log(`Successfully added participant ${callSign} with ID ${result.id}`);
  
  return {
    callSign,
    participantId: result.id,
    operatorId: operator?.id,
    operatorCreated,
    hasQRZData
  };
}

async function performQRZLookup(callSign, authHeader) {
  try {
    // Import the QRZ lookup logic directly instead of making HTTP calls
    const qrzRoute = require('./qrz');
    
    // Create a mock request/response to use the existing QRZ lookup logic
    const mockReq = {
      params: { callsign: callSign },
      user: { id: 1 } // Mock user for authentication
    };
    
    const mockRes = {
      json: (data) => data,
      status: (code) => ({ json: (data) => ({ status: code, data }) })
    };
    
    // Use the QRZ lookup logic directly
    const qrzData = await lookupQRZDirect(callSign);
    
    if (qrzData && qrzData.callSign) {
      return {
        callSign: qrzData.callSign,
        name: qrzData.name || '',
        address: qrzData.address || '',
        city: qrzData.city || '',
        state: qrzData.state || '',
        email: qrzData.email || '',
        licenseClass: mapLicenseClass(qrzData.licenseClass) || '',
        grid: qrzData.grid || ''
      };
    }
    
    return null;
  } catch (error) {
    console.error('QRZ lookup error:', error.message);
    return null;
  }
}

// Direct QRZ lookup function that replicates the logic from qrz.js
async function lookupQRZDirect(callSign) {
  try {
    const axios = require('axios');
    const QRZ_BASE_URL = 'https://xmldata.qrz.com/xml/current/';
    
    // Get QRZ credentials from settings
    const username = await db.get('SELECT value FROM settings WHERE key = ?', ['qrz_username']);
    const password = await db.get('SELECT value FROM settings WHERE key = ?', ['qrz_password']);
    
    if (!username?.value || !password?.value) {
      console.log('QRZ credentials not configured');
      return null;
    }
    
    // Check cache first (cache for 24 hours)
    const cached = await db.get(`
      SELECT * FROM qrz_cache 
      WHERE call_sign = ? AND cached_at > datetime('now', '-24 hours')
    `, [callSign]);
    
    if (cached) {
      console.log(`QRZ cache hit for ${callSign}`);
      
      return {
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
        grid: cached.grid
      };
    }
    
    // Get QRZ session
    const sessionResponse = await axios.get(`${QRZ_BASE_URL}?username=${username.value}&password=${password.value}`);
    const sessionXml = sessionResponse.data;
    
    const keyMatch = sessionXml.match(/<Key>([^<]+)<\/Key>/);
    const errorMatch = sessionXml.match(/<Error>([^<]+)<\/Error>/);
    
    if (errorMatch) {
      console.error(`QRZ Error: ${errorMatch[1]}`);
      return null;
    }
    
    if (!keyMatch) {
      console.error('Unable to get QRZ session key');
      return null;
    }
    
    const sessionKey = keyMatch[1];
    
    // Lookup callsign
    const response = await axios.get(`${QRZ_BASE_URL}?s=${sessionKey}&callsign=${callSign}`);
    const xml = response.data;
    
    // Check for errors
    const lookupErrorMatch = xml.match(/<Error>([^<]+)<\/Error>/);
    if (lookupErrorMatch) {
      console.error(`QRZ Lookup Error: ${lookupErrorMatch[1]}`);
      return null;
    }
    
    // Parse response
    const data = parseQRZResponse(xml);
    
    if (!data.callSign) {
      console.log(`No QRZ data found for ${callSign}`);
      return null;
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
    }
    
    return data;
  } catch (error) {
    console.error('Direct QRZ lookup error:', error.message);
    return null;
  }
}

// Parse QRZ XML response (copied from qrz.js)
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

function mapLicenseClass(qrzClass) {
  if (!qrzClass) return '';
  
  const classMap = {
    'E': 'Amateur Extra',
    'A': 'Advanced', 
    'G': 'General',
    'T': 'Technician',
    'N': 'Novice',
    'P': 'Technician Plus'
  };
  
  return classMap[qrzClass.toUpperCase()] || qrzClass;
}

async function createOperatorFromQRZ(qrzData, preCheckInName, preCheckInLocation) {
  try {
    // Combine QRZ location data with pre-check-in location
    let location = preCheckInLocation || '';
    if (qrzData.city && qrzData.state) {
      location = `${qrzData.city}, ${qrzData.state}`;
    } else if (qrzData.state && !location) {
      location = qrzData.state;
    }
    
    const operatorData = {
      call_sign: qrzData.callSign,
      name: qrzData.name || preCheckInName || '',
      street: qrzData.address || '',
      location: location,
      email: qrzData.email || '',
      class: qrzData.licenseClass || '',
      grid: qrzData.grid || '',
      comment: `Added from BRARS pre-check-in with QRZ lookup on ${new Date().toLocaleDateString()}`
    };
    
    console.log('Creating operator with data:', operatorData);
    
    const result = await db.run(`
      INSERT INTO operators (
        call_sign, name, street, location, email, class, grid, comment,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      operatorData.call_sign,
      operatorData.name,
      operatorData.street,
      operatorData.location,
      operatorData.email,
      operatorData.class,
      operatorData.grid,
      operatorData.comment
    ]);
    
    console.log(`Successfully created operator ${operatorData.call_sign} with ID ${result.id}`);
    
    // Return the complete operator record
    const createdOperator = await db.get('SELECT * FROM operators WHERE id = ?', [result.id]);
    console.log('Created operator record:', createdOperator);
    
    return createdOperator;
  } catch (error) {
    console.error('Error creating operator from QRZ data:', error);
    throw error;
  }
}

module.exports = router;