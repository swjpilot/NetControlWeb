# NetControl Deployment Guide

This document consolidates all deployment, production, and troubleshooting information for the NetControl system.

## Table of Contents
- [Quick Deployment](#quick-deployment)
- [Production Setup](#production-setup)
- [Update Process](#update-process)
- [Troubleshooting](#troubleshooting)
- [Database Management](#database-management)
- [Email Configuration](#email-configuration)

---

## Quick Deployment

### Prerequisites
- Node.js 18+ installed
- PM2 for process management
- Nginx (optional, for reverse proxy)

### 1. Deploy from Package
```bash
# Extract deployment package
tar -xzf netcontrol-YYYYMMDD_HHMMSS.tar.gz
cd netcontrol

# Run deployment script
chmod +x deploy-server.sh
./deploy-server.sh
```

### 2. Manual Deployment
```bash
# Install dependencies
npm install --production

# Set up environment
cp .env.example .env
# Edit .env with your settings

# Start the application
npm start
```

### 3. Production Deployment
```bash
# Install as system service
sudo cp netcontrol.service /etc/systemd/system/
sudo systemctl enable netcontrol
sudo systemctl start netcontrol

# Or use PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## Production Setup

### Environment Configuration
Create `.env` file with your settings:

```bash
# Server Configuration
PORT=3001
NODE_ENV=production

# Database (SQLite - automatically created)
DB_PATH=./server/data/netcontrol.db

# Email Configuration (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_STARTTLS=true
SMTP_NO_AUTH=false

# Application Settings
SESSION_SECRET=your-random-secret-key-here
```

### Nginx Configuration (Optional)
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### System Service Setup
```bash
# Copy service file
sudo cp netcontrol.service /etc/systemd/system/

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable netcontrol
sudo systemctl start netcontrol

# Check status
sudo systemctl status netcontrol
```

---

## Update Process

### Automated Update
```bash
# Run update script
./update-production.sh

# The script will:
# 1. Create backup of current installation
# 2. Stop the service
# 3. Extract new version
# 4. Install dependencies
# 5. Run database migrations
# 6. Start the service
# 7. Verify deployment
```

### Manual Update
```bash
# Stop service
sudo systemctl stop netcontrol
# or
pm2 stop netcontrol

# Backup current installation
cp -r /opt/netcontrol /opt/netcontrol-backup-$(date +%Y%m%d_%H%M%S)

# Extract new version
tar -xzf netcontrol-new-version.tar.gz
cp -r netcontrol/* /opt/netcontrol/

# Install dependencies
cd /opt/netcontrol
npm install --production

# Start service
sudo systemctl start netcontrol
# or
pm2 start netcontrol
```

### Rollback Process
```bash
# If update fails, rollback
./rollback-production.sh

# Or manually:
sudo systemctl stop netcontrol
rm -rf /opt/netcontrol
mv /opt/netcontrol-backup-YYYYMMDD_HHMMSS /opt/netcontrol
sudo systemctl start netcontrol
```

---

## Troubleshooting

### Common Issues

#### 1. Service Won't Start
```bash
# Check service status
sudo systemctl status netcontrol

# Check logs
sudo journalctl -u netcontrol -f

# Common fixes:
# - Check port availability: sudo netstat -tlnp | grep 3001
# - Verify Node.js version: node --version
# - Check file permissions: ls -la /opt/netcontrol
```

#### 2. Database Issues
```bash
# Check database file exists
ls -la server/data/netcontrol.db

# Check database permissions
chmod 644 server/data/netcontrol.db
chmod 755 server/data/

# Test database connection
node -e "const db = require('./server/database/db'); console.log('Database OK');"
```

#### 3. Email Not Working
```bash
# Test email configuration
curl -X POST http://localhost:3001/api/settings/test-email \
  -H "Content-Type: application/json" \
  -d '{"to":"test@example.com"}'

# Check email settings in database
sqlite3 server/data/netcontrol.db "SELECT * FROM settings WHERE key LIKE 'smtp%';"

# Common fixes:
# - Verify SMTP credentials
# - Check firewall/network connectivity
# - Enable "Less secure apps" for Gmail
# - Use App Passwords for Gmail
```

#### 4. Permission Errors
```bash
# Fix file permissions
sudo chown -R netcontrol:netcontrol /opt/netcontrol
chmod +x /opt/netcontrol/*.sh

# Fix database permissions
chmod 644 /opt/netcontrol/server/data/netcontrol.db
chmod 755 /opt/netcontrol/server/data/
```

#### 5. Port Already in Use
```bash
# Find process using port
sudo lsof -i :3001

# Kill process if needed
sudo kill -9 <PID>

# Or change port in .env file
echo "PORT=3002" >> .env
```

### Diagnostic Tools

#### System Status Check
```bash
# Run comprehensive diagnostics
./remote-diagnostics.sh

# Check specific components
./status-production.sh
```

#### Log Analysis
```bash
# Application logs
tail -f /opt/netcontrol/logs/app.log

# System service logs
sudo journalctl -u netcontrol -f

# PM2 logs (if using PM2)
pm2 logs netcontrol
```

#### Database Diagnostics
```bash
# Check database integrity
sqlite3 server/data/netcontrol.db "PRAGMA integrity_check;"

# View database schema
sqlite3 server/data/netcontrol.db ".schema"

# Check table contents
sqlite3 server/data/netcontrol.db "SELECT name FROM sqlite_master WHERE type='table';"
```

---

## Database Management

### Automatic Migrations
The system automatically runs database migrations on startup. No manual intervention required.

**Current Migrations**:
- Email settings (`smtp_no_auth`, `smtp_starttls`)
- Password reset tokens table
- Version tracking

### Manual Database Operations
```bash
# Backup database
cp server/data/netcontrol.db server/data/netcontrol-backup-$(date +%Y%m%d_%H%M%S).db

# Restore database
cp server/data/netcontrol-backup-YYYYMMDD_HHMMSS.db server/data/netcontrol.db

# Reset database (WARNING: Deletes all data)
rm server/data/netcontrol.db
# Restart service to recreate with default admin user
```

### Default Admin User
- **Username**: `admin`
- **Password**: `admin123`
- **Change immediately after first login**

---

## Email Configuration

### Supported Providers

#### Gmail
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_STARTTLS=true
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

#### Office 365
```
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_STARTTLS=true
SMTP_USER=your-email@company.com
SMTP_PASS=your-password
```

#### Local SMTP (No Authentication)
```
SMTP_HOST=localhost
SMTP_PORT=25
SMTP_NO_AUTH=true
SMTP_STARTTLS=false
```

### Email Testing
```bash
# Test email from command line
curl -X POST http://localhost:3001/api/settings/test-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"to":"test@example.com"}'
```

---

## Performance Optimization

### Production Settings
```bash
# PM2 cluster mode
pm2 start ecosystem.config.js --env production

# Nginx caching
# Add to nginx.conf:
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### Database Optimization
```bash
# Vacuum database periodically
sqlite3 server/data/netcontrol.db "VACUUM;"

# Analyze database
sqlite3 server/data/netcontrol.db "ANALYZE;"
```

---

## Security Considerations

### Basic Security
- Change default admin password immediately
- Use strong session secrets
- Keep system updated
- Use HTTPS in production
- Restrict database file permissions

### Firewall Configuration
```bash
# Allow only necessary ports
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

---

## Monitoring

### Health Checks
```bash
# Application health
curl http://localhost:3001/api/health

# Service status
sudo systemctl is-active netcontrol

# Process monitoring
ps aux | grep node
```

### Log Rotation
```bash
# Setup logrotate for application logs
sudo tee /etc/logrotate.d/netcontrol << EOF
/opt/netcontrol/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    copytruncate
}
EOF
```

---

## Backup Strategy

### Automated Backup
```bash
#!/bin/bash
# backup-netcontrol.sh
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups/netcontrol"

mkdir -p $BACKUP_DIR

# Backup database
cp /opt/netcontrol/server/data/netcontrol.db $BACKUP_DIR/netcontrol-$DATE.db

# Backup configuration
cp /opt/netcontrol/.env $BACKUP_DIR/env-$DATE.backup

# Cleanup old backups (keep 30 days)
find $BACKUP_DIR -name "*.db" -mtime +30 -delete
find $BACKUP_DIR -name "*.backup" -mtime +30 -delete
```

### Restore Process
```bash
# Stop service
sudo systemctl stop netcontrol

# Restore database
cp /opt/backups/netcontrol/netcontrol-YYYYMMDD_HHMMSS.db /opt/netcontrol/server/data/netcontrol.db

# Restore configuration
cp /opt/backups/netcontrol/env-YYYYMMDD_HHMMSS.backup /opt/netcontrol/.env

# Start service
sudo systemctl start netcontrol
```

---

## Support

### Getting Help
1. Check this documentation first
2. Run diagnostic scripts: `./remote-diagnostics.sh`
3. Check application logs
4. Review system service status

### Reporting Issues
When reporting issues, include:
- System information (OS, Node.js version)
- Error messages from logs
- Steps to reproduce the issue
- Output from diagnostic scripts

---

*This document consolidates all deployment and troubleshooting information. For feature details, see FEATURES.md.*