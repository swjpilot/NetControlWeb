const cron = require('node-cron');
const db = require('../database/postgres-js-db');

let backupTask = null;

async function startBackupScheduler() {
  const settings = await db.sql`SELECT key, value FROM settings WHERE key IN ('auto_backup_enabled', 'auto_backup_interval', 'auto_backup_s3_enabled', 'app_timezone', 'backup_time')`;
  const map = {};
  settings.forEach(s => { map[s.key] = s.value; });

  const enabled = map.auto_backup_enabled === 'true' || map.auto_backup_s3_enabled === 'true';
  const timezone = map.app_timezone || 'America/New_York';
  const backupTime = map.backup_time || '02:00';
  const interval = parseInt(map.auto_backup_interval) || 24;

  if (backupTask) { backupTask.stop(); backupTask = null; }
  if (!enabled) { console.log('Backup scheduler: disabled'); return; }

  // If interval is 24h (daily), use the specific backup_time
  // Otherwise use interval-based cron
  let cronExpr;
  if (interval >= 24) {
    const [hour, minute] = backupTime.split(':').map(Number);
    const dayInterval = Math.floor(interval / 24);
    cronExpr = (minute || 0) + ' ' + (hour || 2) + ' */' + dayInterval + ' * *';
  } else {
    cronExpr = '0 */' + interval + ' * * *';
  }

  console.log('Backup scheduler: ' + cronExpr + ' tz=' + timezone + ' (every ' + interval + 'h, time=' + backupTime + ')');

  backupTask = cron.schedule(cronExpr, async () => {
    console.log('Backup scheduler: running...');
    try {
      const { runScheduledS3Backup } = require('../routes/backup');
      await runScheduledS3Backup();
    } catch (error) {
      console.error('Backup scheduler error:', error.message);
    }
  }, { timezone: timezone });
}

module.exports = { startBackupScheduler };
