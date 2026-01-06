#!/bin/bash

# NetControl Production Update Script
# This script updates an existing installation while preserving data

set -e

BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
UPDATE_PACKAGE=""
CURRENT_DIR=$(pwd)

show_help() {
    echo "NetControl Production Update Script"
    echo ""
    echo "Usage: $0 [OPTIONS] <package-file>"
    echo ""
    echo "Options:"
    echo "  -h, --help               Show this help message"
    echo "  -b, --backup-dir DIR     Backup directory (default: backups)"
    echo "  -f, --force              Skip confirmation prompts"
    echo ""
    echo "Examples:"
    echo "  $0 netcontrol-20260106_102744.tar.gz"
    echo "  $0 --backup-dir /opt/backups netcontrol-latest.tar.gz"
    echo ""
    echo "This script will:"
    echo "  1. Stop the current application"
    echo "  2. Backup current installation and database"
    echo "  3. Extract new package"
    echo "  4. Preserve existing database and user data"
    echo "  5. Start the updated application"
}

FORCE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -b|--backup-dir)
            BACKUP_DIR="$2"
            shift 2
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        -*)
            echo "Unknown option $1"
            show_help
            exit 1
            ;;
        *)
            if [ -z "$UPDATE_PACKAGE" ]; then
                UPDATE_PACKAGE="$1"
            else
                echo "Multiple package files specified"
                exit 1
            fi
            shift
            ;;
    esac
done

if [ -z "$UPDATE_PACKAGE" ]; then
    echo "❌ Error: Package file is required"
    show_help
    exit 1
fi

if [ ! -f "$UPDATE_PACKAGE" ]; then
    echo "❌ Error: Package file '$UPDATE_PACKAGE' not found"
    exit 1
fi

echo "🔄 NetControl Production Update"
echo "==============================="
echo "📦 Package: $UPDATE_PACKAGE"
echo "📁 Backup Directory: $BACKUP_DIR"
echo "🕐 Timestamp: $TIMESTAMP"
echo ""

# Check if we're in a NetControl installation directory
if [ ! -f "server/index.js" ] || [ ! -f "package.json" ]; then
    echo "❌ Error: This doesn't appear to be a NetControl installation directory"
    echo "Please run this script from your NetControl installation directory (e.g., /opt/netcontrol)"
    exit 1
fi

# Check if application is running
echo "🔍 Checking application status..."
if pgrep -f "node.*server/index.js" > /dev/null; then
    echo "✅ NetControl is currently running"
    APP_WAS_RUNNING=true
else
    echo "ℹ️  NetControl is not currently running"
    APP_WAS_RUNNING=false
fi

# Confirmation prompt
if [ "$FORCE" != true ]; then
    echo ""
    echo "⚠️  This will update your NetControl installation:"
    echo "   - Current application will be stopped"
    echo "   - Full backup will be created"
    echo "   - New version will be installed"
    echo "   - Database and user data will be preserved"
    echo ""
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Update cancelled"
        exit 0
    fi
fi

echo ""
echo "🚀 Starting update process..."

# Step 1: Stop the application
echo ""
echo "1️⃣  Stopping NetControl application..."
if [ -f "./stop-production.sh" ]; then
    ./stop-production.sh
else
    echo "⚠️  stop-production.sh not found, stopping manually..."
    pkill -f "node.*server/index.js" 2>/dev/null || true
    if command -v pm2 &> /dev/null; then
        pm2 stop netcontrol 2>/dev/null || true
    fi
fi

# Wait for processes to stop
sleep 3

# Step 2: Create backup
echo ""
echo "2️⃣  Creating backup..."
mkdir -p "$BACKUP_DIR"

BACKUP_NAME="netcontrol-backup-$TIMESTAMP"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"

echo "📦 Backing up current installation to: $BACKUP_PATH"

# Create full backup of current installation
cp -r . "$BACKUP_PATH"

# Create separate database backup
if [ -f "server/data/netcontrol.db" ]; then
    cp "server/data/netcontrol.db" "$BACKUP_DIR/netcontrol-db-$TIMESTAMP.db"
    echo "✅ Database backed up to: $BACKUP_DIR/netcontrol-db-$TIMESTAMP.db"
else
    echo "⚠️  No database file found at server/data/netcontrol.db"
fi

echo "✅ Backup completed"

# Step 3: Preserve important data
echo ""
echo "3️⃣  Preserving user data..."

# Create temporary directory for preserved data
TEMP_DATA_DIR="/tmp/netcontrol-data-$TIMESTAMP"
mkdir -p "$TEMP_DATA_DIR"

# Preserve database
if [ -f "server/data/netcontrol.db" ]; then
    cp "server/data/netcontrol.db" "$TEMP_DATA_DIR/"
    echo "✅ Database preserved"
fi

# Preserve uploads
if [ -d "server/uploads" ]; then
    cp -r "server/uploads" "$TEMP_DATA_DIR/"
    echo "✅ Uploads preserved"
fi

# Preserve logs
if [ -d "logs" ]; then
    cp -r "logs" "$TEMP_DATA_DIR/"
    echo "✅ Logs preserved"
fi

# Preserve any custom configuration files
if [ -f ".env" ]; then
    cp ".env" "$TEMP_DATA_DIR/"
    echo "✅ Environment file preserved"
