const cron = require('node-cron');
const db = require('../database/postgres-js-db');

let backupTask = null;

async function startBackupScheduler() {
  // Read interval from settings
  const settings = await db.sql`SELECT key, value FROM settings WHERE key IN ('auto_backup_enabled', 'auto_backup_interval', 'auto_backup_s3_enabled')`;
  const map = {};
  settings.forEach(s => { map[s.key] = s.value; });

  const enabled = map.auto_backup_enabled === 'true' || map.auto_backup_s3_enabled === 'true';
  const hours = parseInt(map.auto_backup_interval) || 24;

  if (backupTask) {
    backupTask.stop();
    backupTask = null;
  }

  if (!enabled) {
    console.log('Backup scheduler: disabled');
    return;
  }

  // Convert hours to cron: run every N hours at minute 0
  const cronExpr = hours >= 24
    ? '0 0 */' + Math.floor(hours / 24) + ' * *'
    : '0 */' + hours + ' * * *';

  console.log('Backup scheduler: running every ' + hours + ' hours (' + cronExpr + ')');

  backupTask = cron.schedule(cronExpr, async () => {
    console.log('Backup scheduler: running scheduled backup...');
    try {
      const { runScheduledS3Backup } = require('../routes/backup');
      await runScheduledS3Backup();
    } catch (error) {
      console.error('Backup scheduler error:', error.message);
    }
  });
}

module.exports = { startBackupScheduler };
