# NetControl Troubleshooting Guide

## Quick Diagnosis

**Run this first on your server:**
```bash
chmod +x troubleshoot-installation.sh
./troubleshoot-installation.sh
```

This will give you a comprehensive system report. Share the output if you need further help.

## Common Issues & Solutions

### 🚨 Application Won't Start

#### Symptoms
- `./start-production.sh` fails
- No response on port 5000
- Process exits immediately

#### Diagnosis Commands
```bash
# Check if NetControl is running
./status-production.sh

# Check for Node.js processes
ps aux | grep node

# Check port 5000
netstat -tlnp | grep :5000

# Check logs
tail -f logs/combined.log
# or
tail -f logs/app.log
```

#### Common Causes & Fixes

**1. Node.js Not Installed**
```bash
# Check Node.js version
node --version

# If not installed or < v16:
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**2. Dependencies Missing**
```bash
# Install dependencies
npm install --production

# If npm fails, try:
rm -rf node_modules package-lock.json
npm install --production
```

**3. Database Issues**
```bash
# Check database file
ls -la server/data/netcontrol.db

# If missing, it will be created on startup
# Check database permissions
chmod 644 server/data/netcontrol.db
chmod 755 server/data
```

**4. Port Already in Use**
```bash
# Find what's using port 5000
lsof -i:5000

# Kill the process (replace PID)
kill -9 <PID>

# Or use a different port
export PORT=5001
./start-production.sh
```

**5. Permission Issues**
```bash
# Fix script permissions
chmod +x *.sh

# Fix data directory permissions
chmod 755 server/data
chmod 644 server/data/netcontrol.db
```

### 🌐 Can't Access Web Interface

#### Symptoms
- Server starts but can't access via browser
- Connection refused or timeout

#### Diagnosis Commands
```bash
# Check if app is responding locally
curl http://localhost:5000/api/health

# Check firewall
sudo ufw status
# or
sudo firewall-cmd --list-all

# Check nginx (if used)
sudo systemctl status nginx
sudo nginx -t
```

#### Solutions

**1. Firewall Blocking**
```bash
# Allow port 5000
sudo ufw allow 5000

# Or if using nginx
sudo ufw allow 80
sudo ufw allow 443
```

**2. Nginx Configuration**
```bash
# Check nginx config
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx

# Check nginx logs
sudo tail -f /var/log/nginx/error.log
```

**3. Application Binding**
```bash
# Check what interface the app is binding to
netstat -tlnp | grep :5000

# Should show 0.0.0.0:5000, not 127.0.0.1:5000
```

### 📧 Email Not Working

#### Symptoms
- SMTP test fails
- No emails being sent
- Email errors in logs

#### Diagnosis Commands
```bash
# Test SMTP connection
telnet your-smtp-server.com 587

# Check email settings in database
sqlite3 server/data/netcontrol.db "SELECT key, value FROM settings WHERE key LIKE 'smtp_%';"

# Check logs for email errors
grep -i "email\|smtp" logs/combined.log
```

#### Solutions

**1. SMTP Configuration**
- Verify SMTP host, port, username, password
- Check if "No authentication required" should be enabled
- Test with a known working email service first

**2. Firewall/Network Issues**
```bash
# Test SMTP port connectivity
telnet smtp.gmail.com 587
# or
nc -zv smtp.gmail.com 587
```

**3. Authentication Issues**
- For Gmail: Use App Passwords, not regular password
- For Office365: Check modern authentication settings
- For internal servers: Enable "No authentication required"

### 🔄 Update Script Issues

#### Symptoms
- Update fails partway through
- Data loss during update
- Application won't start after update

#### Safe Update Process
```bash
# 1. Create manual backup first
cp -r /opt/netcontrol /opt/netcontrol-backup-$(date +%Y%m%d)

# 2. Stop application
./stop-production.sh

# 3. Run update with force flag for automation
./update-production.sh --force netcontrol-package.tar.gz

# 4. If update fails, rollback
./rollback-production.sh
```

#### Common Update Issues

**1. Insufficient Disk Space**
```bash
# Check disk space
df -h

