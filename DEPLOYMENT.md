# NetControl Web Application - Complete Deployment Guide

## 🚀 Quick Deployment Options

### Option 1: Automated Deployment Package (Recommended)
```bash
# Create deployment package
./deploy-package.sh

# Upload to your server and extract
scp netcontrol-*.tar.gz user@your-server:/opt/
ssh user@your-server
cd /opt && tar -xzf netcontrol-*.tar.gz
cd netcontrol && ./deploy-server.sh && ./start-production.sh
```

### Option 2: Docker Deployment
```bash
# Local Docker deployment
./docker-deploy.sh

# Or manual Docker commands
docker-compose up -d --build
```

### Option 3: Cloud Deployment (DigitalOcean/AWS)
```bash
# Deploy to DigitalOcean
./cloud-deploy.sh --provider digitalocean --type small --region nyc1 --key your-ssh-key

# Deploy to AWS
./cloud-deploy.sh --provider aws --type small --region us-east-1 --key your-aws-key
```

## 📋 Manual Server Setup

### Prerequisites
- Ubuntu 20.04+ server
- 1GB+ RAM
- 2GB+ free disk space
- Root or sudo access

### Step 1: Prepare Server
```bash
# Run on your server
curl -fsSL https://raw.githubusercontent.com/your-repo/netcontrol/main/server-setup.sh | bash
```

Or manually:
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install dependencies
sudo apt install -y nginx sqlite3 ufw
sudo npm install -g pm2

# Create user and directories
sudo useradd -m -s /bin/bash netcontrol
sudo mkdir -p /opt/netcontrol
sudo chown netcontrol:netcontrol /opt/netcontrol
```

### Step 2: Deploy Application
```bash
# Upload deployment package
scp netcontrol-*.tar.gz netcontrol@your-server:/opt/netcontrol/

# SSH to server and deploy
ssh netcontrol@your-server
cd /opt/netcontrol
tar -xzf netcontrol-*.tar.gz
cd netcontrol
./deploy-server.sh
```

### Step 3: Start Application
```bash
# Simple start
./start-production.sh

# Or with PM2 (recommended)
pm2 start ecosystem.config.js
pm2 startup
pm2 save
```

## 🌐 Web Server Configuration

### Nginx Setup (Recommended)
```bash
# Copy nginx configuration
sudo cp nginx.conf /etc/nginx/sites-available/netcontrol
sudo ln -s /etc/nginx/sites-available/netcontrol /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Test and restart
sudo nginx -t
sudo systemctl restart nginx
```

### SSL/HTTPS Setup with Let's Encrypt
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 🔒 Security Configuration

### Firewall Setup
```bash
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

### Application Security
1. **Change default admin password immediately**
2. **Configure QRZ credentials in Settings**
3. **Set up regular database backups**
4. **Monitor application logs**
5. **Use password reset feature for user management**

### User Management Features
- **Create/Edit Users**: Admin can create and modify user accounts
- **Password Reset**: Admin can reset any user's password from User Management page
- **Role Management**: Assign admin or user roles
- **Account Status**: Enable/disable user accounts

## 📊 Monitoring and Maintenance

### Health Checks
```bash
# Check application health
curl http://localhost:5000/api/health

# Check PM2 status
pm2 status

# View logs
pm2 logs netcontrol
tail -f logs/combined.log
```

### Database Backup
```bash
# Create backup script
cat > backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/netcontrol/backups"
mkdir -p $BACKUP_DIR
cp server/data/netcontrol.db $BACKUP_DIR/netcontrol-$(date +%Y%m%d_%H%M%S).db
# Keep only last 30 backups
ls -t $BACKUP_DIR/netcontrol-*.db | tail -n +31 | xargs rm -f
EOF

chmod +x backup-db.sh

# Add to crontab for daily backups
crontab -e
# Add: 0 2 * * * /opt/netcontrol/backup-db.sh
```

