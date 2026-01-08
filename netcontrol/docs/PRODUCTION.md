# NetControl Web Application - Production Deployment Guide

## Quick Start (Recommended)

### 1. Simple Production Start
```bash
# Make the script executable and run it
chmod +x start-production.sh
./start-production.sh
```

This will:
- Build the React client for production
- Start the server in production mode
- Make the app available at http://localhost:5000

### 2. Manual Steps
```bash
# Build the React client
cd client && npm run build && cd ..

# Start the server in production mode
NODE_ENV=production node server/index.js
```

## Advanced Production Options

### Option 1: Using PM2 (Process Manager)
```bash
# Install PM2 globally
npm install -g pm2

# Start the application
pm2 start ecosystem.config.js

# View status
pm2 status

# View logs
pm2 logs netcontrol

# Stop the application
pm2 stop netcontrol

# Restart the application
pm2 restart netcontrol

# Auto-start on system boot
pm2 startup
pm2 save
```

### Option 2: Using Docker
```bash
# Build and start with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the application
docker-compose down

# Rebuild and restart
docker-compose up -d --build
```

### Option 3: Using Systemd (Linux)
```bash
# Copy the service file
sudo cp netcontrol.service /etc/systemd/system/

# Copy application files to /opt
sudo cp -r . /opt/netcontrol-web
sudo chown -R www-data:www-data /opt/netcontrol-web

# Enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable netcontrol.service
sudo systemctl start netcontrol.service

# Check status
sudo systemctl status netcontrol.service

# View logs
sudo journalctl -u netcontrol.service -f
```

### Option 4: Using Nginx Reverse Proxy
```bash
# Install Nginx
sudo apt update && sudo apt install nginx

# Copy the nginx configuration
sudo cp nginx.conf /etc/nginx/sites-available/netcontrol
sudo ln -s /etc/nginx/sites-available/netcontrol /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

## Environment Configuration

### Required Environment Variables
```bash
NODE_ENV=production
PORT=5000  # Optional, defaults to 5000
```

### Database Location
The SQLite database is stored at: `server/database/netcontrol.db`

### Logs Location
Application logs are written to: `logs/` directory

## Security Considerations

1. **Change Default Admin Password**
   - Login with admin/admin123
   - Go to User Management and change the password

2. **Configure QRZ Credentials**
   - Go to Settings > QRZ Configuration
   - Enter your QRZ.com username and password

3. **SSL/HTTPS Setup**
   - Use the provided nginx.conf for SSL termination
   - Obtain SSL certificates (Let's Encrypt recommended)

4. **Firewall Configuration**
   ```bash
   # Allow only necessary ports
   sudo ufw allow 22    # SSH
   sudo ufw allow 80    # HTTP
   sudo ufw allow 443   # HTTPS
   sudo ufw enable
   ```

## Monitoring and Maintenance

### Health Check Endpoint
The application provides a health check at: `GET /api/health`

### Log Files
- Application logs: `logs/combined.log`
- Error logs: `logs/err.log`
- Access logs: `logs/out.log`

### Database Backup
```bash
# Create backup
cp server/database/netcontrol.db server/database/netcontrol.db.backup.$(date +%Y%m%d_%H%M%S)

# Restore backup
cp server/database/netcontrol.db.backup.YYYYMMDD_HHMMSS server/database/netcontrol.db
```

### Updates
```bash
# Stop the application
pm2 stop netcontrol-web  # or your chosen method

# Pull updates
git pull origin main

# Rebuild client
cd client && npm run build && cd ..

# Restart application
pm2 restart netcontrol
```

## Troubleshooting

### Common Issues

1. **Port 5000 already in use**
   ```bash
   # Find and kill the process
   lsof -ti:5000 | xargs kill
   ```

2. **Permission denied errors**
   ```bash
   # Fix file permissions
   chmod +x start-production.sh
   chown -R $USER:$USER .
   ```

3. **Database connection errors**
   ```bash
   # Check database file permissions
   ls -la server/database/
   # Ensure the directory is writable
   chmod 755 server/database/
   ```

4. **React build errors**
   ```bash
   # Clear cache and rebuild
   cd client
   rm -rf node_modules build
   npm install
   npm run build
   ```

## Performance Optimization

1. **Enable Gzip Compression** (handled by nginx.conf)
2. **Use CDN for static assets** (optional)
3. **Database optimization** (SQLite is sufficient for most use cases)
4. **Memory monitoring** (PM2 provides memory restart limits)

## Default Credentials

- **Admin User**: admin
- **Admin Password**: admin123

**⚠️ IMPORTANT: Change the default admin password immediately after deployment!**

## Support

For issues and questions:
1. Check the application logs
2. Verify all dependencies are installed
3. Ensure QRZ credentials are configured
4. Check firewall and network settings