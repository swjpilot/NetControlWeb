const express = require('express');
const router = express.Router();
const db = require('../database/postgres-js-db');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper');
const csv = require('csv-parser');
const { authenticateToken } = require('./auth-postgres-js');

// Global download state
let downloadState = {
  status: 'idle',
  progress: 0,
  message: '',
  totalRecords: 0,
  processedRecords: 0,
  startTime: null,
  endTime: null
};

// Get FCC database statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    // Get actual database statistics
    const amateurCount = await db.sql`
      SELECT COUNT(*) as count FROM fcc_amateur_records
    `;
    
    const entityCount = await db.sql`
      SELECT COUNT(*) as count FROM fcc_entity_records
    `;
    
    const lastUpdate = await db.sql`
      SELECT value FROM settings WHERE key = 'fcc_last_updated'
    `;
    
    res.json({
      amateur_records: parseInt(amateurCount[0]?.count) || 0,
      entity_records: parseInt(entityCount[0]?.count) || 0,
      totalRecords: (parseInt(amateurCount[0]?.count) || 0) + (parseInt(entityCount[0]?.count) || 0),
      last_updated: lastUpdate[0]?.value || null,
      downloadStatus: downloadState.status,
      databaseSize: 0, // Could calculate actual size if needed
      availableDataTypes: ['EN', 'AM', 'ALL']
    });
  } catch (error) {
    console.error('FCC stats error:', error);
    // Return default stats if tables don't exist yet
    res.json({
      amateur_records: 0,
      entity_records: 0,
      totalRecords: 0,
      last_updated: null,
      downloadStatus: downloadState.status,
      databaseSize: 0,
      availableDataTypes: ['EN', 'AM', 'ALL']
    });
  }
});

