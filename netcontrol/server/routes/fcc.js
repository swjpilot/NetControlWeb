const express = require('express');
const router = express.Router();
const db = require('../database/db');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const https = require('https');
const unzipper = require('unzipper');
const { pipeline } = require('stream');
const { promisify } = require('util');

const pipelineAsync = promisify(pipeline);

// FCC ULS download URLs
const FCC_URLS = {
  EN: 'https://data.fcc.gov/download/pub/uls/complete/l_amat.zip',
  AM: 'https://data.fcc.gov/download/pub/uls/complete/l_amat.zip',
  HD: 'https://data.fcc.gov/download/pub/uls/complete/l_amat.zip',
  ALL: 'https://data.fcc.gov/download/pub/uls/complete/l_amat.zip'
};

// Store download progress globally (in production, use Redis or similar)
let downloadProgress = {};

// Download and process FCC database
router.post('/download', async (req, res) => {
  try {
    const { dataType = 'ALL' } = req.body;
    
    if (!FCC_URLS[dataType]) {
      return res.status(400).json({ error: 'Invalid data type' });
    }
    
    // Check if download is already in progress
    if (downloadProgress.status && downloadProgress.status !== 'completed' && downloadProgress.status !== 'error') {
      return res.status(409).json({ 
        error: 'Download already in progress',
        progress: downloadProgress 
      });
    }
    
    // Initialize progress tracking
    downloadProgress = {
      status: 'starting',
      progress: 0,
      message: 'Initializing download...',
      dataType,
      startTime: new Date().toISOString()
    };
    
    res.json({ 
      message: 'FCC database download started',
      status: 'processing',
      dataType 
    });
    
    // Start download process in background
    downloadAndProcessFCCData(dataType).catch(error => {
      console.error('Download process error:', error);
      downloadProgress = {
        status: 'error',
        progress: 0,
        message: error.message,
        error: true
      };
    });
    
  } catch (error) {
    console.error('FCC download error:', error);
    res.status(500).json({ error: 'Failed to start FCC database download' });
  }
});

// Get download progress
router.get('/download/progress', (req, res) => {
  res.json(downloadProgress);
});

// Background download and processing function
async function downloadAndProcessFCCData(dataType) {
  const downloadDir = path.join(__dirname, '../downloads');
  const extractDir = path.join(__dirname, '../downloads/extracted');
  
  try {
    // Ensure directories exist
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }
    if (!fs.existsSync(extractDir)) {
      fs.mkdirSync(extractDir, { recursive: true });
    }
    
    // Clean up old files
    if (fs.existsSync(extractDir)) {
      fs.rmSync(extractDir, { recursive: true, force: true });
      fs.mkdirSync(extractDir, { recursive: true });
    }
    
    const zipPath = path.join(downloadDir, 'l_amat.zip');
    
    console.log('Starting FCC database download...');
    downloadProgress.status = 'downloading';
    downloadProgress.message = 'Downloading FCC database...';
    downloadProgress.progress = 5;
    
    // Download the ZIP file
    await downloadFileWithProgress(FCC_URLS[dataType], zipPath);
    
    console.log('Download completed, extracting files...');
    downloadProgress.status = 'extracting';
    downloadProgress.message = 'Extracting ZIP file...';
    downloadProgress.progress = 30;
    
    // Extract the ZIP file
    await extractZipFile(zipPath, extractDir);
    
    console.log('Extraction completed, processing data files...');
    downloadProgress.status = 'processing';
    downloadProgress.message = 'Processing database records...';
    downloadProgress.progress = 40;
    
    // Process the extracted files
    let processedRecords = 0;
    
    if (dataType === 'EN' || dataType === 'ALL') {
      downloadProgress.message = 'Processing Entity (EN) records...';
      downloadProgress.progress = 50;
      const enCount = await processENFile(path.join(extractDir, 'EN.dat'));
      processedRecords += enCount;
      console.log(`Processed ${enCount} EN records`);
    }
    
    if (dataType === 'AM' || dataType === 'ALL') {
      downloadProgress.message = 'Processing Amateur (AM) records...';
      downloadProgress.progress = 70;
      const amCount = await processAMFile(path.join(extractDir, 'AM.dat'));
      processedRecords += amCount;
      console.log(`Processed ${amCount} AM records`);
    }
    
    if (dataType === 'HD' || dataType === 'ALL') {
      downloadProgress.message = 'Processing Header (HD) records...';
      downloadProgress.progress = 85;
      const hdCount = await processHDFile(path.join(extractDir, 'HD.dat'));
      processedRecords += hdCount;
      console.log(`Processed ${hdCount} HD records`);
    }
    
    downloadProgress.message = 'Finalizing database...';
    downloadProgress.progress = 95;
    
    // Update last updated timestamp
    await db.run(`
      INSERT OR REPLACE INTO settings (key, value) 
      VALUES ('fcc_last_updated', ?)
    `, [new Date().toISOString()]);
    
    // Store download statistics
    await db.run(`
      INSERT OR REPLACE INTO settings (key, value) 
      VALUES ('fcc_records_processed', ?)
    `, [processedRecords.toString()]);
    
    downloadProgress = {
      status: 'completed',
      progress: 100,
      message: `Successfully processed ${processedRecords.toLocaleString()} records`,
      recordsProcessed: processedRecords,
      completedAt: new Date().toISOString()
    };
    
    console.log(`FCC database update completed - ${processedRecords} records processed`);
    
    // Cleanup downloaded files
    try {
      if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
      }
      if (fs.existsSync(extractDir)) {
        fs.rmSync(extractDir, { recursive: true, force: true });
      }
    } catch (cleanupError) {
      console.warn('Cleanup error:', cleanupError.message);
    }
    
  } catch (error) {
    console.error('FCC processing error:', error);
    downloadProgress = {
      status: 'error',
      progress: 0,
      message: `Error: ${error.message}`,
      error: true,
      errorAt: new Date().toISOString()
    };
    throw error;
  }
}

