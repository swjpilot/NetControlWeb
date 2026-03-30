const express = require('express');
const router = express.Router();
const db = require('../database/postgres-js-db');
const axios = require('axios');
const { authenticateToken } = require('./auth-postgres-js');

// Parse echolink logins table from the net report HTML page
function parseEcholinkTable(html) {
  const logins = [];

  try {
    // Find the echolink table rows (skip header row)
    // Table structure: <tr><td>Connected Since</td><td>Callsign</td><td>Name</td><td>IP Address</td></tr>
    const rowRegex = /<tr[^>]*>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<\/tr>/gi;
    let match;

    while ((match = rowRegex.exec(html)) !== null) {
      const connectedSince = match[1].trim();
      const callSign = match[2].trim();
      const name = match[3].trim();
      const ipAddress = match[4].trim();

      // Skip the header row
      if (callSign.toLowerCase() === 'callsign' || callSign.toLowerCase() === 'call sign') continue;
      // Skip empty rows
      if (!callSign) continue;

      logins.push({
        callSign: callSign.toUpperCase(),
        name,
        connectedSince,
        ipAddress
      });
    }

    console.log(`Parsed ${logins.length} echolink logins from HTML`);
    return logins;
  } catch (error) {
    console.error('Error parsing echolink table:', error);
    return [];
  }
}

// Fetch echolink logins from the net report page
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Get the net report URL from settings
    const urlSetting = await db.sql`
      SELECT value FROM settings WHERE key = 'netreport_url'
    `;

    if (urlSetting.length === 0 || !urlSetting[0].value) {
      return res.status(503).json({
        error: 'Net report URL not configured',
        details: 'Please configure the net report URL in Settings → External Services'
      });
    }

    const netReportUrl = urlSetting[0].value;
    console.log('Fetching echolink logins from:', netReportUrl);

    const response = await axios.get(netReportUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'NetControl/1.3.0',
        'Accept': 'text/html,application/xhtml+xml,*/*'
      }
    });

    const logins = parseEcholinkTable(response.data);

    res.json({
      logins,
      count: logins.length,
      fetchedAt: new Date().toISOString(),
      sourceUrl: netReportUrl
    });
  } catch (error) {
    console.error('Echolink fetch error:', error);

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      res.status(503).json({ error: 'Net report page unavailable', details: 'Could not connect. Check the URL in settings.' });
    } else if (error.code === 'ECONNABORTED') {
      res.status(504).json({ error: 'Net report page timeout', details: 'The page took too long to respond.' });
    } else if (error.response) {
      res.status(error.response.status).json({ error: 'Net report page error', details: `HTTP ${error.response.status}: ${error.response.statusText}` });
    } else {
      res.status(500).json({ error: 'Failed to fetch echolink logins', details: error.message });
    }
  }
});

module.exports = router;
