const express = require('express');
const router = express.Router();
const db = require('../database/postgres-js-db');
const axios = require('axios');
const xml2js = require('xml2js');
const { authenticateToken } = require('./auth-postgres-js');
const { getQRZSession, mapLicenseClass } = require('./qrz-postgres-js');

// QRZ lookup helper for pre-check-in processing
async function lookupQRZ(callSign) {
  try {
    const sessionKey = await getQRZSession();
    const lookupUrl = 'https://xmldata.qrz.com/xml/current/';
    const response = await axios.get(lookupUrl, {
      params: { s: sessionKey, callsign: callSign.toUpperCase() },
      timeout: 10000
    });
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(response.data);
    if (result.QRZDatabase && result.QRZDatabase.Callsign && result.QRZDatabase.Callsign[0]) {
      const d = result.QRZDatabase.Callsign[0];
      const rawClass = d.class ? d.class[0] : '';
      return {
        callsign: d.call ? d.call[0] : callSign,
        name: d.fname && d.name ? `${d.fname[0]} ${d.name[0]}` : (d.name ? d.name[0] : ''),
        address: d.addr1 ? d.addr1[0] : '',
        city: d.addr2 ? d.addr2[0] : '',
        state: d.state ? d.state[0] : '',
        email: d.email ? d.email[0] : '',
        grid: d.grid ? d.grid[0] : '',
        licenseClass: mapLicenseClass(rawClass)
      };
    }
    return null;
  } catch (error) {
    console.log(`QRZ lookup failed for ${callSign}: ${error.message}`);
    return null;
  }
}

// Function to parse HTML response from BRARS pre-check-in page
function parsePreCheckInHTML(html) {
  const participants = [];
  
  try {
    // Look for the ordered list containing participant data
    // Format: <li>CALLSIGN, FirstName, Location, Announce</li>
    const listItemRegex = /<li>([^<]+)<\/li>/g;
    let match;
    
    while ((match = listItemRegex.exec(html)) !== null) {
      const participantText = match[1].trim();
      
      // Parse the comma-separated values
      const parts = participantText.split(',').map(part => part.trim());
      
      if (parts.length >= 3) {
        const callSign = parts[0];
        const firstName = parts[1];
        const location = parts[2];
        const announce = parts[3] === 'Yes' ? 'Will announce' : '';
        
        participants.push({
          callSign: callSign.toUpperCase(),
          firstName,
          location,
          announce
        });
      }
    }
    
    console.log(`Parsed ${participants.length} participants from HTML`);
    return participants;
    
  } catch (error) {
    console.error('Error parsing HTML:', error);
    return [];
  }
}

// Test endpoint with mock data for development/testing
router.get('/test', authenticateToken, async (req, res) => {
  try {
    const mockParticipants = [
      {
        callSign: "W1AW",
        firstName: "John",
        location: "Newington, CT",
        announce: "Testing the pre-check-in system"
      },
      {
        callSign: "K1ABC", 
        firstName: "Jane",
        location: "Hartford, CT",
        announce: "Ready for net"
      },
      {
        callSign: "N1XYZ",
        firstName: "Bob", 
        location: "New Haven, CT",
        announce: ""
      }
    ];

    console.log(`Returning ${mockParticipants.length} mock pre-check-in participants`);
    
    res.json({
      participants: mockParticipants,
      count: mockParticipants.length,
      fetchedAt: new Date().toISOString(),
      source: 'Mock Pre-Net CheckIn (Test Data)',
      sourceUrl: 'internal://test'
    });
    
  } catch (error) {
    console.error('Test pre-check-in error:', error);
    res.status(500).json({ 
      error: 'Test endpoint error',
      details: error.message
    });
  }
});