// Download file with progress tracking
function downloadFileWithProgress(url, filePath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (totalSize) {
          const progress = Math.round((downloadedSize / totalSize) * 25) + 5; // 5-30% for download
          downloadProgress.progress = Math.min(progress, 30);
          downloadProgress.message = `Downloading... ${(downloadedSize / 1024 / 1024).toFixed(1)}MB / ${(totalSize / 1024 / 1024).toFixed(1)}MB`;
        }
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
      
      file.on('error', (err) => {
        fs.unlink(filePath, () => {}); // Delete the file on error
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Extract ZIP file helper
function extractZipFile(zipPath, extractDir) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(zipPath)
      .pipe(unzipper.Extract({ path: extractDir }))
      .on('close', resolve)
      .on('error', reject);
  });
}

// Process EN (Entity) file
async function processENFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log('EN.dat file not found, skipping...');
    return 0;
  }
  
  console.log('Processing EN records...');
  
  // Clear existing EN records
  await db.run('DELETE FROM fcc_en');
  
  return new Promise((resolve, reject) => {
    let recordCount = 0;
    let batchRecords = [];
    const batchSize = 1000;
    
    const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
    let buffer = '';
    
    stream.on('data', async (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.trim()) {
          const fields = line.split('|');
          
          if (fields.length >= 23 && fields[0] === 'EN') {
            batchRecords.push({
              record_type: fields[0],
              unique_system_identifier: parseInt(fields[1]) || null,
              uls_file_number: fields[2],
              ebf_number: fields[3],
              call_sign: fields[4],
              entity_type: fields[5],
              licensee_id: fields[6],
              entity_name: fields[7],
              first_name: fields[8],
              mi: fields[9],
              last_name: fields[10],
              suffix: fields[11],
              phone: fields[12],
              fax: fields[13],
              email: fields[14],
              street_address: fields[15],
              city: fields[16],
              state: fields[17],
              zip_code: fields[18],
              po_box: fields[19],
              attention_line: fields[20],
              sgin: fields[21],
              frn: fields[22]
            });
            
            recordCount++;
            
            // Batch insert every 1000 records
            if (batchRecords.length >= batchSize) {
              try {
                await insertENRecords(batchRecords);
                batchRecords = [];
                
                // Update progress
                if (recordCount % 10000 === 0) {
                  downloadProgress.message = `Processing EN records... ${recordCount.toLocaleString()} processed`;
                }
              } catch (error) {
                stream.destroy();
                reject(error);
                return;
              }
            }
          }
        }
      }
    });
    
    stream.on('end', async () => {
      try {
        // Insert remaining records
        if (batchRecords.length > 0) {
          await insertENRecords(batchRecords);
        }
        console.log(`Processed ${recordCount} EN records`);
        resolve(recordCount);
      } catch (error) {
        reject(error);
      }
    });
    
    stream.on('error', reject);
  });
}

