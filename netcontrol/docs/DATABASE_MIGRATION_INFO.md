# Database Migration Information

## What Happens During Update

When you run the `update-production.sh` script with the new deployment package, the following database changes will be automatically applied:

### ✅ Automatic Migration Process

1. **Database Preservation**: Your existing database is backed up and preserved during the update
2. **Migration System**: A new migration system is introduced that tracks database schema changes
3. **New Setting Added**: The `smtp_no_auth` setting is automatically added to support email servers without authentication

### 🔄 Migration Details

**Migration Version**: 1.0.0  
**Description**: Add smtp_no_auth setting support  
**Changes**:
- Adds `smtp_no_auth` setting to the settings table with default value `false`
- Creates a `migrations` table to track future database changes
- Preserves all existing email settings and data

### 📋 What Gets Migrated

| Setting | Before Update | After Update |
|---------|---------------|--------------|
| `smtp_host` | ✅ Preserved | ✅ Preserved |
| `smtp_port` | ✅ Preserved | ✅ Preserved |
| `smtp_secure` | ✅ Preserved | ✅ Preserved |
| `smtp_username` | ✅ Preserved | ✅ Preserved |
| `smtp_password` | ✅ Preserved | ✅ Preserved |
| `smtp_from_email` | ✅ Preserved | ✅ Preserved |
| `smtp_from_name` | ✅ Preserved | ✅ Preserved |
| `smtp_no_auth` | ❌ Not present | ✅ Added (default: false) |

### 🛡️ Safety Features

- **Non-destructive**: No existing data is modified or deleted
- **Backward Compatible**: Existing email configurations continue to work unchanged
- **Default Values**: New settings get safe default values
- **Migration Tracking**: All migrations are logged with timestamps
- **Rollback Safe**: Can rollback to previous version if needed

### 🔍 Verification

After the update, you can verify the migration was successful:

```bash
# Check if the new setting exists
sqlite3 server/data/netcontrol.db "SELECT * FROM settings WHERE key = 'smtp_no_auth';"

# Check migration history
sqlite3 server/data/netcontrol.db "SELECT * FROM migrations;"
```

Expected output:
```
smtp_no_auth|false
1.0.0|Add smtp_no_auth setting support|2026-01-06 14:30:00
```

### 🎯 User Impact

**For Existing Users**:
- No action required
- Email settings remain unchanged
- New "No authentication required" option appears in settings
- Existing authenticated email servers continue working

**For New Configurations**:
- Can now configure email servers that don't require authentication
- Useful for internal mail relays, local SMTP servers, or development environments

### 🚨 Troubleshooting

If migration fails:
1. **Check logs**: Look for migration errors in the application logs
2. **Manual verification**: Use the verification commands above
3. **Rollback**: Use `./rollback-production.sh` to restore previous version
4. **Manual fix**: If needed, manually add the setting:
   ```sql
   INSERT INTO settings (key, value) VALUES ('smtp_no_auth', 'false');
   ```

### 📞 Support

The migration is designed to be automatic and safe. If you encounter any issues:
1. Check the application logs for migration messages
2. Verify your database backup was created
3. Use the rollback script if needed
4. Contact support with specific error messages

## Summary

✅ **Safe**: Your data is preserved and backed up  
✅ **Automatic**: No manual intervention required  
✅ **Backward Compatible**: Existing configurations work unchanged  
✅ **Rollback Ready**: Can revert if needed  
✅ **Logged**: All changes are tracked and timestamped