const cron = require('node-cron');
const db = require('../database/postgres-js-db');

let backupTask = null;

async function runBackupIfNeeded() {
  try {
    const settings = await db.sql`SELECT key, value FROM settings WHERE key IN ('auto_backup_s3_enabled', 'auto_backup_enabled', 'auto_backup_interval', 'backup_s3_bucket', 'backup_s3_prefix')`;
    const map = {};
    settings.forEach(s => { map[s.key] = s.value; });

    const enabled = map.auto_backup_enabled === 'true' || map.auto_backup_s3_enabled === 'true';
    if (!enabled || !map.backup_s3_bucket) return;

    const interval = parseInt(map.auto_backup_interval) || 24;

    // Check actual S3 files for last backup time (not settings — those can be stale)
    const AWS = require('aws-sdk');
    const s3 = new AWS.S3({ region: process.env.AWS_REGION || 'us-east-1' });
    const prefix = (map.backup_s3_prefix || 'netcontrol-backups/').replace(/\/$/, '') + '/';
    const list = await s3.listObjectsV2({ Bucket: map.backup_s3_bucket, Prefix: prefix }).promise();
    const jsonFiles = (list.Contents || []).filter(o => o.Key.endsWith('.json')).sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified));

    const lastBackup = jsonFiles.length > 0 ? new Date(jsonFiles[0].LastModified) : null;
    const hoursSince = lastBackup ? (Date.now() - lastBackup.getTime()) / (1000 * 60 * 60) : 999;

    if (hoursSince >= interval) {
      console.log('Backup: overdue (' + Math.round(hoursSince) + 'h since last S3 file), running catch-up...');
      const { runScheduledS3Backup } = require('../routes/backup');
      const success = await runScheduledS3Backup();
      if (success) {
        await db.sql`INSERT INTO settings (key, value, description) VALUES ('last_backup_time', ${new Date().toISOString()}, 'Last automated backup timestamp') ON CONFLICT (key) DO UPDATE SET value = ${new Date().toISOString()}`;
        console.log('Backup: catch-up complete');
      } else {
        console.log('Backup: catch-up skipped or failed');
      }
    } else {
      console.log('Backup: last S3 file was ' + Math.round(hoursSince) + 'h ago, on schedule');
    }
  } catch (e) {
    console.error('Backup catch-up error:', e.message);
  }
}

async function startBackupScheduler() {
  const settings = await db.sql`SELECT key, value FROM settings WHERE key IN ('auto_backup_enabled', 'auto_backup_interval', 'auto_backup_s3_enabled', 'app_timezone', 'backup_time', 'backup_s3_bucket')`;
  const map = {};
  settings.forEach(s => { map[s.key] = s.value; });

  const enabled = map.auto_backup_enabled === 'true' || map.auto_backup_s3_enabled === 'true';
  const timezone = map.app_timezone || 'America/New_York';
  const backupTime = map.backup_time || '02:00';
  const interval = parseInt(map.auto_backup_interval) || 24;

  if (backupTask) { backupTask.stop(); backupTask = null; }
  if (!enabled) { console.log('Backup scheduler: disabled'); return; }
  if (!map.backup_s3_bucket) { console.log('Backup scheduler: no S3 bucket'); return; }

  // Check for overdue backup on startup
  await runBackupIfNeeded();

  let cronExpr;
  if (interval >= 24) {
    const [hour, minute] = backupTime.split(':').map(Number);
    cronExpr = (minute || 0) + ' ' + (hour || 2) + ' * * *';
  } else {
    cronExpr = '0 */' + interval + ' * * *';
  }

  console.log('Backup scheduler: ' + cronExpr + ' tz=' + timezone);

  backupTask = cron.schedule(cronExpr, async () => {
    console.log('Backup scheduler: running...');
    try {
      const { runScheduledS3Backup } = require('../routes/backup');
      const success = await runScheduledS3Backup();
      if (success) {
        await db.sql`INSERT INTO settings (key, value, description) VALUES ('last_backup_time', ${new Date().toISOString()}, 'Last automated backup timestamp') ON CONFLICT (key) DO UPDATE SET value = ${new Date().toISOString()}`;
        console.log('Backup scheduler: complete');
      }
    } catch (error) {
      console.error('Backup scheduler error:', error.message);
    }
  }, { timezone: timezone });
}

module.exports = { startBackupScheduler };