// Process AM (Amateur) file
async function processAMFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log('AM.dat file not found, skipping...');
    return 0;
  }
  
  console.log('Processing AM records...');
  
  // Clear existing AM records
  await db.run('DELETE FROM fcc_am');
  
  return new Promise((resolve, reject) => {
    let recordCount = 0;
    let batchRecords = [];
    const batchSize = 1000;
    
    const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
    let buffer = '';
    
    stream.on('data', async (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.trim()) {
          const fields = line.split('|');
          
          if (fields.length >= 18 && fields[0] === 'AM') {
            batchRecords.push({
              record_type: fields[0],
              unique_system_identifier: parseInt(fields[1]) || null,
              uls_file_number: fields[2],
              ebf_number: fields[3],
              call_sign: fields[4],
              operator_class: fields[5],
              group_code: fields[6],
              region_code: parseInt(fields[7]) || null,
              trustee_call_sign: fields[8],
              trustee_indicator: fields[9],
              physician_certification: fields[10],
              ve_signature: fields[11],
              systematic_call_sign_change: fields[12],
              vanity_call_sign_change: fields[13],
              vanity_relationship: fields[14],
              previous_call_sign: fields[15],
              previous_operator_class: fields[16],
              trustee_name: fields[17]
            });
            
            recordCount++;
            
            // Batch insert every 1000 records
            if (batchRecords.length >= batchSize) {
              try {
                await insertAMRecords(batchRecords);
                batchRecords = [];
                
                // Update progress
                if (recordCount % 10000 === 0) {
                  downloadProgress.message = `Processing AM records... ${recordCount.toLocaleString()} processed`;
                }
              } catch (error) {
                stream.destroy();
                reject(error);
                return;
              }
            }
          }
        }
      }
    });
    
    stream.on('end', async () => {
      try {
        // Insert remaining records
        if (batchRecords.length > 0) {
          await insertAMRecords(batchRecords);
        }
        console.log(`Processed ${recordCount} AM records`);
        resolve(recordCount);
      } catch (error) {
        reject(error);
      }
    });
    
    stream.on('error', reject);
  });
}

// Process HD (Header) file
async function processHDFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log('HD.dat file not found, skipping...');
    return 0;
  }
  
  console.log('Processing HD records...');
  // For now, we'll just count HD records but not store them
  // HD records contain application/license header information
  
  return new Promise((resolve, reject) => {
    let recordCount = 0;
    
    const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
    let buffer = '';
    
    stream.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop();
      
      for (const line of lines) {
        if (line.trim() && line.startsWith('HD|')) {
          recordCount++;
          
          if (recordCount % 10000 === 0) {
            downloadProgress.message = `Processing HD records... ${recordCount.toLocaleString()} processed`;
          }
        }
      }
    });
    
    stream.on('end', () => {
      console.log(`Processed ${recordCount} HD records`);
      resolve(recordCount);
    });
    
    stream.on('error', reject);
  });
}

// Insert EN records helper
async function insertENRecords(records) {
  if (records.length === 0) return;
  
  const placeholders = records.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
  const values = records.flatMap(r => [
    r.record_type, r.unique_system_identifier, r.uls_file_number, r.ebf_number,
    r.call_sign, r.entity_type, r.licensee_id, r.entity_name, r.first_name,
    r.mi, r.last_name, r.suffix, r.phone, r.fax, r.email, r.street_address,
    r.city, r.state, r.zip_code, r.po_box, r.attention_line, r.sgin, r.frn
  ]);
  
  await db.run(`
    INSERT INTO fcc_en (
      record_type, unique_system_identifier, uls_file_number, ebf_number,
      call_sign, entity_type, licensee_id, entity_name, first_name, mi,
      last_name, suffix, phone, fax, email, street_address, city, state,
      zip_code, po_box, attention_line, sgin, frn
    ) VALUES ${placeholders}
  `, values);
}

