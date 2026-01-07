# NetControl Web Application - Quick Installation Guide

## Prerequisites

- Linux server (Ubuntu 20.04+ recommended)
- Node.js 16+ installed
- At least 1GB RAM
- 2GB free disk space

## Installation Steps

1. **Upload and extract the deployment package:**
   ```bash
   tar -xzf netcontrol-YYYYMMDD_HHMMSS.tar.gz
   cd netcontrol
   ```

2. **Run the deployment script:**
   ```bash
   chmod +x deploy-server.sh
   ./deploy-server.sh
   ```

3. **Start the application:**
   ```bash
   ./start-production.sh
   ```

4. **Check application status:**
   ```bash
   ./status-production.sh
   ```

5. **Stop the application (when needed):**
   ```bash
   ./stop-production.sh
   ```

6. **Access the application:**
   - Open your browser to: `http://your-server-ip:5000`
   - Login with username: `admin` and password: `admin123`
   - **IMPORTANT:** Change the default password immediately!

**Note:** Each deployment starts with a fresh database. The default admin account will be created automatically on first startup.

## Verify Deployment Package (Optional)

Before deployment, you can verify the package contains all necessary files:

```bash
chmod +x verify-deployment.sh
./verify-deployment.sh netcontrol-YYYYMMDD_HHMMSS.tar.gz
```

This will check for all critical files and provide a deployment readiness report.

## Optional: Setup with PM2 (Recommended for production)

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start ecosystem.config.js

# Enable auto-start on boot
pm2 startup
pm2 save
```

## Optional: Setup with Nginx (Recommended for production)

```bash
# Install Nginx
sudo apt update && sudo apt install nginx

# Copy configuration
sudo cp nginx.conf /etc/nginx/sites-available/netcontrol
sudo ln -s /etc/nginx/sites-available/netcontrol /etc/nginx/sites-enabled/

# Test and restart Nginx
sudo nginx -t
sudo systemctl restart nginx
```

## Firewall Configuration

```bash
# Allow necessary ports
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw allow 5000  # NetControl (if not using Nginx)
sudo ufw enable
```

## Management Commands

```bash
# Start NetControl
./start-production.sh

# Stop NetControl
./stop-production.sh

# Check status
./status-production.sh

# Update to new version (preserves data)
./update-production.sh netcontrol-new-version.tar.gz

# Rollback to previous version
./rollback-production.sh

# List available backups
./rollback-production.sh --list
```

## Updating Existing Installation

To update an existing NetControl installation without losing data:

```bash
# Upload new package to your server
scp netcontrol-new-version.tar.gz user@server:/opt/netcontrol/

# SSH to server and update
ssh user@server
cd /opt/netcontrol
./update-production.sh netcontrol-new-version.tar.gz
```

The update script will:
- Stop the current application
- Create a full backup
- Install the new version
- Preserve your database and user data
- Restart the application

## Rollback if Needed

If something goes wrong with an update:

```bash
# List available backups
./rollback-production.sh --list

# Rollback to latest backup
./rollback-production.sh

# Rollback to specific backup
./rollback-production.sh netcontrol-backup-20260106_102744
```

## Troubleshooting

- Check logs: `tail -f logs/combined.log`
- Restart application: `pm2 restart netcontrol-web`
- Check process status: `pm2 status`

For detailed documentation, see PRODUCTION.md
