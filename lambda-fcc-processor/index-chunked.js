const AWS = require('aws-sdk');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper');
const csv = require('csv-parser');
const { Client } = require('pg');

// Initialize AWS services
const dynamodb = new AWS.DynamoDB.DocumentClient();
const lambda = new AWS.Lambda();

// Progress tracking table
const PROGRESS_TABLE = 'fcc-download-progress';

// Processing limits
const MAX_PROCESSING_TIME = 12 * 60 * 1000; // 12 minutes (leave 3 minutes buffer)
const BATCH_SIZE = 100; // Larger batches for efficiency
const PROGRESS_UPDATE_INTERVAL = 5000; // Update progress every 5000 records

// Database connection
let dbClient = null;

async function getDbConnection() {
  if (!dbClient) {
    console.log('Creating new database connection...');
    
    dbClient = new Client({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'postgres',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 30000,
      query_timeout: 60000,
      statement_timeout: 60000,
      idle_in_transaction_session_timeout: 120000
    });
    
    await dbClient.connect();
    console.log('Database connection successful!');
  }
  return dbClient;
}

async function updateProgress(jobId, status, progress, message, processedRecords = 0, totalRecords = 0, resumeData = null) {
  const params = {
    TableName: PROGRESS_TABLE,
    Key: { jobId },
    UpdateExpression: 'SET #status = :status, progress = :progress, message = :message, processedRecords = :processedRecords, totalRecords = :totalRecords, updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':status': status,
      ':progress': progress,
      ':message': message,
      ':processedRecords': processedRecords,
      ':totalRecords': totalRecords,
      ':updatedAt': new Date().toISOString()
    }
  };
  
  if (resumeData) {
    params.UpdateExpression += ', resumeData = :resumeData';
    params.ExpressionAttributeValues[':resumeData'] = resumeData;
  }
  
  try {
    await dynamodb.update(params).promise();
    console.log(`Progress updated: ${status} - ${progress}% - ${message}`);
  } catch (error) {
    console.error('Error updating progress:', error);
  }
}

async function getProgress(jobId) {
  try {
    const result = await dynamodb.get({
      TableName: PROGRESS_TABLE,
      Key: { jobId }
    }).promise();
    return result.Item;
  } catch (error) {
    console.error('Error getting progress:', error);
    return null;
  }
}

async function invokeContinuation(jobId, resumeData) {
  const params = {
    FunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
    InvocationType: 'Event', // Async invocation
    Payload: JSON.stringify({
      jobId,
      continuation: true,
      resumeData
    })
  };
  
  try {
    await lambda.invoke(params).promise();
    console.log('Continuation Lambda invoked successfully');
  } catch (error) {
    console.error('Error invoking continuation:', error);
    throw error;
  }
}

async function createFCCTables(db) {
  try {
    // Create FCC amateur records table
    await db.query(`
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
    `);
    
    // Create FCC entity records table
    await db.query(`
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
    `);
    
    // Create indexes
    await db.query('CREATE INDEX IF NOT EXISTS idx_fcc_amateur_call_sign ON fcc_amateur_records(call_sign)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_fcc_entity_call_sign ON fcc_entity_records(call_sign)');
    
    console.log('FCC tables created successfully');
  } catch (error) {
    console.error('Error creating FCC tables:', error);
    throw error;
  }
}