# Clean up old backups if needed
ls -la backups/
rm -rf backups/netcontrol-backup-old-date
```

**2. Permission Issues**
```bash
# Fix permissions after update
chmod +x *.sh
chmod 755 server/data
chmod 644 server/data/netcontrol.db
```

**3. Database Migration Issues**
```bash
# Check migration status
grep "migration" logs/combined.log

# Manual migration check
node -e "
const db = require('./server/database/db');
db.init();
setTimeout(async () => {
  const migrations = await db.all('SELECT * FROM migrations');
  console.log('Migrations:', migrations);
  process.exit(0);
}, 1000);
"
```

### 🗄️ Database Issues

#### Symptoms
- Database corruption errors
- Login fails
- Data missing after update

#### Diagnosis Commands
```bash
# Check database file
ls -la server/data/netcontrol.db

# Check database integrity
sqlite3 server/data/netcontrol.db "PRAGMA integrity_check;"

# Check tables
sqlite3 server/data/netcontrol.db ".tables"

# Check users
sqlite3 server/data/netcontrol.db "SELECT username, role FROM users;"
```

#### Solutions

**1. Database Corruption**
```bash
# Backup current database
cp server/data/netcontrol.db server/data/netcontrol.db.backup

# Try to repair
sqlite3 server/data/netcontrol.db ".recover" | sqlite3 server/data/netcontrol_recovered.db

# If repair works, replace
mv server/data/netcontrol.db server/data/netcontrol.db.corrupt
mv server/data/netcontrol_recovered.db server/data/netcontrol.db
```

**2. Missing Admin User**
```bash
# Create admin user manually
node -e "
const bcrypt = require('bcrypt');
const db = require('./server/database/db');
db.init();
setTimeout(async () => {
  const hash = await bcrypt.hash('admin123', 12);
  await db.run('INSERT OR REPLACE INTO users (username, password_hash, email, role, name, call_sign) VALUES (?, ?, ?, ?, ?, ?)', 
    ['admin', hash, 'admin@netcontrol.local', 'admin', 'System Administrator', 'W1AW']);
  console.log('Admin user created');
  process.exit(0);
}, 1000);
"
```

### 🔧 PM2 Issues

#### Symptoms
- PM2 processes stuck
- Application doesn't restart
- Multiple processes running

#### Solutions

**1. Clean PM2 State**
```bash
# Stop all NetControl processes
pm2 stop all
pm2 delete all

# Start fresh
pm2 start ecosystem.config.js

# Save PM2 state
pm2 save
```

**2. PM2 Startup Issues**
```bash
# Reset PM2 startup
pm2 unstartup
pm2 startup
pm2 save
```

## Getting Help

### Information to Collect

When asking for help, please provide:

1. **System Information**
   ```bash
   ./troubleshoot-installation.sh > troubleshoot-output.txt
   ```

2. **Recent Logs**
   ```bash
   tail -50 logs/combined.log > recent-logs.txt
   ```

3. **Error Messages**
   - Exact error messages from terminal
   - Browser console errors (F12)
   - Any error dialogs

4. **What You Were Doing**
   - Steps that led to the issue
   - What you expected to happen
   - What actually happened

### Quick Health Check

```bash
# Run these commands and share output:
./status-production.sh
curl http://localhost:5000/api/health
curl http://localhost:5000/api/version
ps aux | grep node
netstat -tlnp | grep :5000
```

### Emergency Recovery

If everything is broken:

```bash
# 1. Stop everything
./stop-production.sh
pm2 stop all
pm2 delete all

# 2. Restore from backup
./rollback-production.sh

# 3. If no backup, fresh install
rm -rf client server node_modules
tar -xzf netcontrol-latest.tar.gz
cd netcontrol
./deploy-server.sh
./start-production.sh
```

## Prevention

### Regular Maintenance

```bash
# Weekly backup
cp server/data/netcontrol.db backups/netcontrol-db-$(date +%Y%m%d).db

# Monthly cleanup
find backups/ -name "*.db" -mtime +30 -delete

# Check disk space
df -h

# Check logs
tail -100 logs/combined.log | grep -i error
```

### Monitoring

Set up basic monitoring:

```bash
# Add to crontab (crontab -e)
*/5 * * * * curl -s http://localhost:5000/api/health || echo "NetControl down at $(date)" >> /var/log/netcontrol-monitor.log
```

This guide covers the most common issues. For specific problems, run the troubleshooting script and share the output!