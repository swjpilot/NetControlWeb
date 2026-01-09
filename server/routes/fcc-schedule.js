const express = require('express');
const router = express.Router();
const db = require('../database/postgres-js-db');
const AWS = require('aws-sdk');
const { authenticateToken, requireAdmin } = require('./auth-postgres-js');

// Configure AWS
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1'
});

if (process.env.NODE_ENV === 'development' && process.env.AWS_PROFILE) {
  AWS.config.credentials = new AWS.SharedIniFileCredentials({ profile: process.env.AWS_PROFILE });
}

const eventbridge = new AWS.EventBridge();
const lambda = new AWS.Lambda();

const RULE_NAME = 'netcontrol-fcc-schedule';
const LAMBDA_FUNCTION_ARN = process.env.FCC_LAMBDA_ARN || 'arn:aws:lambda:us-east-1:156667292120:function:netcontrol-fcc-processor';

// Get current FCC schedule settings
router.get('/settings', authenticateToken, requireAdmin, async (req, res) => {
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
router.post('/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { enabled, days_of_week, time_utc, data_type, timezone } = req.body;
    
    // Validate input
    if (enabled && (!days_of_week || !time_utc)) {
      return res.status(400).json({ error: 'Days of week and time are required when enabled' });
    }
    
    // Update settings in database
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
    
    // Update EventBridge rule
    if (enabled === true || enabled === 'true') {
      await createOrUpdateEventBridgeRule(days_of_week, time_utc, data_type);
    } else {
      await disableEventBridgeRule();
    }
    
    res.json({ 
      success: true, 
      message: 'FCC schedule settings updated successfully',
      enabled: enabled === true || enabled === 'true'
    });
    
  } catch (error) {
    console.error('Error updating FCC schedule settings:', error);
    res.status(500).json({ error: 'Failed to update schedule settings' });
  }
});

// Test the schedule (trigger immediate download)
router.post('/test', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { data_type = 'AM' } = req.body;
    const jobId = `fcc_test_${data_type}_${Date.now()}`;
    
    // Invoke Lambda function directly
    const lambdaParams = {
      FunctionName: 'netcontrol-fcc-processor',
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
router.get('/status', authenticateToken, async (req, res) => {
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
        FunctionName: 'netcontrol-fcc-processor',
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
  const nextRun = new Date();
  
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