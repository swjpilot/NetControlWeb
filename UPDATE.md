# NetControl Update Guide

## 🔄 Updating Existing Installations

This guide explains how to update an existing NetControl installation while preserving all your data (database, users, sessions, operators, etc.).

## ⚠️ Important Notes

- **Always backup before updating** - The update script creates automatic backups, but manual backups are recommended for critical data
- **Test updates in staging first** - If possible, test the update process in a non-production environment
- **Plan for downtime** - The application will be briefly unavailable during the update process (typically 1-2 minutes)

## 🚀 Quick Update Process

### Step 1: Upload New Package
```bash
# Upload the new deployment package to your server
scp netcontrol-YYYYMMDD_HHMMSS.tar.gz user@server:/opt/netcontrol/
```

### Step 2: Run Update Script
```bash
# SSH to your server
ssh user@server
cd /opt/netcontrol

# Run the update (interactive)
./update-production.sh netcontrol-YYYYMMDD_HHMMSS.tar.gz

# Or run silently (for automation)
./update-production.sh --force netcontrol-YYYYMMDD_HHMMSS.tar.gz
```

### Step 3: Verify Update
```bash
# Check application status
./status-production.sh

# Test the application
curl http://localhost:5000/api/health
```

## 🔧 What the Update Script Does

1. **Pre-Update Checks**
   - Verifies you're in a NetControl installation directory
   - Checks current application status
   - Validates the update package

2. **Backup Creation**
   - Stops the current application safely
   - Creates full backup of current installation
   - Creates separate database backup
   - Preserves logs and uploaded files

3. **Data Preservation**
   - Temporarily saves database file
   - Preserves user uploads
   - Saves application logs
   - Keeps custom configuration files

4. **Installation**
   - Removes old application files
   - Extracts new package
   - Installs dependencies
   - Sets proper permissions

5. **Data Restoration**
   - Restores preserved database
   - Restores user uploads
   - Restores application logs
   - Restores custom configurations

6. **Startup**
   - Starts the updated application
   - Verifies successful startup
   - Provides status information

## 📋 Update Script Options

```bash
./update-production.sh [OPTIONS] <package-file>

Options:
  -h, --help               Show help message
  -b, --backup-dir DIR     Custom backup directory (default: backups)
  -f, --force              Skip confirmation prompts (for automation)

Examples:
  ./update-production.sh netcontrol-latest.tar.gz
  ./update-production.sh --backup-dir /opt/backups netcontrol-latest.tar.gz
  ./update-production.sh --force netcontrol-latest.tar.gz
```

## 🔄 Rollback Process

If an update causes issues, you can quickly rollback:

### List Available Backups
```bash
./rollback-production.sh --list
```

### Rollback to Latest Backup
```bash
./rollback-production.sh
```

### Rollback to Specific Backup
```bash
./rollback-production.sh netcontrol-backup-20260106_102744
```

### Rollback Options
```bash
./rollback-production.sh [OPTIONS] [backup-name]

Options:
  -h, --help               Show help message
  -b, --backup-dir DIR     Custom backup directory (default: backups)
  -f, --force              Skip confirmation prompts
  -l, --list               List available backups

Examples:
  ./rollback-production.sh --list
  ./rollback-production.sh netcontrol-backup-20260106_102744
  ./rollback-production.sh --force
```

## 📁 Backup Structure

Backups are stored in the `backups/` directory:

```
backups/
├── netcontrol-backup-20260106_102744/     # Full installation backup
├── netcontrol-backup-20260106_103015/     # Another full backup
├── netcontrol-db-20260106_102744.db       # Database-only backup
├── netcontrol-db-20260106_103015.db       # Another database backup
└── emergency-backup-20260106_103100/      # Emergency rollback backup
```

## 🛡️ Data Preservation

The update process preserves:

- **Database**: All users, sessions, operators, settings
- **Uploads**: Audio files, documents, attachments
- **Logs**: Application logs, error logs, access logs
- **Configuration**: Custom environment files, SSL certificates
- **Backups**: Previous backup files

## 🔍 Verification Steps

After updating, verify these components:

### 1. Application Status
```bash
./status-production.sh
```

### 2. Database Integrity
```bash
# Check if database exists and is accessible
ls -la server/data/netcontrol.db

# Test database connection (application should start without errors)
./start-production.sh
```

### 3. User Access
- Login with existing user accounts
- Verify user data is intact
- Test admin functions

### 4. Data Integrity
- Check that operators are still present
- Verify session data is intact
- Confirm settings are preserved

### 5. Functionality
- Test QRZ lookup
- Verify report generation
- Check pre-check-in functionality

## 🚨 Troubleshooting

### Update Fails
```bash
# Check the backup was created
ls -la backups/

# Rollback to previous version
./rollback-production.sh

# Check logs for errors
tail -f logs/combined.log
```

### Application Won't Start
```bash
# Check for permission issues
chmod +x *.sh
chmod 755 server/data
chmod 644 server/data/netcontrol.db

# Check for missing dependencies
npm install --production

# Start manually for debugging
NODE_ENV=production node server/index.js
```

### Database Issues
```bash
# Verify database file exists
ls -la server/data/netcontrol.db

# Restore from backup if needed
cp backups/netcontrol-db-YYYYMMDD_HHMMSS.db server/data/netcontrol.db

# Check database permissions
chmod 644 server/data/netcontrol.db
```

### Port Conflicts
```bash
# Check what's using port 5000
lsof -i:5000

# Stop conflicting processes
./stop-production.sh

# Or kill specific processes
pkill -f "node.*server/index.js"
```

## 🔄 Automated Updates

For automated updates (CI/CD, cron jobs):

```bash
#!/bin/bash
# Automated update script

PACKAGE_URL="https://your-server.com/releases/netcontrol-latest.tar.gz"
INSTALL_DIR="/opt/netcontrol"

cd $INSTALL_DIR

# Download latest package
wget -O netcontrol-latest.tar.gz $PACKAGE_URL

# Update with force flag (no prompts)
./update-production.sh --force netcontrol-latest.tar.gz

# Verify update
if ./status-production.sh | grep -q "RUNNING"; then
    echo "Update successful"
    # Send success notification
else
    echo "Update failed, rolling back"
    ./rollback-production.sh --force
    # Send failure notification
fi
```

## 📞 Support

If you encounter issues during updates:

1. **Check the logs**: `tail -f logs/combined.log`
2. **Verify backups exist**: `ls -la backups/`
3. **Try rollback**: `./rollback-production.sh`
4. **Check permissions**: Ensure proper file permissions
5. **Manual recovery**: Use backup files to manually restore

## 🎯 Best Practices

1. **Regular Backups**: Create manual backups before major updates
2. **Test Environment**: Test updates in staging before production
3. **Maintenance Windows**: Schedule updates during low-usage periods
4. **Monitor**: Watch application logs during and after updates
5. **Document**: Keep track of update history and any custom changes
6. **Verify**: Always verify functionality after updates
7. **Rollback Plan**: Have a rollback plan ready before updating