// Fetch pre-check-in data from BRARS website
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Get the pre-check-in URL from settings
    const urlSetting = await db.sql`
      SELECT value FROM settings WHERE key = 'precheckin_url'
    `;
    
    if (urlSetting.length === 0 || !urlSetting[0].value) {
      return res.status(503).json({ 
        error: 'Pre-check-in URL not configured',
        details: 'Please configure the pre-check-in URL in settings'
      });
    }
    
    const preCheckinUrl = urlSetting[0].value;
    console.log('Fetching pre-check-in data from:', preCheckinUrl);
    
    // Fetch data from the pre-check-in URL
    const response = await axios.get(preCheckinUrl, {
      timeout: 10000, // 10 second timeout
      headers: {
        'User-Agent': 'NetControl/1.1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    
    let participants = [];
    
    // Check if response is HTML (BRARS format) or JSON
    const contentType = response.headers['content-type'] || '';
    
    if (contentType.includes('text/html')) {
      // Parse HTML response from BRARS
      participants = parsePreCheckInHTML(response.data);
    } else {
      // Handle JSON response format (fallback)
      if (response.data && Array.isArray(response.data)) {
        participants = response.data;
      } else if (response.data && response.data.participants && Array.isArray(response.data.participants)) {
        participants = response.data.participants;
      } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
        participants = response.data.data;
      } else {
        console.log('Unexpected JSON response format:', response.data);
        participants = [];
      }
      
      // Normalize JSON participant data format
      participants = participants.map(participant => {
        const callSign = participant.callSign || participant.call_sign || participant.callsign || participant.call;
        const firstName = participant.firstName || participant.first_name || participant.name || participant.firstName;
        const location = participant.location || participant.city || participant.qth;
        const announce = participant.announce || participant.announcement || participant.message || '';
        
        return {
          callSign: callSign ? callSign.toUpperCase() : '',
          firstName: firstName || '',
          location: location || '',
          announce: announce || ''
        };
      }).filter(p => p.callSign); // Only include participants with call signs
    }
    
    console.log(`Fetched ${participants.length} pre-check-in participants`);
    
    res.json({
      participants: participants,
      count: participants.length,
      fetchedAt: new Date().toISOString(),
      source: 'BRARS Pre-Net CheckIn',
      sourceUrl: preCheckinUrl
    });
    
  } catch (error) {
    console.error('Pre-check-in fetch error:', error);
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      res.status(503).json({ 
        error: 'Pre-check-in service unavailable',
        details: 'Could not connect to the pre-check-in service. Please check the URL in settings.',
        sourceUrl: preCheckinUrl
      });
    } else if (error.code === 'ECONNABORTED') {
      res.status(504).json({ 
        error: 'Pre-check-in service timeout',
        details: 'The pre-check-in service took too long to respond',
        sourceUrl: preCheckinUrl
      });
    } else if (error.response && error.response.status === 404) {
      res.status(404).json({ 
        error: 'Pre-check-in endpoint not found',
        details: `The URL ${preCheckinUrl} returned a 404 error. Please verify the correct URL in settings.`,
        sourceUrl: preCheckinUrl
      });
    } else if (error.response) {
      res.status(error.response.status).json({ 
        error: 'Pre-check-in service error',
        details: `HTTP ${error.response.status}: ${error.response.statusText}`,
        sourceUrl: preCheckinUrl
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to fetch pre-check-in data',
        details: error.message,
        sourceUrl: preCheckinUrl
      });
    }
  }
});

