#!/bin/bash

# NetControl Deployment Package Creator
# This script creates a production-ready deployment package

set -e

DEPLOY_DIR="netcontrol"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PACKAGE_NAME="netcontrol-${TIMESTAMP}.tar.gz"

echo "🚀 Creating NetControl deployment package..."

# Clean up any existing deployment directory
rm -rf $DEPLOY_DIR
mkdir -p $DEPLOY_DIR

echo "📦 Building React client for production..."
# Generate build number and version info
BUILD_NUMBER=$(date +%Y%m%d_%H%M%S)
echo "// Auto-generated version file - do not edit manually" > version.js
echo "const version = {" >> version.js
echo "  major: '1.0'," >> version.js
echo "  build: '$BUILD_NUMBER'," >> version.js
echo "  timestamp: '$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'," >> version.js
echo "  environment: process.env.NODE_ENV || 'production'" >> version.js
echo "};" >> version.js
echo "module.exports = version;" >> version.js

cd client && npm run build && cd ..

echo "📋 Copying server files..."
# Copy server files (excluding database files)
cp -r server/ $DEPLOY_DIR/
# Remove any existing database files from the deployment
rm -f $DEPLOY_DIR/server/data/*.db
rm -f $DEPLOY_DIR/server/data/*.db-*
rm -f $DEPLOY_DIR/server/database/*.db
rm -f $DEPLOY_DIR/server/database/*.db-*
rm -f $DEPLOY_DIR/server/*.db
echo "ℹ️  Database files excluded - will be created on first startup"
cp package.json $DEPLOY_DIR/
cp package-lock.json $DEPLOY_DIR/
cp version.js $DEPLOY_DIR/

echo "📋 Copying client build..."
# Copy built client
mkdir -p $DEPLOY_DIR/client
cp -r client/build/ $DEPLOY_DIR/client/
# Copy client package.json for reference
cp client/package.json $DEPLOY_DIR/client/
cp client/package-lock.json $DEPLOY_DIR/client/

echo "📋 Copying configuration files..."
# Copy configuration and deployment files
cp nginx.conf $DEPLOY_DIR/
cp ecosystem.config.js $DEPLOY_DIR/
cp docker-compose.yml $DEPLOY_DIR/
cp Dockerfile $DEPLOY_DIR/
cp netcontrol.service $DEPLOY_DIR/
cp start-production.sh $DEPLOY_DIR/
cp stop-production.sh $DEPLOY_DIR/
cp status-production.sh $DEPLOY_DIR/
cp update-production.sh $DEPLOY_DIR/
cp rollback-production.sh $DEPLOY_DIR/
cp PRODUCTION.md $DEPLOY_DIR/
cp UPDATE.md $DEPLOY_DIR/

echo "📋 Copying documentation and setup files..."
# Copy important documentation and setup files
cp README.md $DEPLOY_DIR/
cp README-DEPLOYMENT.md $DEPLOY_DIR/
cp DEPLOYMENT.md $DEPLOY_DIR/
cp .env.example $DEPLOY_DIR/
cp EMAIL_SETUP.md $DEPLOY_DIR/
cp VERSION_INFO.md $DEPLOY_DIR/
cp DATABASE_MIGRATION_INFO.md $DEPLOY_DIR/

# Copy additional deployment scripts
cp server-setup.sh $DEPLOY_DIR/
cp docker-deploy.sh $DEPLOY_DIR/
cp cloud-deploy.sh $DEPLOY_DIR/
cp verify-deployment.sh $DEPLOY_DIR/

echo "📋 Creating deployment scripts..."
# Create server deployment script
cat > $DEPLOY_DIR/deploy-server.sh << 'EOF'
#!/bin/bash

# NetControl Server Deployment Script
# Run this script on your target server

set -e

echo "🚀 Deploying NetControl Web Application..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version 16+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install dependencies
echo "📦 Installing server dependencies..."
npm install --production

# Create required directories
echo "📁 Creating required directories..."
mkdir -p server/data
mkdir -p server/uploads
mkdir -p server/uploads/audio
mkdir -p server/downloads
mkdir -p logs

# Set permissions
chmod +x start-production.sh
chmod +x stop-production.sh
chmod +x status-production.sh
chmod +x update-production.sh
chmod +x rollback-production.sh
chmod 755 server/database

echo "✅ NetControl deployed successfully!"
echo ""
echo "🚀 To start the application:"
echo "   ./start-production.sh"
echo ""
echo "🛑 To stop the application:"
echo "   ./stop-production.sh"
echo ""
echo "📊 To check status:"
echo "   ./status-production.sh"
echo ""
echo "🌐 The application will be available at: http://your-server-ip:5000"
echo ""
echo "📖 For advanced deployment options, see PRODUCTION.md"
EOF

chmod +x $DEPLOY_DIR/deploy-server.sh

echo "📋 Creating installation guide..."
# Create quick installation guide
cat > $DEPLOY_DIR/INSTALL.md << 'EOF'
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
EOF

echo "📦 Creating deployment package..."
# Create the deployment package
tar -czf $PACKAGE_NAME $DEPLOY_DIR/

# Get package size (force recalculation)
sync
PACKAGE_SIZE=$(ls -lh $PACKAGE_NAME | awk '{print $5}')

echo ""
echo "✅ Deployment package created successfully!"
echo "📦 Package: $PACKAGE_NAME ($PACKAGE_SIZE)"
echo "📁 Contents: $DEPLOY_DIR/"
echo ""
echo "🚀 Next steps:"
echo "1. Upload $PACKAGE_NAME to your server"
echo "2. Extract: tar -xzf $PACKAGE_NAME"
echo "3. Run: cd netcontrol && ./deploy-server.sh"
echo "4. Start: ./start-production.sh"
echo ""
echo "📖 See $DEPLOY_DIR/INSTALL.md for detailed instructions"