async function insertAmateurBatch(db, batch) {
  if (batch.length === 0) return;
  
  try {
    // Use batch insert with ON CONFLICT for better performance
    const values = batch.map((record, index) => {
      const baseIndex = index * 14;
      return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}, $${baseIndex + 9}, $${baseIndex + 10}, $${baseIndex + 11}, $${baseIndex + 12}, $${baseIndex + 13}, $${baseIndex + 14})`;
    }).join(', ');
    
    const params = batch.flatMap(record => [
      record.call_sign, record.operator_class, record.group_code, record.region_code,
      record.trustee_call_sign, record.trustee_indicator, record.physician_certification,
      record.ve_signature, record.systematic_call_sign_change, record.vanity_call_sign_change,
      record.vanity_relationship, record.previous_call_sign, record.previous_operator_class, record.trustee_name
    ]);
    
    await db.query(`
      INSERT INTO fcc_amateur_records (
        call_sign, operator_class, group_code, region_code, trustee_call_sign,
        trustee_indicator, physician_certification, ve_signature, systematic_call_sign_change,
        vanity_call_sign_change, vanity_relationship, previous_call_sign, previous_operator_class, trustee_name
      ) VALUES ${values}
      ON CONFLICT (call_sign) DO UPDATE SET
        operator_class = EXCLUDED.operator_class,
        group_code = EXCLUDED.group_code,
        region_code = EXCLUDED.region_code,
        updated_at = CURRENT_TIMESTAMP
    `, params);
    
  } catch (error) {
    console.error('Error in amateur batch processing:', error.message);
    // Fall back to individual inserts
    for (const record of batch) {
      try {
        await db.query(`
          INSERT INTO fcc_amateur_records (
            call_sign, operator_class, group_code, region_code, trustee_call_sign,
            trustee_indicator, physician_certification, ve_signature, systematic_call_sign_change,
            vanity_call_sign_change, vanity_relationship, previous_call_sign, previous_operator_class, trustee_name
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          ON CONFLICT (call_sign) DO UPDATE SET
            operator_class = EXCLUDED.operator_class,
            updated_at = CURRENT_TIMESTAMP
        `, [
          record.call_sign, record.operator_class, record.group_code, record.region_code,
          record.trustee_call_sign, record.trustee_indicator, record.physician_certification,
          record.ve_signature, record.systematic_call_sign_change, record.vanity_call_sign_change,
          record.vanity_relationship, record.previous_call_sign, record.previous_operator_class, record.trustee_name
        ]);
      } catch (individualError) {
        console.error(`Error inserting individual amateur record ${record.call_sign}:`, individualError.message);
      }
    }
  }
}

async function processFileChunked(db, filePath, jobId, resumeData = null) {
  const startTime = Date.now();
  let recordCount = resumeData?.recordCount || 0;
  let processedCount = resumeData?.processedCount || 0;
  let skipLines = resumeData?.skipLines || 0;
  let batch = [];
  let currentLine = 0;
  
  console.log(`Starting chunked processing from line ${skipLines}, processed: ${processedCount}`);
  
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath)
      .pipe(csv({
        separator: '|',
        headers: false,
        skipEmptyLines: true
      }));
    
    stream.on('data', async (row) => {
      currentLine++;
      
      // Skip lines we've already processed
      if (currentLine <= skipLines) {
        return;
      }
      
      // Check if we're approaching timeout
      if (Date.now() - startTime > MAX_PROCESSING_TIME) {
        console.log('Approaching timeout, preparing continuation...');
        stream.pause();
        
        try {
          // Process remaining batch
          if (batch.length > 0) {
            await insertAmateurBatch(db, batch);
            processedCount += batch.length;
          }
          
          // Save resume data and invoke continuation
          const newResumeData = {
            recordCount,
            processedCount,
            skipLines: currentLine,
            phase: 'amateur'
          };
          
          await updateProgress(jobId, 'processing', 
            Math.floor((processedCount / Math.max(recordCount, 1)) * 50), 
            `Processed ${processedCount.toLocaleString()} records, continuing...`, 
            processedCount, recordCount, newResumeData);
          
          await invokeContinuation(jobId, newResumeData);
          
          resolve({ continued: true, processedCount });
        } catch (error) {
          reject(error);
        }
        return;
      }
      
      try {
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
          
          if (batch.length >= BATCH_SIZE) {
            stream.pause();
            
            try {
              await insertAmateurBatch(db, batch);
              processedCount += batch.length;
              
              // Update progress periodically
              if (processedCount % PROGRESS_UPDATE_INTERVAL === 0) {
                const progress = Math.floor((processedCount / Math.max(recordCount, 1)) * 50);
                await updateProgress(jobId, 'processing', progress, 
                  `Processing amateur records: ${processedCount.toLocaleString()}`, 
                  processedCount, recordCount);
              }
              
              batch = [];
              
              // Force garbage collection
              if (global.gc) {
                global.gc();
              }
              
              stream.resume();
            } catch (error) {
              console.error('Error processing batch:', error.message);
              stream.resume();
            }
          }
        }
      } catch (error) {
        console.error('Error processing amateur record:', error.message);
      }
    });
    
    stream.on('end', async () => {
      try {
        if (batch.length > 0) {
          await insertAmateurBatch(db, batch);
          processedCount += batch.length;
        }
        console.log(`Completed processing ${recordCount} amateur records`);
        resolve({ completed: true, processedCount });
      } catch (error) {
        reject(error);
      }
    });
    
    stream.on('error', reject);
  });
}

exports.handler = async (event) => {
  const { jobId, dataType = 'ALL', continuation = false, resumeData = null } = event;
  
  console.log('Lambda function started with event:', JSON.stringify(event));
  
  if (!jobId) {
    console.error('No jobId provided in event');
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'jobId is required' })
    };
  }
  
  try {
    const db = await getDbConnection();
    
    if (!continuation) {
      // Initial invocation - download and setup
      await updateProgress(jobId, 'starting', 0, 'Starting FCC database download...');
      
      // Clear existing data
      await db.query('DELETE FROM fcc_amateur_records');
      await db.query('DELETE FROM fcc_entity_records');
      
      await createFCCTables(db);
      
      // Download FCC database
      await updateProgress(jobId, 'downloading', 10, 'Downloading FCC database...');
      
      const downloadUrl = 'https://data.fcc.gov/download/pub/uls/complete/l_amat.zip';
      const zipPath = '/tmp/fcc_amateur.zip';
      const extractPath = '/tmp/fcc_data';
      
      // Download file
      const response = await axios({
        method: 'GET',
        url: downloadUrl,
        responseType: 'stream'
      });
      
      const writer = fs.createWriteStream(zipPath);
      response.data.pipe(writer);
      
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      
      await updateProgress(jobId, 'extracting', 30, 'Extracting FCC database...');
      
      // Extract ZIP file
      if (fs.existsSync(extractPath)) {
        fs.rmSync(extractPath, { recursive: true, force: true });
      }
      fs.mkdirSync(extractPath, { recursive: true });
      
      await fs.createReadStream(zipPath)
        .pipe(unzipper.Extract({ path: extractPath }))
        .promise();
      
      // Clean up ZIP file
      fs.unlinkSync(zipPath);
      
      await updateProgress(jobId, 'processing', 40, 'Starting to process records...');
    }
    
    // Process amateur records (chunked)
    const extractPath = '/tmp/fcc_data';
    const amateurFile = path.join(extractPath, 'AM.dat');
    
    if (fs.existsSync(amateurFile)) {
      const result = await processFileChunked(db, amateurFile, jobId, resumeData);
      
      if (result.continued) {
        // Function will continue in another invocation
        return {
          statusCode: 200,
          body: JSON.stringify({ 
            message: 'Processing continued in another invocation',
            processedRecords: result.processedCount
          })
        };
      }
      
      // Completed processing
      await updateProgress(jobId, 'completed', 100, 
        `FCC database update completed. Processed ${result.processedCount.toLocaleString()} records.`,
        result.processedCount, result.processedCount);
    }
    
    // Clean up
    if (fs.existsSync(extractPath)) {
      fs.rmSync(extractPath, { recursive: true, force: true });
    }
    
    if (dbClient) {
      await dbClient.end();
      dbClient = null;
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'FCC database update completed successfully'
      })
    };
    
  } catch (error) {
    console.error('Lambda execution error:', error);
    
    await updateProgress(jobId, 'error', 0, `Error: ${error.message}`);
    
    if (dbClient) {
      try {
        await dbClient.end();
      } catch (closeError) {
        console.error('Error closing database connection:', closeError);
      }
      dbClient = null;
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Lambda execution failed',
        details: error.message
      })
    };
  }
};