# Example: Updating NetControl Without Losing Data

## Scenario
You have NetControl running in production at `/opt/netcontrol` with:
- 50 operators in the database
- 10 net sessions with participant data
- Custom user accounts and settings
- Uploaded audio files

You want to update to the latest version without losing any of this data.

## Step-by-Step Process

### 1. Upload New Package
```bash
# From your local machine
scp netcontrol-20260106_103109.tar.gz user@server:/opt/netcontrol/
```

### 2. Connect to Server
```bash
ssh user@server
cd /opt/netcontrol
```

### 3. Check Current Status
```bash
./status-production.sh
```
Output shows NetControl is running with your data intact.

### 4. Run Update
```bash
./update-production.sh netcontrol-20260106_103109.tar.gz
```

### 5. Update Process (Automatic)
```
🔄 NetControl Production Update
===============================
📦 Package: netcontrol-20260106_103109.tar.gz
📁 Backup Directory: backups
🕐 Timestamp: 20260106_103109

🔍 Checking application status...
✅ NetControl is currently running

⚠️  This will update your NetControl installation:
   - Current application will be stopped
   - Full backup will be created
   - New version will be installed
   - Database and user data will be preserved

Do you want to continue? (y/N): y

🚀 Starting update process...

1️⃣  Stopping NetControl application...
✅ NetControl has been stopped successfully!

2️⃣  Creating backup...
📦 Backing up current installation to: backups/netcontrol-backup-20260106_103109
✅ Database backed up to: backups/netcontrol-db-20260106_103109.db
✅ Backup completed

3️⃣  Preserving user data...
✅ Database preserved
✅ Uploads preserved
✅ Logs preserved

4️⃣  Installing new version...
🗑️  Removing old installation files...
📦 Extracting new package...

5️⃣  Restoring user data...
✅ Database restored
✅ Uploads restored
✅ Logs restored

6️⃣  Setting permissions...

7️⃣  Installing dependencies...
🔧 Installing Node.js dependencies...

8️⃣  Starting updated application...
✅ Application started successfully

9️⃣  Cleaning up...

✅ Update completed successfully!

📋 Summary:
   - Backup created: backups/netcontrol-backup-20260106_103109
   - Database backup: backups/netcontrol-db-20260106_103109.db
   - User data preserved and restored
   - Application updated to new version
   - Application restarted
```

### 6. Verify Update
```bash
# Check status
./status-production.sh

# Test application
curl http://localhost:5000/api/health

# Login and verify your data is still there
# - All 50 operators should be present
# - All 10 sessions with participants intact
# - User accounts and settings preserved
# - Uploaded files still available
```

## What Happened Behind the Scenes

1. **Backup Created**: Full backup saved to `backups/netcontrol-backup-20260106_103109/`
2. **Database Preserved**: Your SQLite database with all data was safely stored
3. **Files Preserved**: Uploads, logs, and custom configs were saved
4. **Clean Install**: New application code was installed
5. **Data Restored**: Your preserved data was put back in place
6. **Seamless Transition**: Application restarted with all your data intact

## If Something Goes Wrong

### Rollback to Previous Version
```bash
# List available backups
./rollback-production.sh --list

# Rollback to the backup created during update
./rollback-production.sh netcontrol-backup-20260106_103109
```

### Manual Recovery
```bash
# Stop application
./stop-production.sh

# Restore database manually
cp backups/netcontrol-db-20260106_103109.db server/data/netcontrol.db

# Start application
./start-production.sh
```

## Result

✅ **NetControl updated successfully**  
✅ **All 50 operators preserved**  
✅ **All 10 sessions with participants intact**  
✅ **User accounts and settings maintained**  
✅ **Uploaded files still available**  
✅ **New features and fixes available**  
✅ **Zero data loss**  

Your production NetControl installation is now running the latest version with all your valuable data preserved!