const express = require('express');
const router = express.Router();
const db = require('../database/postgres-js-db');
const axios = require('axios');
const AWS = require('aws-sdk');
const { authenticateToken, requireAdmin } = require('./auth-postgres-js');

// Configure AWS
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1'
});

// Use IAM role in production, profile in development
if (process.env.NODE_ENV === 'development' && process.env.AWS_PROFILE) {
  AWS.config.credentials = new AWS.SharedIniFileCredentials({ profile: process.env.AWS_PROFILE });
}

const lambda = new AWS.Lambda();
const dynamodb = new AWS.DynamoDB.DocumentClient();
const eventbridge = new AWS.EventBridge();

// Progress tracking
const PROGRESS_TABLE = 'fcc-download-progress';
const LAMBDA_FUNCTION = 'netcontrol-fcc-processor';
const LAMBDA_FUNCTION_ARN = process.env.FCC_LAMBDA_ARN || 'arn:aws:lambda:us-east-1:156667292120:function:netcontrol-fcc-processor';
const RULE_NAME = 'netcontrol-fcc-schedule';

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
      downloadStatus: 'idle', // Always idle since Lambda handles processing
      databaseSize: 0,
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
      downloadStatus: 'idle',
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

// Download FCC database using Lambda
router.post('/download', authenticateToken, async (req, res) => {
  try {
    const { dataType = 'ALL' } = req.body;
    const jobId = `fcc_${dataType}_${Date.now()}`;
    
    // Initialize progress in DynamoDB
    await dynamodb.put({
      TableName: PROGRESS_TABLE,
      Item: {
        jobId,
        status: 'queued',
        progress: 0,
        message: 'Queuing FCC database download...',
        processedRecords: 0,
        totalRecords: 0,
        dataType,
        startTime: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    }).promise();
    
    // Invoke Lambda function asynchronously
    const lambdaParams = {
      FunctionName: LAMBDA_FUNCTION,
      InvocationType: 'Event', // Async invocation
      Payload: JSON.stringify({
        jobId,
        dataType
      })
    };
    
    await lambda.invoke(lambdaParams).promise();
    
    res.json({
      success: true,
      jobId,
      message: 'FCC database download initiated via Lambda',
      dataType,
      estimatedTime: '10-15 minutes'
    });
    
  } catch (error) {
    console.error('FCC Lambda download error:', error);
    res.status(500).json({ 
      error: 'Failed to initiate download',
      details: error.message
    });
  }
});

// Get download progress from DynamoDB
router.get('/download/progress', authenticateToken, async (req, res) => {
  try {
    const { jobId } = req.query;
    
    if (jobId) {
      // Get specific job progress
      const result = await dynamodb.get({
        TableName: PROGRESS_TABLE,
        Key: { jobId }
      }).promise();
      
      if (!result.Item) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      res.json(result.Item);
    } else {
      // Get the most recent job (for backward compatibility)
      const result = await dynamodb.scan({
        TableName: PROGRESS_TABLE,
        ProjectionExpression: 'jobId, #status, progress, message, processedRecords, totalRecords, startTime, updatedAt',
        ExpressionAttributeNames: {
          '#status': 'status'
        }
      }).promise();
      
      if (!result.Items || result.Items.length === 0) {
        return res.json({
          status: 'idle',
          progress: 0,
          message: '',
          processedRecords: 0,
          totalRecords: 0,
          startTime: null,
          endTime: null
        });
      }
      
      // Get the most recent job
      const latestJob = result.Items.sort((a, b) => 
        new Date(b.updatedAt) - new Date(a.updatedAt)
      )[0];
      
      res.json({
        status: latestJob.status,
        progress: latestJob.progress,
        message: latestJob.message,
        processedRecords: latestJob.processedRecords,
        totalRecords: latestJob.totalRecords,
        startTime: latestJob.startTime,
        endTime: latestJob.status === 'completed' || latestJob.status === 'error' ? latestJob.updatedAt : null
      });
    }
    
  } catch (error) {
    console.error('FCC progress error:', error);
    res.json({
      status: 'idle',
      progress: 0,
      message: '',
      processedRecords: 0,
      totalRecords: 0,
      startTime: null,
      endTime: null
    });
  }
});

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

// ===== FCC SCHEDULING ENDPOINTS =====

// Get current FCC schedule settings
router.get('/schedule/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const settings = await db.sql`
      SELECT key, value, description 
      FROM settings 
      WHERE key LIKE 'fcc_schedule_%'
      ORDER BY key
    `;
    
    // Convert to object format
    const scheduleSettings = {};
    settings.forEach(setting => {
      const key = setting.key.replace('fcc_schedule_', '');
      scheduleSettings[key] = setting.value;
    });
    
    // Get EventBridge rule status
    let ruleStatus = 'DISABLED';
    try {
      const rule = await eventbridge.describeRule({ Name: RULE_NAME }).promise();
      ruleStatus = rule.State;
    } catch (error) {
      if (error.code !== 'ResourceNotFoundException') {
        console.error('Error getting EventBridge rule:', error);
      }
    }
    
    res.json({
      settings: scheduleSettings,
      ruleStatus,
      defaultSettings: {
        enabled: 'false',
        days_of_week: '0', // Sunday = 0, Monday = 1, etc.
        time_utc: '06:00', // 6 AM UTC
        data_type: 'ALL',
        timezone: 'UTC'
      }
    });
    
  } catch (error) {
    console.error('Error getting FCC schedule settings:', error);
    res.status(500).json({ error: 'Failed to get schedule settings' });
  }
});

// Update FCC schedule settings
router.post('/schedule/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { enabled, days_of_week, time_utc, data_type, timezone } = req.body;
    
    // Validate input
    if (enabled && (!days_of_week || !time_utc)) {
      return res.status(400).json({ error: 'Days of week and time are required when enabled' });
    }
    
    // Update settings in database first (this should always work)
    const settingsToUpdate = [
      { key: 'fcc_schedule_enabled', value: enabled ? 'true' : 'false', description: 'Enable automatic FCC database updates' },
      { key: 'fcc_schedule_days_of_week', value: days_of_week || '0', description: 'Days of week for FCC updates (0=Sunday, 1=Monday, etc.)' },
      { key: 'fcc_schedule_time_utc', value: time_utc || '06:00', description: 'Time of day for FCC updates (UTC)' },
      { key: 'fcc_schedule_data_type', value: data_type || 'ALL', description: 'Type of FCC data to download (AM, EN, ALL)' },
      { key: 'fcc_schedule_timezone', value: timezone || 'UTC', description: 'Timezone for schedule display' }
    ];
    
    for (const setting of settingsToUpdate) {
      await db.sql`
        INSERT INTO settings (key, value, description)
        VALUES (${setting.key}, ${setting.value}, ${setting.description})
        ON CONFLICT (key) DO UPDATE SET 
          value = EXCLUDED.value,
          updated_at = CURRENT_TIMESTAMP
      `;
    }
    
    // Try to update EventBridge rule (may fail due to permissions)
    let eventBridgeStatus = 'unknown';
    try {
      if (enabled === true || enabled === 'true') {
        await createOrUpdateEventBridgeRule(days_of_week, time_utc, data_type);
        eventBridgeStatus = 'enabled';
      } else {
        await disableEventBridgeRule();
        eventBridgeStatus = 'disabled';
      }
    } catch (eventBridgeError) {
      console.error('EventBridge operation failed:', eventBridgeError);
      eventBridgeStatus = 'error';
      // Don't fail the entire request - settings are still saved
    }
    
    res.json({ 
      success: true, 
      message: 'FCC schedule settings updated successfully',
      enabled: enabled === true || enabled === 'true',
      eventBridgeStatus,
      warning: eventBridgeStatus === 'error' ? 'Settings saved but EventBridge scheduling may not work due to permissions' : null
    });
    
  } catch (error) {
    console.error('Error updating FCC schedule settings:', error);
    res.status(500).json({ 
      error: 'Failed to update schedule settings',
      details: error.message
    });
  }
});

// Test the schedule (trigger immediate download)
router.post('/schedule/test', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { data_type = 'AM' } = req.body;
    const jobId = `fcc_test_${data_type}_${Date.now()}`;
    
    // Invoke Lambda function directly
    const lambdaParams = {
      FunctionName: LAMBDA_FUNCTION,
      InvocationType: 'Event',
      Payload: JSON.stringify({
        jobId,
        dataType: data_type,
        source: 'manual_test'
      })
    };
    
    await lambda.invoke(lambdaParams).promise();
    
    res.json({
      success: true,
      jobId,
      message: 'Test FCC download initiated',
      dataType: data_type
    });
    
  } catch (error) {
    console.error('Error testing FCC schedule:', error);
    res.status(500).json({ error: 'Failed to test schedule' });
  }
});

// Get schedule status and next run time
router.get('/schedule/status', authenticateToken, async (req, res) => {
  try {
    const settings = await db.sql`
      SELECT key, value 
      FROM settings 
      WHERE key IN ('fcc_schedule_enabled', 'fcc_schedule_days_of_week', 'fcc_schedule_time_utc', 'fcc_last_updated')
    `;
    
    const settingsObj = {};
    settings.forEach(s => {
      const key = s.key.replace('fcc_schedule_', '').replace('fcc_', '');
      settingsObj[key] = s.value;
    });
    
    let nextRunTime = null;
    if (settingsObj.enabled === 'true') {
      nextRunTime = calculateNextRunTime(settingsObj.days_of_week, settingsObj.time_utc);
    }
    
    res.json({
      enabled: settingsObj.enabled === 'true',
      lastUpdated: settingsObj.last_updated,
      nextRunTime,
      daysOfWeek: settingsObj.days_of_week,
      timeUtc: settingsObj.time_utc
    });
    
  } catch (error) {
    console.error('Error getting FCC schedule status:', error);
    res.status(500).json({ error: 'Failed to get schedule status' });
  }
});

// Helper function to create or update EventBridge rule
async function createOrUpdateEventBridgeRule(daysOfWeek, timeUtc, dataType) {
  try {
    // Convert days of week and time to cron expression
    const cronExpression = createCronExpression(daysOfWeek, timeUtc);
    
    // Create or update the rule
    await eventbridge.putRule({
      Name: RULE_NAME,
      Description: 'Automated FCC database update schedule',
      ScheduleExpression: cronExpression,
      State: 'ENABLED'
    }).promise();
    
    // Add Lambda function as target
    await eventbridge.putTargets({
      Rule: RULE_NAME,
      Targets: [{
        Id: '1',
        Arn: LAMBDA_FUNCTION_ARN,
        Input: JSON.stringify({
          jobId: `fcc_scheduled_${dataType}_${Date.now()}`,
          dataType: dataType || 'ALL',
          source: 'scheduled'
        })
      }]
    }).promise();
    
    // Add permission for EventBridge to invoke Lambda
    try {
      await lambda.addPermission({
        FunctionName: LAMBDA_FUNCTION,
        StatementId: 'allow-eventbridge-invoke',
        Action: 'lambda:InvokeFunction',
        Principal: 'events.amazonaws.com',
        SourceArn: `arn:aws:events:${process.env.AWS_REGION || 'us-east-1'}:${process.env.AWS_ACCOUNT_ID || '156667292120'}:rule/${RULE_NAME}`
      }).promise();
    } catch (error) {
      // Permission might already exist
      if (error.code !== 'ResourceConflictException') {
        console.error('Error adding Lambda permission:', error);
      }
    }
    
    console.log(`EventBridge rule created/updated: ${cronExpression}`);
    
  } catch (error) {
    console.error('Error creating EventBridge rule:', error);
    throw error;
  }
}

// Helper function to disable EventBridge rule
async function disableEventBridgeRule() {
  try {
    await eventbridge.putRule({
      Name: RULE_NAME,
      State: 'DISABLED'
    }).promise();
    
    console.log('EventBridge rule disabled');
    
  } catch (error) {
    if (error.code !== 'ResourceNotFoundException') {
      console.error('Error disabling EventBridge rule:', error);
      throw error;
    }
  }
}

// Helper function to create cron expression
function createCronExpression(daysOfWeek, timeUtc) {
  // Parse time (HH:MM format)
  const [hours, minutes] = timeUtc.split(':').map(Number);
  
  // Parse days of week (comma-separated: 0=Sunday, 1=Monday, etc.)
  const days = daysOfWeek.split(',').map(d => d.trim());
  
  // Convert to AWS cron format: minute hour day-of-month month day-of-week year
  // AWS uses 1=Sunday, 2=Monday, etc. for day-of-week
  const awsDays = days.map(day => {
    const dayNum = parseInt(day);
    return dayNum === 0 ? 1 : dayNum + 1; // Convert 0=Sunday to 1=Sunday
  }).join(',');
  
  return `cron(${minutes} ${hours} ? * ${awsDays} *)`;
}

// Helper function to calculate next run time
function calculateNextRunTime(daysOfWeek, timeUtc) {
  if (!daysOfWeek || !timeUtc) return null;
  
  const [hours, minutes] = timeUtc.split(':').map(Number);
  const days = daysOfWeek.split(',').map(d => parseInt(d.trim()));
  
  const now = new Date();
  
  // Find the next occurrence
  for (let i = 0; i < 7; i++) {
    const checkDate = new Date(now.getTime() + (i * 24 * 60 * 60 * 1000));
    const dayOfWeek = checkDate.getUTCDay();
    
    if (days.includes(dayOfWeek)) {
      checkDate.setUTCHours(hours, minutes, 0, 0);
      
      if (checkDate > now) {
        return checkDate.toISOString();
      }
    }
  }
  
  return null;
}

module.exports = router;