### Database Restore
```bash
# Stop application
./stop-production.sh

# Restore from backup
cp backups/netcontrol-YYYYMMDD_HHMMSS.db server/data/netcontrol.db

# Start application
./start-production.sh
```

### Updates
```bash
# Stop application
pm2 stop netcontrol

# Backup current version
cp -r /opt/netcontrol /opt/netcontrol.backup

# Deploy new version
cd /opt/netcontrol
tar -xzf netcontrol-new-version.tar.gz
cd netcontrol
./deploy-server.sh

# Start application
pm2 start ecosystem.config.js
```

## 🐳 Docker Deployment Details

### Docker Compose
```yaml
version: '3.8'
services:
  netcontrol:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
    volumes:
      - ./server/database:/app/server/database
      - ./logs:/app/logs
    restart: unless-stopped
```

### Docker Commands
```bash
# Build and start
docker-compose up -d --build

# View logs
docker-compose logs -f

# Update application
docker-compose down
docker-compose up -d --build

# Backup database
docker-compose exec netcontrol cp /app/server/data/netcontrol.db /app/backups/
```

## ☁️ Cloud Provider Specific Instructions

### DigitalOcean
1. Create a Droplet (Ubuntu 20.04, 1GB RAM minimum)
2. Add your SSH key
3. Use the cloud-deploy.sh script or manual setup
4. Configure domain and SSL

### AWS EC2
1. Launch EC2 instance (t3.micro minimum)
2. Configure security groups (ports 22, 80, 443, 5000)
3. Use the cloud-deploy.sh script or manual setup
4. Configure Elastic IP and Route 53

### Google Cloud Platform
1. Create Compute Engine instance
2. Configure firewall rules
3. Manual setup required (cloud-deploy.sh support coming soon)

### Azure
1. Create Virtual Machine
2. Configure Network Security Group
3. Manual setup required (cloud-deploy.sh support coming soon)

## 🔧 Troubleshooting

### Common Issues

1. **Port 5000 already in use**
   ```bash
   sudo lsof -ti:5000 | xargs sudo kill -9
   ```

2. **Permission denied errors**
   ```bash
   sudo chown -R netcontrol:netcontrol /opt/netcontrol
   chmod +x *.sh
   ```

3. **Database connection errors**
   ```bash
   ls -la server/data/
   chmod 755 server/data/
   chmod 644 server/data/netcontrol.db
   ```

4. **Nginx configuration errors**
   ```bash
   sudo nginx -t
   sudo systemctl status nginx
   sudo tail -f /var/log/nginx/error.log
   ```

### Log Locations
- Application logs: `/opt/netcontrol/logs/`
- PM2 logs: `~/.pm2/logs/`
- Nginx logs: `/var/log/nginx/`
- System logs: `/var/log/syslog`

### Performance Tuning
```bash
# Increase PM2 instances for high load
pm2 scale netcontrol 2

# Monitor resource usage
pm2 monit

# Database optimization (if needed)
sqlite3 server/data/netcontrol.db "VACUUM;"
```

## 📞 Support

For deployment issues:
1. Check the logs first
2. Verify all prerequisites are met
3. Ensure firewall allows necessary ports
4. Check file permissions
5. Verify Node.js version (16+ required)

## 🎯 Production Checklist

- [ ] Server meets minimum requirements
- [ ] Node.js 16+ installed
- [ ] Application deployed and running
- [ ] Default admin password changed
- [ ] QRZ credentials configured
- [ ] Firewall configured
- [ ] SSL certificate installed (if using domain)
- [ ] Database backups scheduled
- [ ] Monitoring set up
- [ ] Documentation reviewed by team

## 📈 Scaling Considerations

For high-traffic deployments:
- Use multiple PM2 instances
- Consider load balancer (nginx upstream)
- Monitor database performance
- Implement caching (Redis)
- Use CDN for static assets
- Consider database migration to PostgreSQL