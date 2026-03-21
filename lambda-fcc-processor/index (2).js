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
const s3 = new AWS.S3();

// Progress tracking table and S3 bucket
const PROGRESS_TABLE = 'fcc-download-progress';
const S3_BUCKET = 'netcontrol-fcc-temp-storage';

// Processing limits - optimized for chunked processing
const MAX_PROCESSING_TIME = 12 * 60 * 1000; // 12 minutes (leave 3 minutes buffer)
const BATCH_SIZE = 200; // Increased batch size for better performance
const PROGRESS_UPDATE_INTERVAL = 10000; // Update progress every 10000 records

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

async function uploadToS3(filePath, s3Key) {
  try {
    const fileStream = fs.createReadStream(filePath);
    const uploadParams = {
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: fileStream
    };
    
    const result = await s3.upload(uploadParams).promise();
    console.log(`File uploaded to S3: ${result.Location}`);
    return result.Location;
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw error;
  }
}

async function downloadFromS3(s3Key, localPath) {
  try {
    const downloadParams = {
      Bucket: S3_BUCKET,
      Key: s3Key
    };
    
    const s3Stream = s3.getObject(downloadParams).createReadStream();
    const writeStream = fs.createWriteStream(localPath);
    
    return new Promise((resolve, reject) => {
      s3Stream.pipe(writeStream);
      writeStream.on('finish', () => {
        console.log(`File downloaded from S3: ${s3Key} -> ${localPath}`);
        resolve();
      });
      writeStream.on('error', reject);
      s3Stream.on('error', reject);
    });
  } catch (error) {
    console.error('Error downloading from S3:', error);
    throw error;
  }
}

async function checkS3FileExists(s3Key) {
  try {
    await s3.headObject({
      Bucket: S3_BUCKET,
      Key: s3Key
    }).promise();
    return true;
  } catch (error) {
    if (error.code === 'NotFound') {
      return false;
    }
    throw error;
  }
}