// Search FCC database by callsign (frontend expects this format)
router.get('/search/:callsign', authenticateToken, async (req, res) => {
  try {
    const { callsign } = req.params;
    
    if (!callsign) {
      return res.status(400).json({ error: 'Callsign is required' });
    }
    
    try {
      // First try local database
      const amateurRecord = await db.sql`
        SELECT * FROM fcc_amateur_records WHERE call_sign = ${callsign.toUpperCase()}
      `;
      
      const entityRecord = await db.sql`
        SELECT * FROM fcc_entity_records WHERE call_sign = ${callsign.toUpperCase()}
      `;
      
      if (amateurRecord.length > 0 || entityRecord.length > 0) {
        res.json({
          call_sign: callsign.toUpperCase(),
          found: true,
          amateur: amateurRecord[0] || null,
          entity: entityRecord[0] || null,
          source: 'local_database'
        });
        return;
      }
      
      // Fallback to FCC API if not in local database
      const response = await axios.get('https://data.fcc.gov/api/license-view/basicSearch/getLicenses', {
        params: {
          searchValue: callsign,
          format: 'json',
          category: 'Amateur'
        },
        timeout: 10000
      });
      
      if (response.data && response.data.Licenses) {
        const licenses = response.data.Licenses.License || [];
        const results = Array.isArray(licenses) ? licenses : [licenses];
        
        // Find exact match
        const exactMatch = results.find(license => 
          license.callsign && license.callsign.toLowerCase() === callsign.toLowerCase()
        );
        
        if (exactMatch) {
          res.json({
            call_sign: exactMatch.callsign || '',
            name: exactMatch.licName || '',
            address: exactMatch.streetAddress || '',
            city: exactMatch.cityName || '',
            state: exactMatch.stateName || '',
            zip: exactMatch.zipCode || '',
            license_class: exactMatch.categoryDesc || '',
            expiration_date: exactMatch.expiredDate || '',
            grant_date: exactMatch.grantDate || '',
            frn: exactMatch.frn || '',
            source: 'fcc_api'
          });
        } else {
          res.status(404).json({ error: 'Callsign not found' });
        }
      } else {
        res.status(404).json({ error: 'Callsign not found' });
      }
      
    } catch (apiError) {
      console.error('FCC API error:', apiError.message);
      res.status(503).json({ 
        error: 'FCC database temporarily unavailable',
        details: 'Please try again later'
      });
    }
    
  } catch (error) {
    console.error('FCC search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Download FCC database
router.post('/download', authenticateToken, async (req, res) => {
  try {
    const { dataType = 'EN' } = req.body;
    
    if (downloadState.status === 'downloading' || downloadState.status === 'processing') {
      return res.status(409).json({ error: 'Download already in progress' });
    }
    
    // Initialize download state
    downloadState = {
      status: 'starting',
      progress: 0,
      message: 'Initializing FCC database download...',
      totalRecords: 0,
      processedRecords: 0,
      startTime: new Date(),
      endTime: null,
      dataType
    };
    
    res.json({
      message: 'FCC database download initiated',
      dataType,
      estimatedTime: '5-10 minutes',
      downloadId: `fcc_${dataType}_${Date.now()}`
    });
    
    // Start download process asynchronously
    setTimeout(() => {
      downloadFCCDatabase(dataType);
    }, 1000);
    
  } catch (error) {
    console.error('FCC download error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get download progress
router.get('/download/progress', authenticateToken, async (req, res) => {
  try {
    res.json(downloadState);
  } catch (error) {
    console.error('FCC progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Actual download implementation
async function downloadFCCDatabase(dataType) {
  try {
    downloadState.status = 'downloading';
    downloadState.message = 'Creating database tables...';
    downloadState.progress = 5;
    
    // Create FCC database tables
    await createFCCTables();
    
    downloadState.message = 'Downloading FCC database files...';
    downloadState.progress = 10;
    
    // FCC ULS database URLs
    const fccUrls = {
      'EN': 'https://data.fcc.gov/download/pub/uls/complete/l_amat.zip', // Entity data
      'AM': 'https://data.fcc.gov/download/pub/uls/complete/l_amat.zip', // Amateur data (same file)
      'ALL': 'https://data.fcc.gov/download/pub/uls/complete/l_amat.zip' // Complete amateur database
    };
    
    const downloadUrl = fccUrls[dataType] || fccUrls['ALL'];
    const downloadDir = path.join(__dirname, '../downloads');
    const zipFilePath = path.join(downloadDir, 'fcc_amateur.zip');
    
    // Ensure download directory exists
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }
    
    // Download the ZIP file
    downloadState.message = 'Downloading FCC amateur database (this may take several minutes)...';
    downloadState.progress = 15;
    
    const response = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'stream',
      timeout: 300000 // 5 minutes timeout
    });
    
    const writer = fs.createWriteStream(zipFilePath);
    response.data.pipe(writer);
    
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    
    downloadState.message = 'Extracting ZIP file...';
    downloadState.progress = 30;
    
    // Extract ZIP file
    const extractDir = path.join(downloadDir, 'extracted');
    if (fs.existsSync(extractDir)) {
      fs.rmSync(extractDir, { recursive: true, force: true });
    }
    fs.mkdirSync(extractDir, { recursive: true });
    
    await fs.createReadStream(zipFilePath)
      .pipe(unzipper.Extract({ path: extractDir }))
      .promise();
    
    downloadState.message = 'Processing database files...';
    downloadState.progress = 40;
    
    // Process the extracted files
    await processFCCFiles(extractDir, dataType);
    
    downloadState.status = 'completed';
    downloadState.progress = 100;
    downloadState.message = 'FCC database download completed successfully!';
    downloadState.endTime = new Date();
    
    // Clean up downloaded files
    try {
      fs.unlinkSync(zipFilePath);
      fs.rmSync(extractDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }
    
    // Update last updated timestamp
    await db.sql`
      INSERT INTO settings (key, value, description)
      VALUES ('fcc_last_updated', ${new Date().toISOString()}, 'Last FCC database update')
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
    `;
    
  } catch (error) {
    console.error('FCC download process error:', error);
    downloadState.status = 'error';
    downloadState.message = `Download failed: ${error.message}`;
    downloadState.endTime = new Date();
  }
}

async function createFCCTables() {
  try {
    // Create FCC amateur records table
    await db.sql`
      CREATE TABLE IF NOT EXISTS fcc_amateur_records (
        id SERIAL PRIMARY KEY,
        call_sign VARCHAR(20) NOT NULL UNIQUE,
        operator_class VARCHAR(50),
        group_code VARCHAR(10),
        region_code VARCHAR(10),
        trustee_call_sign VARCHAR(20),
        trustee_indicator VARCHAR(10),
        physician_certification VARCHAR(10),
        ve_signature VARCHAR(10),
        systematic_call_sign_change VARCHAR(10),
        vanity_call_sign_change VARCHAR(10),
        vanity_relationship VARCHAR(10),
        previous_call_sign VARCHAR(20),
        previous_operator_class VARCHAR(50),
        trustee_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    // Create FCC entity records table
    await db.sql`
      CREATE TABLE IF NOT EXISTS fcc_entity_records (
        id SERIAL PRIMARY KEY,
        call_sign VARCHAR(20) NOT NULL,
        entity_type VARCHAR(10),
        licensee_id VARCHAR(20),
        entity_name VARCHAR(255),
        first_name VARCHAR(100),
        mi VARCHAR(10),
        last_name VARCHAR(100),
        suffix VARCHAR(20),
        phone VARCHAR(20),
        fax VARCHAR(20),
        email VARCHAR(255),
        street_address VARCHAR(255),
        city VARCHAR(100),
        state VARCHAR(50),
        zip_code VARCHAR(20),
        po_box VARCHAR(50),
        attention_line VARCHAR(255),
        sgin VARCHAR(10),
        frn VARCHAR(20),
        applicant_type_code VARCHAR(10),
        applicant_type_other VARCHAR(100),
        status_code VARCHAR(10),
        status_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    // Create indexes for better search performance
    await db.sql`CREATE INDEX IF NOT EXISTS idx_fcc_amateur_call_sign ON fcc_amateur_records(call_sign)`;
    await db.sql`CREATE INDEX IF NOT EXISTS idx_fcc_entity_call_sign ON fcc_entity_records(call_sign)`;
    
  } catch (error) {
    console.error('Error creating FCC tables:', error);
    throw error;
  }
}

async function processFCCFiles(extractDir, dataType) {
  try {
    downloadState.processedRecords = 0;
    downloadState.totalRecords = 0;
    
    // Clear existing data
    downloadState.message = 'Clearing existing FCC data...';
    downloadState.progress = 45;
    
    await db.sql`DELETE FROM fcc_amateur_records`;
    await db.sql`DELETE FROM fcc_entity_records`;
    
    // FCC ULS database files we're interested in:
    // AM.dat - Amateur records
    // EN.dat - Entity (licensee) records
    
    const files = fs.readdirSync(extractDir);
    console.log('Extracted files:', files);
    
    // Process Amateur records (AM.dat)
    const amFile = files.find(f => f.toUpperCase() === 'AM.DAT');
    if (amFile && (dataType === 'AM' || dataType === 'ALL')) {
      downloadState.message = 'Processing amateur records...';
      downloadState.progress = 50;
      await processAmateurFile(path.join(extractDir, amFile));
    }
    
    // Process Entity records (EN.dat)
    const enFile = files.find(f => f.toUpperCase() === 'EN.DAT');
    if (enFile && (dataType === 'EN' || dataType === 'ALL')) {
      downloadState.message = 'Processing entity records...';
      downloadState.progress = 75;
      await processEntityFile(path.join(extractDir, enFile));
    }
    
    downloadState.message = 'Finalizing database...';
    downloadState.progress = 95;
    
    // Verify the records were inserted
    const amateurCount = await db.sql`SELECT COUNT(*) as count FROM fcc_amateur_records`;
    const entityCount = await db.sql`SELECT COUNT(*) as count FROM fcc_entity_records`;
    
    downloadState.totalRecords = downloadState.processedRecords;
    
    console.log(`FCC download completed: ${amateurCount[0].count} amateur records, ${entityCount[0].count} entity records`);
    
  } catch (error) {
    console.error('Error processing FCC files:', error);
    throw error;
  }
}

async function processAmateurFile(filePath) {
  return new Promise((resolve, reject) => {
    let recordCount = 0;
    const batchSize = 1000;
    let batch = [];
    
    fs.createReadStream(filePath)
      .pipe(csv({
        separator: '|',
        headers: false,
        skipEmptyLines: true
      }))
      .on('data', async (row) => {
        try {
          // FCC AM.dat format (pipe-delimited):
          // 0: Record Type, 1: Unique System Identifier, 2: ULS File Number, 3: EBF Number, 4: Call Sign,
          // 5: Operator Class, 6: Group Code, 7: Region Code, 8: Trustee Call Sign, 9: Trustee Indicator,
          // 10: Physician Certification, 11: VE Signature, 12: Systematic Call Sign Change, 13: Vanity Call Sign Change,
          // 14: Vanity Relationship, 15: Previous Call Sign, 16: Previous Operator Class, 17: Trustee Name
          
          if (row[0] === 'AM' && row[4]) { // Record type AM and has call sign
            batch.push({
              call_sign: row[4].trim(),
              operator_class: row[5] ? row[5].trim() : null,
              group_code: row[6] ? row[6].trim() : null,
              region_code: row[7] ? row[7].trim() : null,
              trustee_call_sign: row[8] ? row[8].trim() : null,
              trustee_indicator: row[9] ? row[9].trim() : null,
              physician_certification: row[10] ? row[10].trim() : null,
              ve_signature: row[11] ? row[11].trim() : null,
              systematic_call_sign_change: row[12] ? row[12].trim() : null,
              vanity_call_sign_change: row[13] ? row[13].trim() : null,
              vanity_relationship: row[14] ? row[14].trim() : null,
              previous_call_sign: row[15] ? row[15].trim() : null,
              previous_operator_class: row[16] ? row[16].trim() : null,
              trustee_name: row[17] ? row[17].trim() : null
            });
            
            recordCount++;
            
            if (batch.length >= batchSize) {
              await insertAmateurBatch(batch);
              downloadState.processedRecords += batch.length;
              batch = [];
            }
          }
        } catch (error) {
          console.error('Error processing amateur record:', error);
        }
      })
      .on('end', async () => {
        try {
          if (batch.length > 0) {
            await insertAmateurBatch(batch);
            downloadState.processedRecords += batch.length;
          }
          console.log(`Processed ${recordCount} amateur records`);
          resolve();
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

async function processEntityFile(filePath) {
  return new Promise((resolve, reject) => {
    let recordCount = 0;
    const batchSize = 1000;
    let batch = [];
    
    fs.createReadStream(filePath)
      .pipe(csv({
        separator: '|',
        headers: false,
        skipEmptyLines: true
      }))
      .on('data', async (row) => {
        try {
          // FCC EN.dat format (pipe-delimited):
          // 0: Record Type, 1: Unique System Identifier, 2: ULS File Number, 3: EBF Number, 4: Call Sign,
          // 5: Entity Type, 6: Licensee ID, 7: Entity Name, 8: First Name, 9: MI, 10: Last Name, 11: Suffix,
          // 12: Phone, 13: Fax, 14: Email, 15: Street Address, 16: City, 17: State, 18: Zip Code, 19: PO Box,
          // 20: Attention Line, 21: SGIN, 22: FRN, 23: Applicant Type Code, 24: Applicant Type Other, 25: Status Code, 26: Status Date
          
          if (row[0] === 'EN' && row[4]) { // Record type EN and has call sign
            batch.push({
              call_sign: row[4].trim(),
              entity_type: row[5] ? row[5].trim() : null,
              licensee_id: row[6] ? row[6].trim() : null,
              entity_name: row[7] ? row[7].trim() : null,
              first_name: row[8] ? row[8].trim() : null,
              mi: row[9] ? row[9].trim() : null,
              last_name: row[10] ? row[10].trim() : null,
              suffix: row[11] ? row[11].trim() : null,
              phone: row[12] ? row[12].trim() : null,
              fax: row[13] ? row[13].trim() : null,
              email: row[14] ? row[14].trim() : null,
              street_address: row[15] ? row[15].trim() : null,
              city: row[16] ? row[16].trim() : null,
              state: row[17] ? row[17].trim() : null,
              zip_code: row[18] ? row[18].trim() : null,
              po_box: row[19] ? row[19].trim() : null,
              attention_line: row[20] ? row[20].trim() : null,
              sgin: row[21] ? row[21].trim() : null,
              frn: row[22] ? row[22].trim() : null,
              applicant_type_code: row[23] ? row[23].trim() : null,
              applicant_type_other: row[24] ? row[24].trim() : null,
              status_code: row[25] ? row[25].trim() : null,
              status_date: row[26] && row[26].trim() ? new Date(row[26].trim()) : null
            });
            
            recordCount++;
            
            if (batch.length >= batchSize) {
              await insertEntityBatch(batch);
              downloadState.processedRecords += batch.length;
              batch = [];
            }
          }
        } catch (error) {
          console.error('Error processing entity record:', error);
        }
      })
      .on('end', async () => {
        try {
          if (batch.length > 0) {
            await insertEntityBatch(batch);
            downloadState.processedRecords += batch.length;
          }
          console.log(`Processed ${recordCount} entity records`);
          resolve();
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

async function insertAmateurBatch(batch) {
  try {
    for (const record of batch) {
      await db.sql`
        INSERT INTO fcc_amateur_records (
          call_sign, operator_class, group_code, region_code, trustee_call_sign,
          trustee_indicator, physician_certification, ve_signature, systematic_call_sign_change,
          vanity_call_sign_change, vanity_relationship, previous_call_sign, previous_operator_class, trustee_name
        ) VALUES (
          ${record.call_sign}, ${record.operator_class}, ${record.group_code}, ${record.region_code},
          ${record.trustee_call_sign}, ${record.trustee_indicator}, ${record.physician_certification},
          ${record.ve_signature}, ${record.systematic_call_sign_change}, ${record.vanity_call_sign_change},
          ${record.vanity_relationship}, ${record.previous_call_sign}, ${record.previous_operator_class}, ${record.trustee_name}
        )
        ON CONFLICT (call_sign) DO UPDATE SET
          operator_class = EXCLUDED.operator_class,
          group_code = EXCLUDED.group_code,
          region_code = EXCLUDED.region_code,
          updated_at = CURRENT_TIMESTAMP
      `;
    }
  } catch (error) {
    console.error('Error inserting amateur batch:', error);
    throw error;
  }
}

async function insertEntityBatch(batch) {
  try {
    for (const record of batch) {
      await db.sql`
        INSERT INTO fcc_entity_records (
          call_sign, entity_type, licensee_id, entity_name, first_name, mi, last_name, suffix,
          phone, fax, email, street_address, city, state, zip_code, po_box, attention_line,
          sgin, frn, applicant_type_code, applicant_type_other, status_code, status_date
        ) VALUES (
          ${record.call_sign}, ${record.entity_type}, ${record.licensee_id}, ${record.entity_name},
          ${record.first_name}, ${record.mi}, ${record.last_name}, ${record.suffix}, ${record.phone},
          ${record.fax}, ${record.email}, ${record.street_address}, ${record.city}, ${record.state},
          ${record.zip_code}, ${record.po_box}, ${record.attention_line}, ${record.sgin}, ${record.frn},
          ${record.applicant_type_code}, ${record.applicant_type_other}, ${record.status_code}, ${record.status_date}
        )
      `;
    }
  } catch (error) {
    console.error('Error inserting entity batch:', error);
    throw error;
  }
}

// Get license details by callsign (legacy endpoint)
router.get('/callsign/:callsign', authenticateToken, async (req, res) => {
  try {
    const { callsign } = req.params;
    
    if (!callsign) {
      return res.status(400).json({ error: 'Callsign is required' });
    }
    
    try {
      const response = await axios.get('https://data.fcc.gov/api/license-view/basicSearch/getLicenses', {
        params: {
          searchValue: callsign,
          format: 'json',
          category: 'Amateur'
        },
        timeout: 10000
      });
      
      if (response.data && response.data.Licenses) {
        const licenses = response.data.Licenses.License || [];
        const results = Array.isArray(licenses) ? licenses : [licenses];
        
        // Find exact match
        const exactMatch = results.find(license => 
          license.callsign && license.callsign.toLowerCase() === callsign.toLowerCase()
        );
        
        if (exactMatch) {
          res.json({
            callsign: exactMatch.callsign || '',
            name: exactMatch.licName || '',
            address: exactMatch.streetAddress || '',
            city: exactMatch.cityName || '',
            state: exactMatch.stateName || '',
            zip: exactMatch.zipCode || '',
            licenseClass: exactMatch.categoryDesc || '',
            expirationDate: exactMatch.expiredDate || '',
            grantDate: exactMatch.grantDate || '',
            frn: exactMatch.frn || ''
          });
        } else {
          res.status(404).json({ error: 'Callsign not found' });
        }
      } else {
        res.status(404).json({ error: 'Callsign not found' });
      }
      
    } catch (apiError) {
      console.error('FCC API error:', apiError.message);
      res.status(503).json({ 
        error: 'FCC database temporarily unavailable',
        details: 'Please try again later'
      });
    }
    
  } catch (error) {
    console.error('FCC callsign lookup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Import operator from FCC data
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
    
    // Get FCC data
    try {
      const response = await axios.get('https://data.fcc.gov/api/license-view/basicSearch/getLicenses', {
        params: {
          searchValue: callsign,
          format: 'json',
          category: 'Amateur'
        },
        timeout: 10000
      });
      
      if (response.data && response.data.Licenses) {
        const licenses = response.data.Licenses.License || [];
        const results = Array.isArray(licenses) ? licenses : [licenses];
        
        const exactMatch = results.find(license => 
          license.callsign && license.callsign.toLowerCase() === callsign.toLowerCase()
        );
        
        if (exactMatch) {
          // Import into operators table
          const result = await db.sql`
            INSERT INTO operators (
              call_sign, name, address, city, state, zip, license_class, active
            ) VALUES (
              ${exactMatch.callsign || callsign.toUpperCase()},
              ${exactMatch.licName || null},
              ${exactMatch.streetAddress || null},
              ${exactMatch.cityName || null},
              ${exactMatch.stateName || null},
              ${exactMatch.zipCode || null},
              ${exactMatch.categoryDesc || null},
              true
            ) RETURNING *
          `;
          
          res.status(201).json({
            message: 'Operator imported successfully',
            operator: result[0]
          });
        } else {
          res.status(404).json({ error: 'Callsign not found in FCC database' });
        }
      } else {
        res.status(404).json({ error: 'Callsign not found in FCC database' });
      }
      
    } catch (apiError) {
      console.error('FCC API error:', apiError.message);
      res.status(503).json({ 
        error: 'FCC database temporarily unavailable',
        details: 'Please try again later'
      });
    }
    
  } catch (error) {
    console.error('FCC import error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;