fi

# Step 4: Extract new package
echo ""
echo "4️⃣  Installing new version..."

# Get the package name without path
PACKAGE_BASENAME=$(basename "$UPDATE_PACKAGE")

# Copy package to current directory if it's not already here
if [ "$UPDATE_PACKAGE" != "$PACKAGE_BASENAME" ]; then
    cp "$UPDATE_PACKAGE" "./"
    UPDATE_PACKAGE="$PACKAGE_BASENAME"
fi

# Remove old files (except backups and preserved data)
echo "🗑️  Removing old installation files..."
find . -maxdepth 1 -type f -name "*.js" -delete 2>/dev/null || true
find . -maxdepth 1 -type f -name "*.json" -delete 2>/dev/null || true
find . -maxdepth 1 -type f -name "*.md" -delete 2>/dev/null || true
find . -maxdepth 1 -type f -name "*.sh" -delete 2>/dev/null || true
find . -maxdepth 1 -type f -name "*.yml" -delete 2>/dev/null || true
find . -maxdepth 1 -type f -name "*.conf" -delete 2>/dev/null || true
find . -maxdepth 1 -type f -name "Dockerfile" -delete 2>/dev/null || true
find . -maxdepth 1 -type f -name "ecosystem.config.js" -delete 2>/dev/null || true
find . -maxdepth 1 -type f -name "netcontrol.service" -delete 2>/dev/null || true

# Remove old directories (except backups and preserved data)
rm -rf client server 2>/dev/null || true

echo "📦 Extracting new package..."
tar -xzf "$UPDATE_PACKAGE"

# Move files from extracted directory to current directory
if [ -d "netcontrol" ]; then
    mv netcontrol/* .
    rmdir netcontrol
fi

# Step 5: Restore preserved data
echo ""
echo "5️⃣  Restoring user data..."

# Restore database
if [ -f "$TEMP_DATA_DIR/netcontrol.db" ]; then
    mkdir -p "server/data"
    cp "$TEMP_DATA_DIR/netcontrol.db" "server/data/"
    echo "✅ Database restored"
fi

# Restore uploads
if [ -d "$TEMP_DATA_DIR/uploads" ]; then
    cp -r "$TEMP_DATA_DIR/uploads" "server/"
    echo "✅ Uploads restored"
fi

# Restore logs
if [ -d "$TEMP_DATA_DIR/logs" ]; then
    cp -r "$TEMP_DATA_DIR/logs" "./"
    echo "✅ Logs restored"
fi

# Restore environment file
if [ -f "$TEMP_DATA_DIR/.env" ]; then
    cp "$TEMP_DATA_DIR/.env" "./"
    echo "✅ Environment file restored"
fi

# Step 6: Set permissions
echo ""
echo "6️⃣  Setting permissions..."
chmod +x *.sh 2>/dev/null || true
chmod 755 server/data 2>/dev/null || true
chmod 644 server/data/netcontrol.db 2>/dev/null || true

# Step 7: Install dependencies (if needed)
echo ""
echo "7️⃣  Installing dependencies..."
if [ -f "deploy-server.sh" ]; then
    echo "🔧 Running deployment setup..."
    ./deploy-server.sh
else
    echo "🔧 Installing Node.js dependencies..."
    npm install --production
fi

# Step 8: Start the application
echo ""
echo "8️⃣  Starting updated application..."

if [ "$APP_WAS_RUNNING" = true ]; then
    if [ -f "./start-production.sh" ]; then
        ./start-production.sh
    else
        echo "⚠️  start-production.sh not found, starting manually..."
        NODE_ENV=production node server/index.js &
    fi
    
    # Wait for application to start
    sleep 5
    
    # Check if application started successfully
    if curl -s http://localhost:5000/api/health > /dev/null 2>&1; then
        echo "✅ Application started successfully"
    else
        echo "⚠️  Application may not have started correctly"
        echo "Check logs or run: ./status-production.sh"
    fi
else
    echo "ℹ️  Application was not running before update, not starting automatically"
    echo "To start: ./start-production.sh"
fi

# Step 9: Cleanup
echo ""
echo "9️⃣  Cleaning up..."
rm -rf "$TEMP_DATA_DIR"
rm -f "$UPDATE_PACKAGE"

echo ""
echo "✅ Update completed successfully!"
echo ""
echo "📋 Summary:"
echo "   - Backup created: $BACKUP_PATH"
echo "   - Database backup: $BACKUP_DIR/netcontrol-db-$TIMESTAMP.db"
echo "   - User data preserved and restored"
echo "   - Application updated to new version"
if [ "$APP_WAS_RUNNING" = true ]; then
    echo "   - Application restarted"
fi
echo ""
echo "🔧 Management commands:"
echo "   ./status-production.sh  - Check application status"
echo "   ./stop-production.sh    - Stop application"
echo "   ./start-production.sh   - Start application"
echo ""
echo "🔄 To rollback if needed:"
echo "   ./stop-production.sh"
echo "   rm -rf client server *.js *.json *.md *.sh *.yml *.conf Dockerfile ecosystem.config.js netcontrol.service"
echo "   cp -r $BACKUP_PATH/* ."
echo "   ./start-production.sh"