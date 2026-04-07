const express = require('express');
const router = express.Router();
const db = require('../database/postgres-js-db');
const { authenticateToken, requireAdmin } = require('./auth-postgres-js');
const AWS = require('aws-sdk');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

const BACKUP_TABLES = [
  'users', 'settings', 'operators',
  'sessions', 'session_participants', 'session_traffic',
  'net_schedules', 'net_schedule_assignments', 'net_schedule_exceptions'
];

async function getS3Config() {
  const settings = await db.sql`SELECT key, value FROM settings WHERE key IN ('backup_s3_bucket', 'backup_s3_prefix')`;
  const map = {};
  settings.forEach(s => { map[s.key] = s.value; });
  if (!map.backup_s3_bucket) throw new Error('S3 bucket not configured in settings');
  return {
    bucket: map.backup_s3_bucket,
    prefix: (map.backup_s3_prefix || 'netcontrol-backups/').replace(/\/$/, '') + '/',
    s3: new AWS.S3({ region: process.env.AWS_REGION || 'us-east-1' })
  };
}

async function createBackupData() {
  const backup = { version: '1.0', created_at: new Date().toISOString(), tables: {}, row_counts: {} };
  for (const table of BACKUP_TABLES) {
    try {
      const rows = await db.sql.unsafe('SELECT * FROM ' + table + ' ORDER BY id');
      backup.tables[table] = rows;
    } catch (e) {
      backup.tables[table] = [];
    }
    backup.row_counts[table] = backup.tables[table].length;
  }
  return backup;
}

async function restoreFromBackup(backup) {
  if (!backup.tables) throw new Error('Invalid backup format');
  const results = {};
  const reverseTables = [...BACKUP_TABLES].reverse();
  for (const table of reverseTables) {
    try { await db.sql.unsafe('DELETE FROM ' + table); } catch (e) { /* ok */ }
  }
  for (const table of BACKUP_TABLES) {
    const rows = backup.tables[table];
    if (!rows || rows.length === 0) { results[table] = { restored: 0 }; continue; }
    let restored = 0;
    for (const row of rows) {
      try {
        const columns = Object.keys(row);
        const values = columns.map(c => row[c]);
        const colNames = columns.map(c => '"' + c + '"').join(', ');
        const placeholders = columns.map((_, i) => '$' + (i + 1)).join(', ');
        await db.sql.unsafe(
          'INSERT INTO ' + table + ' (' + colNames + ') VALUES (' + placeholders + ') ON CONFLICT DO NOTHING',
          values
        );
        restored++;
      } catch (e) { /* skip row */ }
    }
    try {
      await db.sql.unsafe("SELECT setval(pg_get_serial_sequence('" + table + "', 'id'), COALESCE((SELECT MAX(id) FROM " + table + "), 1))");
    } catch (e) { /* no serial */ }
    results[table] = { restored, total: rows.length };
  }
  return results;
}

// Download backup as JSON file
router.get('/export', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const backup = await createBackupData();
    const dateStr = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="netcontrol-backup-' + dateStr + '.json"');
    res.json(backup);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Restore from uploaded JSON file
router.post('/restore', authenticateToken, requireAdmin, upload.single('backup'), async (req, res) => {
  try {
    let backup;
    if (req.file) {
      backup = JSON.parse(req.file.buffer.toString('utf-8'));
    } else if (req.body.backup) {
      backup = typeof req.body.backup === 'string' ? JSON.parse(req.body.backup) : req.body.backup;
    } else {
      return res.status(400).json({ error: 'No backup file provided' });
    }
    const results = await restoreFromBackup(backup);
    res.json({ success: true, message: 'Database restored', results });
  } catch (error) {
    console.error('Restore error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload backup to S3
router.post('/s3/upload', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { bucket, prefix, s3 } = await getS3Config();
    const backup = await createBackupData();
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const key = prefix + 'netcontrol-backup-' + dateStr + '.json';
    await s3.putObject({
      Bucket: bucket, Key: key,
      Body: JSON.stringify(backup, null, 2),
      ContentType: 'application/json'
    }).promise();
    res.json({ success: true, key, bucket, row_counts: backup.row_counts });
  } catch (error) {
    console.error('S3 upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// List backups in S3
router.get('/s3/list', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { bucket, prefix, s3 } = await getS3Config();
    const result = await s3.listObjectsV2({ Bucket: bucket, Prefix: prefix }).promise();
    const backups = (result.Contents || [])
      .filter(obj => obj.Key.endsWith('.json'))
      .sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified))
      .map(obj => ({
        key: obj.Key,
        name: obj.Key.replace(prefix, ''),
        size: obj.Size,
        lastModified: obj.LastModified
      }));
    res.json({ backups, bucket });
  } catch (error) {
    console.error('S3 list error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Restore from S3 backup
router.post('/s3/restore', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { key } = req.body;
    if (!key) return res.status(400).json({ error: 'Backup key is required' });
    const { bucket, s3 } = await getS3Config();
    const obj = await s3.getObject({ Bucket: bucket, Key: key }).promise();
    const backup = JSON.parse(obj.Body.toString('utf-8'));
    const results = await restoreFromBackup(backup);
    res.json({ success: true, message: 'Database restored from S3', key, results });
  } catch (error) {
    console.error('S3 restore error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete S3 backup
router.delete('/s3/:key', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    const { bucket, s3 } = await getS3Config();
    await s3.deleteObject({ Bucket: bucket, Key: key }).promise();
    res.json({ success: true, message: 'Backup deleted' });
  } catch (error) {
    console.error('S3 delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Scheduled S3 backup with retention pruning
async function runScheduledS3Backup() {
  try {
    const settings = await db.sql`SELECT key, value FROM settings WHERE key IN ('auto_backup_s3_enabled', 'backup_s3_bucket', 'backup_s3_prefix', 'backup_retention_count')`;
    const map = {};
    settings.forEach(s => { map[s.key] = s.value; });

    if (map.auto_backup_s3_enabled !== 'true' || !map.backup_s3_bucket) {
      console.log('Scheduled S3 backup: skipped (enabled=' + map.auto_backup_s3_enabled + ', bucket=' + (map.backup_s3_bucket || 'none') + ')');
      return false;
    }

    const s3 = new AWS.S3({ region: process.env.AWS_REGION || 'us-east-1' });
    const bucket = map.backup_s3_bucket;
    const prefix = (map.backup_s3_prefix || 'netcontrol-backups/').replace(/\/$/, '') + '/';
    const retention = parseInt(map.backup_retention_count) || 10;

    // Create backup
    const backup = await createBackupData();
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const key = prefix + 'netcontrol-backup-' + dateStr + '.json';

    await s3.putObject({
      Bucket: bucket, Key: key,
      Body: JSON.stringify(backup, null, 2),
      ContentType: 'application/json'
    }).promise();

    console.log('Scheduled S3 backup created:', key);

    // Prune old backups
    const list = await s3.listObjectsV2({ Bucket: bucket, Prefix: prefix }).promise();
    const jsonFiles = (list.Contents || [])
      .filter(obj => obj.Key.endsWith('.json'))
      .sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified));

    if (jsonFiles.length > retention) {
      const toDelete = jsonFiles.slice(retention);
      for (const obj of toDelete) {
        await s3.deleteObject({ Bucket: bucket, Key: obj.Key }).promise();
        console.log('Pruned old backup:', obj.Key);
      }
    }
    return true;
  } catch (error) {
    console.error('Scheduled S3 backup error:', error.message);
    return false;
  }
}

module.exports = router;
module.exports.runScheduledS3Backup = runScheduledS3Backup;