// Process pre-check-in participants with QRZ lookup and operator creation
router.post('/process', authenticateToken, async (req, res) => {
  try {
    const { participants, sessionId } = req.body;
    
    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ error: 'No participants provided' });
    }
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    // Check if session exists
    const sessionCheck = await db.sql`
      SELECT id FROM sessions WHERE id = ${sessionId}
    `;
    
    if (sessionCheck.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const results = [];
    const errors = [];
    const skipped = [];
    
    // Use current time as base, increment by 1 second per participant
    // to preserve the original order from the website when sorted by time
    const baseTime = new Date();
    let timeOffset = 0;
    
    for (const participant of participants) {
      try {
        const { callSign, firstName, location, announce } = participant;
        const flagEcholink = participant.flag_echolink || false;
        
        if (!callSign) {
          errors.push({ participant, error: 'Call sign is required' });
          continue;
        }
        
        // Calculate check-in time for this participant (base + offset seconds)
        // Use configured app timezone instead of server UTC
        const checkInDate = new Date(baseTime.getTime() + (timeOffset * 1000));
        let checkInTime;
        try {
          const tzSetting = await db.sql`SELECT value FROM settings WHERE key = 'app_timezone'`;
          const tz = tzSetting.length > 0 && tzSetting[0].value ? tzSetting[0].value : 'America/New_York';
          checkInTime = checkInDate.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        } catch (e) {
          checkInTime = checkInDate.toTimeString().slice(0, 8);
        }
        timeOffset++;
        
        // Check if participant already exists in this session
        const existingParticipant = await db.sql`
          SELECT id FROM session_participants 
          WHERE session_id = ${sessionId} AND call_sign = ${callSign.toUpperCase()}
        `;
        
        if (existingParticipant.length > 0) {
          skipped.push({ callSign: callSign.toUpperCase(), reason: 'Already in session' });
          continue;
        }
        
        // Check if operator exists, create if not
        let operatorId = null;
        let operatorCreated = false;
        let hasQRZData = false;
        let resolvedName = firstName || null;
        let operatorExists = await db.sql`
          SELECT id, name, preferred_name FROM operators WHERE call_sign = ${callSign.toUpperCase()}
        `;
        
        if (operatorExists.length === 0) {
          // Try QRZ lookup first to get full operator details
          const qrzData = await lookupQRZ(callSign);
          
          if (qrzData) {
            hasQRZData = true;
            resolvedName = qrzData.name || firstName || null;
            // Create operator with QRZ data
            const newOperator = await db.sql`
              INSERT INTO operators (call_sign, name, address, city, state, email, license_class, active, notes)
              VALUES (
                ${callSign.toUpperCase()}, 
                ${resolvedName},
                ${qrzData.address || null},
                ${qrzData.city || location || null}, 
                ${qrzData.state || null},
                ${qrzData.email || null},
                ${qrzData.licenseClass || null},
                true,
                ${`Added from pre-check-in with QRZ data on ${new Date().toLocaleDateString()}. Grid: ${qrzData.grid || 'N/A'}. ${announce || ''}`}
              ) RETURNING id
            `;
            operatorId = newOperator[0].id;
            operatorCreated = true;
          } else {
            // Fallback: create operator from pre-check-in data only
            const newOperator = await db.sql`
              INSERT INTO operators (call_sign, name, city, active, notes)
              VALUES (
                ${callSign.toUpperCase()}, 
                ${firstName || null}, 
                ${location || null}, 
                true,
                ${`Added from pre-check-in on ${new Date().toLocaleDateString()}. ${announce || ''}`}
              ) RETURNING id
            `;
            operatorId = newOperator[0].id;
            operatorCreated = true;
          }
        } else {
          operatorId = operatorExists[0].id;
          resolvedName = operatorExists[0].name || firstName || null;

          // If pre-check-in first name differs from operator's first name,
          // set it as preferred name (only if preferred_name isn't already set)
          if (firstName && !operatorExists[0].preferred_name) {
            const opFirstName = (operatorExists[0].name || '').split(' ')[0].toLowerCase();
            const preFirstName = firstName.trim().toLowerCase();
            if (opFirstName && preFirstName && opFirstName !== preFirstName) {
              await db.sql`UPDATE operators SET preferred_name = ${firstName.trim()} WHERE id = ${operatorId}`;
            }
          }
        }
        
        // Add participant to session with operator link
        const participantResult = await db.sql`
          INSERT INTO session_participants (
            session_id, call_sign, name, check_in_time, notes, operator_id, flag_echolink
          ) VALUES (
            ${sessionId}, ${callSign.toUpperCase()}, ${resolvedName},
            ${checkInTime},
            ${flagEcholink ? 'Echolink check-in' : `Pre-check-in: ${announce || 'No announcement'}`}, ${operatorId}, ${flagEcholink}
          ) RETURNING *
        `;
        
        results.push({
          callSign: callSign.toUpperCase(),
          participant,
          added: participantResult[0],
          operatorCreated,
          hasQRZData,
          status: 'success'
        });
        
      } catch (error) {
        console.error(`Error processing participant ${participant.callSign}:`, error);
        errors.push({ 
          callSign: participant.callSign,
          participant, 
          error: error.message || 'Failed to process participant' 
        });
      }
    }
    
    // Update session participant count
    if (results.length > 0) {
      await db.sql`
        UPDATE sessions 
        SET total_checkins = (
          SELECT COUNT(*) FROM session_participants WHERE session_id = ${sessionId}
        ),
        updated_at = CURRENT_TIMESTAMP
        WHERE id = ${sessionId}
      `;
    }
    
    res.json({
      success: true,
      processed: results.length,
      skipped: skipped.length,
      errors: errors.length,
      results,
      skipped,
      errors
    });
    
  } catch (error) {
    console.error('Process pre-check-in error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;