// Insert AM records helper
async function insertAMRecords(records) {
  if (records.length === 0) return;
  
  const placeholders = records.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
  const values = records.flatMap(r => [
    r.record_type, r.unique_system_identifier, r.uls_file_number, r.ebf_number,
    r.call_sign, r.operator_class, r.group_code, r.region_code,
    r.trustee_call_sign, r.trustee_indicator, r.physician_certification,
    r.ve_signature, r.systematic_call_sign_change, r.vanity_call_sign_change,
    r.vanity_relationship, r.previous_call_sign, r.previous_operator_class,
    r.trustee_name
  ]);
  
  await db.run(`
    INSERT INTO fcc_am (
      record_type, unique_system_identifier, uls_file_number, ebf_number,
      call_sign, operator_class, group_code, region_code, trustee_call_sign,
      trustee_indicator, physician_certification, ve_signature,
      systematic_call_sign_change, vanity_call_sign_change, vanity_relationship,
      previous_call_sign, previous_operator_class, trustee_name
    ) VALUES ${placeholders}
  `, values);
}

// Search FCC database
router.get('/search/:callSign', async (req, res) => {
  try {
    const { callSign } = req.params;
    
    // Search AM (Amateur) records
    const amRecord = await db.get(`
      SELECT * FROM fcc_am WHERE call_sign = ?
    `, [callSign.toUpperCase()]);
    
    // Search EN (Entity) records
    const enRecord = await db.get(`
      SELECT * FROM fcc_en WHERE call_sign = ?
    `, [callSign.toUpperCase()]);
    
    if (!amRecord && !enRecord) {
      return res.status(404).json({ error: 'Call sign not found in FCC database' });
    }
    
    res.json({
      call_sign: callSign.toUpperCase(),
      amateur: amRecord,
      entity: enRecord,
      found: !!(amRecord || enRecord)
    });
  } catch (error) {
    console.error('FCC search error:', error);
    res.status(500).json({ error: 'Failed to search FCC database' });
  }
});

// Get FCC database statistics
router.get('/stats', async (req, res) => {
  try {
    const [amCount, enCount, lastUpdated, recordsProcessed] = await Promise.all([
      db.get('SELECT COUNT(*) as count FROM fcc_am'),
      db.get('SELECT COUNT(*) as count FROM fcc_en'),
      db.get('SELECT value FROM settings WHERE key = ?', ['fcc_last_updated']),
      db.get('SELECT value FROM settings WHERE key = ?', ['fcc_records_processed'])
    ]);
    
    res.json({
      amateur_records: amCount?.count || 0,
      entity_records: enCount?.count || 0,
      total_records: (amCount?.count || 0) + (enCount?.count || 0),
      records_processed: parseInt(recordsProcessed?.value || '0'),
      last_updated: lastUpdated?.value || null
    });
  } catch (error) {
    console.error('FCC stats error:', error);
    res.status(500).json({ error: 'Failed to get FCC database statistics' });
  }
});

// Clear FCC database
router.delete('/clear', async (req, res) => {
  try {
    await Promise.all([
      db.run('DELETE FROM fcc_am'),
      db.run('DELETE FROM fcc_en'),
      db.run('DELETE FROM settings WHERE key = ?', ['fcc_last_updated']),
      db.run('DELETE FROM settings WHERE key = ?', ['fcc_records_processed'])
    ]);
    
    // Reset download progress
    downloadProgress = {};
    
    res.json({ message: 'FCC database cleared successfully' });
  } catch (error) {
    console.error('FCC clear error:', error);
    res.status(500).json({ error: 'Failed to clear FCC database' });
  }
});

module.exports = router;