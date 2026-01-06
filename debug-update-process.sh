#!/bin/bash

# Debug script to trace what happens during update process
# Run this BEFORE running the update to capture the current state

echo "🔍 NetControl Update Process Debug"
echo "=================================="
echo "Server: $(hostname)"
echo "Time: $(date)"
echo ""

if [ ! -f "server/index.js" ] || [ ! -f "package.json" ]; then
    echo "❌ Not in NetControl installation directory"
    exit 1
fi

echo "📁 Current directory: $(pwd)"
echo ""

# Capture current state
echo "📊 BEFORE UPDATE STATE"
echo "======================"

# Current version
if [ -f "version.js" ]; then
    CURRENT_VERSION=$(node -e "try { const v = require('./version.js'); console.log(v.major + '.' + v.build); } catch(e) { console.log('unknown'); }")
    echo "Current version: $CURRENT_VERSION"
else
    echo "Current version: No version file"
fi

# Current client build
if [ -f "client/build/index.html" ]; then
    CURRENT_MAIN_JS=$(find client/build/static/js -name "main.*.js" | head -1)
    if [ -n "$CURRENT_MAIN_JS" ]; then
        CURRENT_JS_NAME=$(basename "$CURRENT_MAIN_JS")
        CURRENT_JS_SIZE=$(ls -lh "$CURRENT_MAIN_JS" | awk '{print $5}')
        echo "Current JS: $CURRENT_JS_NAME ($CURRENT_JS_SIZE)"
        
        # Check for specific features
        if grep -q "From Call Sign / Operator Search" "$CURRENT_MAIN_JS"; then
            echo "  ✅ Has traffic form enhancements"
        else
            echo "  ❌ Missing traffic form enhancements"
        fi
        
        if grep -q "smtp_no_auth" "$CURRENT_MAIN_JS"; then
            echo "  ✅ Has email enhancements"
        else
            echo "  ❌ Missing email enhancements"
        fi
    fi
else
    echo "No current client build"
fi

# Current server files
echo ""
echo "📋 Current server files:"
echo "  server/index.js: $(ls -lh server/index.js | awk '{print $5}')"
echo "  server/database/db.js: $(ls -lh server/database/db.js | awk '{print $5}')"
if [ -f "server/utils/emailService.js" ]; then
    echo "  server/utils/emailService.js: $(ls -lh server/utils/emailService.js | awk '{print $5}')"
else
    echo "  server/utils/emailService.js: MISSING"
fi

# Process status
echo ""
echo "🔄 Process status:"
NODE_PROCESSES=$(pgrep -f "node.*server/index.js" | wc -l)
echo "  NetControl processes: $NODE_PROCESSES"

# Disk space
echo ""
echo "💾 Disk space:"
df -h . | tail -1 | awk '{print "  Available: " $4 " (" $5 " used)"}'

echo ""
echo "🎯 UPDATE DEBUGGING TIPS"
echo "========================"
echo ""
echo "1. BEFORE running update, save this output:"
echo "   ./debug-update-process.sh > before-update.log"
echo ""
echo "2. RUN the update with verbose output:"
echo "   ./update-production.sh --force your-package.tar.gz 2>&1 | tee update-process.log"
echo ""
echo "3. AFTER update, check what changed:"
echo "   ./verify-deployment-changes.sh > after-update.log"
echo ""
echo "4. COMPARE the logs to see what happened:"
echo "   diff before-update.log after-update.log"
echo ""
echo "5. CHECK for common issues:"

# Check for common update issues
echo ""
echo "🔍 Common Update Issues Check"
echo "============================"

# Check if backup directory exists and has space
if [ -d "backups" ]; then
    BACKUP_COUNT=$(ls -1 backups/ | wc -l)
    BACKUP_SIZE=$(du -sh backups/ | cut -f1)
    echo "✅ Backup directory exists ($BACKUP_COUNT backups, $BACKUP_SIZE total)"
else
    echo "⚠️  No backup directory (will be created)"
fi

# Check for old update packages
OLD_PACKAGES=$(find . -maxdepth 1 -name "netcontrol-*.tar.gz" | wc -l)
if [ "$OLD_PACKAGES" -gt 0 ]; then
    echo "⚠️  Found $OLD_PACKAGES old package files:"
    find . -maxdepth 1 -name "netcontrol-*.tar.gz" -exec ls -lh {} \;
    echo "  Consider cleaning these up to save space"
fi

# Check permissions
echo ""
echo "🔐 Permission check:"
if [ -x "update-production.sh" ]; then
    echo "✅ update-production.sh is executable"
else
    echo "❌ update-production.sh is not executable (run: chmod +x update-production.sh)"
fi

if [ -x "start-production.sh" ]; then
    echo "✅ start-production.sh is executable"
else
    echo "❌ start-production.sh is not executable"
fi

# Check for rsync (used in improved update script)
if command -v rsync >/dev/null 2>&1; then
    echo "✅ rsync available (efficient backups)"
else
    echo "⚠️  rsync not available (will use cp fallback)"
fi

echo ""
echo "📞 If update fails, share these files:"
echo "  - before-update.log"
echo "  - update-process.log" 
echo "  - after-update.log"
echo "  - Any error messages"
echo ""
echo "🚀 Ready to debug update process!"
echo "Run the update with: ./update-production.sh --force package.tar.gz 2>&1 | tee update-process.log"