async function deleteS3File(s3Key) {
  try {
    await s3.deleteObject({
      Bucket: S3_BUCKET,
      Key: s3Key
    }).promise();
    console.log(`File deleted from S3: ${s3Key}`);
  } catch (error) {
    console.error('Error deleting from S3:', error);
    // Don't throw error for cleanup operations
  }
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

async function invokeContinuation(jobId, resumeData) {
  const params = {
    FunctionName: process.env.LAMBDA_FUNCTION_NAME,
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
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(call_sign, licensee_id, entity_type)
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
  
  // Deduplicate records within the batch by call_sign (keep the last occurrence)
  const deduplicatedBatch = [];
  const seenCallSigns = new Set();
  
  // Process in reverse order to keep the last occurrence of each call sign
  for (let i = batch.length - 1; i >= 0; i--) {
    const record = batch[i];
    if (!seenCallSigns.has(record.call_sign)) {
      seenCallSigns.add(record.call_sign);
      deduplicatedBatch.unshift(record); // Add to beginning to maintain original order
    }
  }
  
  if (deduplicatedBatch.length === 0) return;
  
  try {
    // Use batch insert with ON CONFLICT for better performance
    const values = deduplicatedBatch.map((record, index) => {
      const baseIndex = index * 14;
      return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}, $${baseIndex + 9}, $${baseIndex + 10}, $${baseIndex + 11}, $${baseIndex + 12}, $${baseIndex + 13}, $${baseIndex + 14})`;
    }).join(', ');
    
    const params = deduplicatedBatch.flatMap(record => [
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
    
    if (batch.length !== deduplicatedBatch.length) {
      console.log(`Processed amateur batch: ${batch.length} records (${deduplicatedBatch.length} unique)`);
    }
    
  } catch (error) {
    console.error('Error in amateur batch processing:', error.message);
    // Fall back to individual inserts
    for (const record of deduplicatedBatch) {
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

async function insertEntityBatch(db, batch) {
  if (batch.length === 0) return;
  
  // Deduplicate records within the batch by unique key (call_sign, licensee_id, entity_type)
  const deduplicatedBatch = [];
  const seenKeys = new Set();
  
  // Process in reverse order to keep the last occurrence of each unique combination
  for (let i = batch.length - 1; i >= 0; i--) {
    const record = batch[i];
    const uniqueKey = `${record.call_sign}|${record.licensee_id}|${record.entity_type}`;
    if (!seenKeys.has(uniqueKey)) {
      seenKeys.add(uniqueKey);
      deduplicatedBatch.unshift(record); // Add to beginning to maintain original order
    }
  }
  
  if (deduplicatedBatch.length === 0) return;
  
  try {
    // Use batch insert for entity records
    const values = deduplicatedBatch.map((record, index) => {
      const baseIndex = index * 23;
      return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}, $${baseIndex + 9}, $${baseIndex + 10}, $${baseIndex + 11}, $${baseIndex + 12}, $${baseIndex + 13}, $${baseIndex + 14}, $${baseIndex + 15}, $${baseIndex + 16}, $${baseIndex + 17}, $${baseIndex + 18}, $${baseIndex + 19}, $${baseIndex + 20}, $${baseIndex + 21}, $${baseIndex + 22}, $${baseIndex + 23})`;
    }).join(', ');
    
    const params = deduplicatedBatch.flatMap(record => [
      record.call_sign, record.entity_type, record.licensee_id, record.entity_name,
      record.first_name, record.mi, record.last_name, record.suffix,
      record.phone, record.fax, record.email, record.street_address,
      record.city, record.state, record.zip_code, record.po_box,
      record.attention_line, record.sgin, record.frn, record.applicant_type_code,
      record.applicant_type_other, record.status_code, record.status_date
    ]);
    
    await db.query(`
      INSERT INTO fcc_entity_records (
        call_sign, entity_type, licensee_id, entity_name, first_name, mi, last_name, suffix,
        phone, fax, email, street_address, city, state, zip_code, po_box,
        attention_line, sgin, frn, applicant_type_code, applicant_type_other, status_code, status_date
      ) VALUES ${values}
      ON CONFLICT (call_sign, licensee_id, entity_type) DO UPDATE SET
        entity_name = EXCLUDED.entity_name,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        email = EXCLUDED.email,
        street_address = EXCLUDED.street_address,
        city = EXCLUDED.city,
        state = EXCLUDED.state,
        zip_code = EXCLUDED.zip_code,
        updated_at = CURRENT_TIMESTAMP
    `, params);
    
    if (batch.length !== deduplicatedBatch.length) {
      console.log(`Processed entity batch: ${batch.length} records (${deduplicatedBatch.length} unique)`);
    }
    
  } catch (error) {
    console.error('Error in entity batch processing:', error.message);
    // Fall back to individual inserts
    for (const record of deduplicatedBatch) {
      try {
        await db.query(`
          INSERT INTO fcc_entity_records (
            call_sign, entity_type, licensee_id, entity_name, first_name, mi, last_name, suffix,
            phone, fax, email, street_address, city, state, zip_code, po_box,
            attention_line, sgin, frn, applicant_type_code, applicant_type_other, status_code, status_date
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
          ON CONFLICT (call_sign, licensee_id, entity_type) DO UPDATE SET
            entity_name = EXCLUDED.entity_name,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            email = EXCLUDED.email,
            updated_at = CURRENT_TIMESTAMP
        `, [
          record.call_sign, record.entity_type, record.licensee_id, record.entity_name,
          record.first_name, record.mi, record.last_name, record.suffix,
          record.phone, record.fax, record.email, record.street_address,
          record.city, record.state, record.zip_code, record.po_box,
          record.attention_line, record.sgin, record.frn, record.applicant_type_code,
          record.applicant_type_other, record.status_code, record.status_date
        ]);
      } catch (individualError) {
        console.error(`Error inserting individual entity record ${record.call_sign}:`, individualError.message);
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

async function processEntityFileChunked(db, filePath, jobId, resumeData = null) {
  const startTime = Date.now();
  let recordCount = resumeData?.recordCount || 0;
  let processedCount = resumeData?.processedCount || 0;
  let skipLines = resumeData?.skipLines || 0;
  let batch = [];
  let currentLine = 0;
  
  console.log(`Starting entity processing from line ${skipLines}, processed: ${processedCount}`);
  
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
            await insertEntityBatch(db, batch);
            processedCount += batch.length;
          }
          
          // Save resume data and invoke continuation
          const newResumeData = {
            recordCount,
            processedCount,
            skipLines: currentLine,
            phase: 'entity'
          };
          
          await updateProgress(jobId, 'processing', 
            50 + Math.floor((processedCount / Math.max(recordCount, 1)) * 40), 
            `Processed ${processedCount.toLocaleString()} entity records, continuing...`, 
            processedCount, recordCount, newResumeData);
          
          await invokeContinuation(jobId, newResumeData);
          
          resolve({ continued: true, processedCount });
        } catch (error) {
          reject(error);
        }
        return;
      }
      
      try {
        if (row[0] === 'EN' && row[4]) { // Record type EN and has call sign
          // Parse status date if present
          let statusDate = null;
          if (row[22] && row[22].trim()) {
            try {
              const dateStr = row[22].trim();
              // FCC date format is typically MM/DD/YYYY
              if (dateStr.includes('/')) {
                const [month, day, year] = dateStr.split('/');
                statusDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
              }
            } catch (dateError) {
              console.log(`Invalid date format: ${row[22]}`);
            }
          }
          
          batch.push({
            call_sign: row[4].trim(),
            entity_type: row[1] ? row[1].trim() : null,
            licensee_id: row[2] ? row[2].trim() : null,
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
            frn: row[3] ? row[3].trim() : null,
            applicant_type_code: row[5] ? row[5].trim() : null,
            applicant_type_other: row[6] ? row[6].trim() : null,
            status_code: row[23] ? row[23].trim() : null,
            status_date: statusDate
          });
          
          recordCount++;
          
          if (batch.length >= BATCH_SIZE) {
            stream.pause();
            
            try {
              await insertEntityBatch(db, batch);
              processedCount += batch.length;
              
              // Update progress periodically
              if (processedCount % PROGRESS_UPDATE_INTERVAL === 0) {
                const progress = 50 + Math.floor((processedCount / Math.max(recordCount, 1)) * 40);
                await updateProgress(jobId, 'processing', progress, 
                  `Processing entity records: ${processedCount.toLocaleString()}`, 
                  processedCount, recordCount);
              }
              
              batch = [];
              
              // Force garbage collection
              if (global.gc) {
                global.gc();
              }
              
              stream.resume();
            } catch (error) {
              console.error('Error processing entity batch:', error.message);
              stream.resume();
            }
          }
        }
      } catch (error) {
        console.error('Error processing entity record:', error.message);
      }
    });
    
    stream.on('end', async () => {
      try {
        if (batch.length > 0) {
          await insertEntityBatch(db, batch);
          processedCount += batch.length;
        }
        console.log(`Completed processing ${recordCount} entity records`);
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
      
      // Check if another download is in progress
      try {
        const result = await dynamodb.scan({
          TableName: PROGRESS_TABLE,
          FilterExpression: '#status = :status',
          ExpressionAttributeNames: {
            '#status': 'status'
          },
          ExpressionAttributeValues: {
            ':status': 'processing'
          }
        }).promise();
        
        if (result.Items && result.Items.length > 0) {
          // Check if any processing job is recent (within last hour)
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
          const recentProcessing = result.Items.find(item => 
            item.updatedAt > oneHourAgo && item.jobId !== jobId
          );
          
          if (recentProcessing) {
            console.log('Another FCC download is already in progress, aborting...');
            await updateProgress(jobId, 'error', 0, 'Another FCC download is already in progress');
            return {
              statusCode: 409,
              body: JSON.stringify({ 
                error: 'Another FCC download is already in progress',
                activeJobId: recentProcessing.jobId
              })
            };
          }
        }
      } catch (checkError) {
        console.error('Error checking for active downloads:', checkError);
        // Continue anyway if we can't check
      }
      
      // Clear existing data with proper transaction handling
      try {
        await db.query('BEGIN');
        await db.query('DELETE FROM fcc_amateur_records');
        await db.query('DELETE FROM fcc_entity_records');
        await db.query('COMMIT');
        console.log('Successfully cleared existing FCC data');
      } catch (deleteError) {
        await db.query('ROLLBACK');
        console.error('Error clearing existing data:', deleteError);
        throw deleteError;
      }
      
      await createFCCTables(db);
      
      // Download FCC database
      await updateProgress(jobId, 'downloading', 10, 'Downloading FCC database...');
      
      const downloadUrl = 'https://data.fcc.gov/download/pub/uls/complete/l_amat.zip';
      const zipPath = '/tmp/fcc_amateur.zip';
      const extractPath = '/tmp/fcc_data';
      const s3KeyPrefix = `fcc-data/${jobId}`;
      
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
      
      // Upload extracted files to S3
      await updateProgress(jobId, 'uploading', 35, 'Uploading extracted files to S3...');
      
      const amateurFile = path.join(extractPath, 'AM.dat');
      const entityFile = path.join(extractPath, 'EN.dat');
      
      if (fs.existsSync(amateurFile)) {
        await uploadToS3(amateurFile, `${s3KeyPrefix}/AM.dat`);
      }
      
      if (fs.existsSync(entityFile)) {
        await uploadToS3(entityFile, `${s3KeyPrefix}/EN.dat`);
      }
      
      // Clean up local files
      fs.unlinkSync(zipPath);
      if (fs.existsSync(extractPath)) {
        fs.rmSync(extractPath, { recursive: true, force: true });
      }
      
      await updateProgress(jobId, 'processing', 40, 'Starting to process records...');
    }
    
    // Process records based on dataType
    const s3KeyPrefix = `fcc-data/${jobId}`;
    const localTempPath = '/tmp/fcc_processing';
    const amateurFile = path.join(localTempPath, 'AM.dat');
    const entityFile = path.join(localTempPath, 'EN.dat');
    
    // Create local temp directory
    if (!fs.existsSync(localTempPath)) {
      fs.mkdirSync(localTempPath, { recursive: true });
    }
    
    let totalProcessedRecords = 0;
    
    // Determine which phase we're in based on resumeData or dataType
    let currentPhase = resumeData?.phase;
    if (!currentPhase) {
      // Initial phase based on dataType
      if (dataType === 'AM') {
        currentPhase = 'amateur';
      } else if (dataType === 'EN') {
        currentPhase = 'entity';
      } else {
        currentPhase = 'amateur'; // ALL starts with amateur
      }
    }
    
    // Check if we need to re-download files for continuation
    if (continuation) {
      await updateProgress(jobId, 'processing', 40, 'Downloading files from S3 for continuation...');
      
      // Download required files from S3
      if ((currentPhase === 'amateur' && (dataType === 'AM' || dataType === 'ALL')) || 
          (currentPhase === 'entity' && dataType === 'ALL')) {
        if (await checkS3FileExists(`${s3KeyPrefix}/AM.dat`)) {
          await downloadFromS3(`${s3KeyPrefix}/AM.dat`, amateurFile);
        }
      }
      
      if ((currentPhase === 'entity' && (dataType === 'EN' || dataType === 'ALL')) ||
          (currentPhase === 'amateur' && dataType === 'ALL')) {
        if (await checkS3FileExists(`${s3KeyPrefix}/EN.dat`)) {
          await downloadFromS3(`${s3KeyPrefix}/EN.dat`, entityFile);
        }
      }
    } else {
      // Initial processing - files should already be in S3, download them
      if ((dataType === 'AM' || dataType === 'ALL') && await checkS3FileExists(`${s3KeyPrefix}/AM.dat`)) {
        await downloadFromS3(`${s3KeyPrefix}/AM.dat`, amateurFile);
      }
      
      if ((dataType === 'EN' || dataType === 'ALL') && await checkS3FileExists(`${s3KeyPrefix}/EN.dat`)) {
        await downloadFromS3(`${s3KeyPrefix}/EN.dat`, entityFile);
      }
    }
    
    if ((currentPhase === 'amateur' && (dataType === 'AM' || dataType === 'ALL')) && fs.existsSync(amateurFile)) {
      console.log('Processing amateur records...');
      const result = await processFileChunked(db, amateurFile, jobId, resumeData);
      
      if (result.continued) {
        // Function will continue in another invocation
        return {
          statusCode: 200,
          body: JSON.stringify({ 
            message: 'Amateur processing continued in another invocation',
            processedRecords: result.processedCount
          })
        };
      }
      
      totalProcessedRecords += result.processedCount;
      
      // Move to entity processing phase if dataType is ALL
      if (dataType === 'ALL' && fs.existsSync(entityFile)) {
        console.log('Starting entity records processing...');
        await updateProgress(jobId, 'processing', 50, 
          `Amateur records completed (${result.processedCount.toLocaleString()}). Starting entity records...`,
          result.processedCount, result.processedCount);
        
        const entityResult = await processEntityFileChunked(db, entityFile, jobId, null);
        
        if (entityResult.continued) {
          return {
            statusCode: 200,
            body: JSON.stringify({ 
              message: 'Entity processing continued in another invocation',
              processedRecords: totalProcessedRecords + entityResult.processedCount
            })
          };
        }
        
        totalProcessedRecords += entityResult.processedCount;
      }
    } else if ((currentPhase === 'entity' && (dataType === 'EN' || dataType === 'ALL')) && fs.existsSync(entityFile)) {
      console.log('Processing entity records...');
      const entityResult = await processEntityFileChunked(db, entityFile, jobId, resumeData);
      
      if (entityResult.continued) {
        return {
          statusCode: 200,
          body: JSON.stringify({ 
            message: 'Entity processing continued in another invocation',
            processedRecords: entityResult.processedCount
          })
        };
      }
      
      totalProcessedRecords += entityResult.processedCount;
    }
    
    // Update last updated timestamp
    try {
      await db.query(`
        INSERT INTO settings (key, value, description)
        VALUES ('fcc_last_updated', $1, 'Last FCC database update timestamp')
        ON CONFLICT (key) DO UPDATE SET 
          value = EXCLUDED.value,
          updated_at = CURRENT_TIMESTAMP
      `, [new Date().toISOString()]);
    } catch (settingsError) {
      console.error('Error updating last updated timestamp:', settingsError);
    }
    
    // Completed processing
    await updateProgress(jobId, 'completed', 100, 
      `FCC database update completed. Processed ${totalProcessedRecords.toLocaleString()} total records.`,
      totalProcessedRecords, totalProcessedRecords);
    
    // Clean up local files
    if (fs.existsSync(localTempPath)) {
      fs.rmSync(localTempPath, { recursive: true, force: true });
    }
    
    // Clean up S3 files
    try {
      await deleteS3File(`${s3KeyPrefix}/AM.dat`);
      await deleteS3File(`${s3KeyPrefix}/EN.dat`);
    } catch (cleanupError) {
      console.error('Error cleaning up S3 files:', cleanupError);
      // Don't fail the entire process for cleanup errors
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