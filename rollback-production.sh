#!/bin/bash

# NetControl Production Rollback Script
# This script rolls back to a previous backup

set -e

BACKUP_DIR="backups"
BACKUP_NAME=""
FORCE=false

show_help() {
    echo "NetControl Production Rollback Script"
    echo ""
    echo "Usage: $0 [OPTIONS] [backup-name]"
    echo ""
    echo "Options:"
    echo "  -h, --help               Show this help message"
    echo "  -b, --backup-dir DIR     Backup directory (default: backups)"
    echo "  -f, --force              Skip confirmation prompts"
    echo "  -l, --list               List available backups"
    echo ""
    echo "Examples:"
    echo "  $0 --list                                    # List available backups"
    echo "  $0 netcontrol-backup-20260106_102744        # Rollback to specific backup"
    echo "  $0                                           # Rollback to latest backup"
}

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
        -l|--list)
            echo "📋 Available backups in $BACKUP_DIR:"
            if [ -d "$BACKUP_DIR" ]; then
                ls -la "$BACKUP_DIR" | grep "netcontrol-backup-" | awk '{print "   " $9 " (" $5 " bytes, " $6 " " $7 " " $8 ")"}'
            else
                echo "   No backup directory found"
            fi
            exit 0
            ;;
        -*)
            echo "Unknown option $1"
            show_help
            exit 1
            ;;
        *)
            if [ -z "$BACKUP_NAME" ]; then
                BACKUP_NAME="$1"
            else
                echo "Multiple backup names specified"
                exit 1
            fi
            shift
            ;;
    esac
done

echo "🔄 NetControl Production Rollback"
echo "=================================="

# Check if we're in a NetControl installation directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: This doesn't appear to be a NetControl installation directory"
    echo "Please run this script from your NetControl installation directory (e.g., /opt/netcontrol)"
    exit 1
fi

# Check if backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    echo "❌ Error: Backup directory '$BACKUP_DIR' not found"
    exit 1
fi

# If no backup name specified, find the latest
if [ -z "$BACKUP_NAME" ]; then
    BACKUP_NAME=$(ls -t "$BACKUP_DIR" | grep "netcontrol-backup-" | head -1)
    if [ -z "$BACKUP_NAME" ]; then
        echo "❌ Error: No backups found in $BACKUP_DIR"
        exit 1
    fi
    echo "🔍 Using latest backup: $BACKUP_NAME"
fi

BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"

# Check if backup exists
if [ ! -d "$BACKUP_PATH" ]; then
    echo "❌ Error: Backup '$BACKUP_PATH' not found"
    echo ""
    echo "Available backups:"
    ls -la "$BACKUP_DIR" | grep "netcontrol-backup-" | awk '{print "   " $9}'
    exit 1
fi

echo "📁 Backup Path: $BACKUP_PATH"
echo ""

# Confirmation prompt
if [ "$FORCE" != true ]; then
    echo "⚠️  This will rollback your NetControl installation:"
    echo "   - Current application will be stopped"
    echo "   - Current installation will be replaced with backup"
    echo "   - All changes since backup will be lost"
    echo ""
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Rollback cancelled"
        exit 0
    fi
fi

echo ""
echo "🚀 Starting rollback process..."

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

# Step 2: Create emergency backup of current state
echo ""
echo "2️⃣  Creating emergency backup of current state..."
EMERGENCY_BACKUP="$BACKUP_DIR/emergency-backup-$(date +%Y%m%d_%H%M%S)"
cp -r . "$EMERGENCY_BACKUP"
echo "✅ Emergency backup created: $EMERGENCY_BACKUP"

# Step 3: Remove current installation
echo ""
echo "3️⃣  Removing current installation..."
find . -maxdepth 1 -type f -name "*.js" -delete 2>/dev/null || true
find . -maxdepth 1 -type f -name "*.json" -delete 2>/dev/null || true
find . -maxdepth 1 -type f -name "*.md" -delete 2>/dev/null || true
find . -maxdepth 1 -type f -name "*.sh" -delete 2>/dev/null || true
find . -maxdepth 1 -type f -name "*.yml" -delete 2>/dev/null || true
find . -maxdepth 1 -type f -name "*.conf" -delete 2>/dev/null || true
find . -maxdepth 1 -type f -name "Dockerfile" -delete 2>/dev/null || true
find . -maxdepth 1 -type f -name "ecosystem.config.js" -delete 2>/dev/null || true
find . -maxdepth 1 -type f -name "netcontrol.service" -delete 2>/dev/null || true

# Remove directories (except backups)
rm -rf client server logs 2>/dev/null || true

echo "✅ Current installation removed"

# Step 4: Restore from backup
echo ""
echo "4️⃣  Restoring from backup..."
cp -r "$BACKUP_PATH"/* .
echo "✅ Backup restored"

# Step 5: Set permissions
echo ""
echo "5️⃣  Setting permissions..."
chmod +x *.sh 2>/dev/null || true
chmod 755 server/data 2>/dev/null || true
chmod 644 server/data/netcontrol.db 2>/dev/null || true

# Step 6: Start the application
echo ""
echo "6️⃣  Starting application..."
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

echo ""
echo "✅ Rollback completed successfully!"
echo ""
echo "📋 Summary:"
echo "   - Rolled back to: $BACKUP_NAME"
echo "   - Emergency backup created: $EMERGENCY_BACKUP"
echo "   - Application restarted"
echo ""
echo "🔧 Management commands:"
echo "   ./status-production.sh  - Check application status"
echo "   ./stop-production.sh    - Stop application"
echo "   ./start-production.sh   - Start application"