#!/bin/bash

# Script to verify specific changes are deployed correctly
# Run this on your server after deployment/update

echo "🔍 NetControl Deployment Changes Verification"
echo "=============================================="
echo "Server: $(hostname)"
echo "Time: $(date)"
echo ""

# Check if we're in NetControl directory
if [ ! -f "server/index.js" ] || [ ! -f "package.json" ]; then
    echo "❌ Not in NetControl installation directory"
    echo "Please run this script from your NetControl installation directory"
    exit 1
fi

echo "📁 Current directory: $(pwd)"
echo ""

# Check version information
echo "📦 Version Check"
echo "==============="
if [ -f "version.js" ]; then
    echo "✅ version.js exists"
    VERSION_INFO=$(node -e "try { const v = require('./version.js'); console.log('Version: ' + v.major + '.' + v.build + ' (Built: ' + v.timestamp + ')'); } catch(e) { console.log('Error reading version: ' + e.message); }")
    echo "  $VERSION_INFO"
else
    echo "❌ version.js missing"
fi
echo ""

# Check server changes
echo "🖥️  Server Changes"
echo "=================="

# Check for email service
if [ -f "server/utils/emailService.js" ]; then
    echo "✅ EmailService exists"
    if grep -q "smtp_no_auth" server/utils/emailService.js; then
        echo "  ✅ Contains no-auth email support"
    else
        echo "  ❌ Missing no-auth email support"
    fi
else
    echo "❌ EmailService missing"
fi

# Check settings route for email changes
if [ -f "server/routes/settings.js" ]; then
    echo "✅ Settings route exists"
    if grep -q "smtp_no_auth" server/routes/settings.js; then
        echo "  ✅ Contains no-auth email settings"
    else
        echo "  ❌ Missing no-auth email settings"
    fi
    if grep -q "/api/version" server/index.js; then
        echo "  ✅ Version API endpoint present"
    else
        echo "  ❌ Version API endpoint missing"
    fi
else
    echo "❌ Settings route missing"
fi

# Check database migrations
if [ -f "server/database/db.js" ]; then
    echo "✅ Database module exists"
    if grep -q "runMigrations" server/database/db.js; then
        echo "  ✅ Contains migration system"
    else
        echo "  ❌ Missing migration system"
    fi
    if grep -q "smtp_no_auth" server/database/db.js; then
        echo "  ✅ Contains email no-auth migration"
    else
        echo "  ❌ Missing email no-auth migration"
    fi
else
    echo "❌ Database module missing"
fi
echo ""

# Check client changes
echo "🌐 Client Changes"
echo "================="

if [ -f "client/build/index.html" ]; then
    echo "✅ Client build exists"
    
    # Check for main JS file
    MAIN_JS=$(find client/build/static/js -name "main.*.js" | head -1)
    if [ -n "$MAIN_JS" ]; then
        echo "✅ Main JS file: $(basename $MAIN_JS)"
        
        # Check for version footer
        if grep -q "version-footer\|VersionFooter" "$MAIN_JS"; then
            echo "  ✅ Version footer component present"
        else
            echo "  ❌ Version footer component missing"
        fi
        
        # Check for email settings enhancements
        if grep -q "smtp_no_auth\|No authentication required" "$MAIN_JS"; then
            echo "  ✅ Email no-auth settings present"
        else
            echo "  ❌ Email no-auth settings missing"
        fi
        
        # Check for traffic form enhancements
        if grep -q "From Call Sign / Operator Search\|To Call Sign / Operator Search" "$MAIN_JS"; then
            echo "  ✅ Traffic form enhancements present"
        else
            echo "  ❌ Traffic form enhancements missing"
        fi
        
        # Check for autocomplete containers (should be 3: participant + 2 traffic)
        AUTOCOMPLETE_COUNT=$(grep -o "autocomplete-container" "$MAIN_JS" | wc -l)
        echo "  📊 Autocomplete containers: $AUTOCOMPLETE_COUNT (expected: 3)"
        if [ "$AUTOCOMPLETE_COUNT" -ge 3 ]; then
            echo "    ✅ Traffic form autocomplete likely present"
        else
            echo "    ❌ Traffic form autocomplete likely missing"
        fi
        
    else
        echo "❌ Main JS file not found"
    fi
    
    # Check CSS file
    MAIN_CSS=$(find client/build/static/css -name "main.*.css" | head -1)
    if [ -n "$MAIN_CSS" ]; then
        echo "✅ Main CSS file: $(basename $MAIN_CSS)"
        if grep -q "version-footer\|version-info" "$MAIN_CSS"; then
            echo "  ✅ Version footer styles present"
        else
            echo "  ❌ Version footer styles missing"
        fi
    else
        echo "❌ Main CSS file not found"
    fi
    
else
    echo "❌ Client build missing"
fi
echo ""

# Check running application
echo "🏥 Application Status"
echo "===================="

# Check if app is running
if pgrep -f "node.*server/index.js" > /dev/null; then
    echo "✅ NetControl is running"
    
    # Check version API
    if curl -s --connect-timeout 5 http://localhost:5000/api/version >/dev/null 2>&1; then
        echo "✅ Version API responding"
        VERSION_API=$(curl -s --connect-timeout 5 http://localhost:5000/api/version 2>/dev/null)
        echo "  Response: $VERSION_API"
    else
        echo "❌ Version API not responding"
    fi
    
    # Check health API
    if curl -s --connect-timeout 5 http://localhost:5000/api/health >/dev/null 2>&1; then
        echo "✅ Health API responding"
    else
        echo "❌ Health API not responding"
    fi
    
else
    echo "❌ NetControl not running"
    echo "  Try: ./start-production.sh"
fi
echo ""

# Check database for migrations
echo "🗄️  Database Status"
echo "=================="

if [ -f "server/data/netcontrol.db" ]; then
    echo "✅ Database file exists"
    
    # Check if sqlite3 is available
    if command -v sqlite3 >/dev/null 2>&1; then
        # Check for migrations table
        if sqlite3 server/data/netcontrol.db "SELECT name FROM sqlite_master WHERE type='table' AND name='migrations';" 2>/dev/null | grep -q "migrations"; then
            echo "✅ Migrations table exists"
            
            # Check for specific migrations
            MIGRATION_COUNT=$(sqlite3 server/data/netcontrol.db "SELECT COUNT(*) FROM migrations;" 2>/dev/null || echo "0")
            echo "  📊 Applied migrations: $MIGRATION_COUNT"
            
            if [ "$MIGRATION_COUNT" -gt 0 ]; then
                echo "  📋 Migration details:"
                sqlite3 server/data/netcontrol.db "SELECT version, description, executed_at FROM migrations ORDER BY executed_at;" 2>/dev/null | while read line; do
                    echo "    $line"
                done
            fi
            
            # Check for smtp_no_auth setting
            if sqlite3 server/data/netcontrol.db "SELECT value FROM settings WHERE key='smtp_no_auth';" 2>/dev/null | grep -q "false\|true"; then
                SMTP_NO_AUTH=$(sqlite3 server/data/netcontrol.db "SELECT value FROM settings WHERE key='smtp_no_auth';" 2>/dev/null)
                echo "  ✅ smtp_no_auth setting: $SMTP_NO_AUTH"
            else
                echo "  ❌ smtp_no_auth setting missing"
            fi
            
        else
            echo "❌ Migrations table missing"
        fi
    else
        echo "⚠️  sqlite3 not available for database inspection"
    fi
else
    echo "❌ Database file missing"
fi
echo ""

# Summary
echo "📋 DEPLOYMENT VERIFICATION SUMMARY"
echo "=================================="

# Count issues
ISSUES=0

# Check critical components
if [ ! -f "server/utils/emailService.js" ]; then
    echo "❌ EmailService missing"
    ISSUES=$((ISSUES + 1))
fi

if [ ! -f "version.js" ]; then
    echo "❌ Version file missing"
    ISSUES=$((ISSUES + 1))
fi

if [ ! -f "client/build/index.html" ]; then
    echo "❌ Client build missing"
    ISSUES=$((ISSUES + 1))
fi

MAIN_JS=$(find client/build/static/js -name "main.*.js" 2>/dev/null | head -1)
if [ -n "$MAIN_JS" ]; then
    if ! grep -q "From Call Sign / Operator Search" "$MAIN_JS"; then
        echo "❌ Traffic form enhancements not deployed"
        ISSUES=$((ISSUES + 1))
    fi
    
    if ! grep -q "smtp_no_auth" "$MAIN_JS"; then
        echo "❌ Email enhancements not deployed"
        ISSUES=$((ISSUES + 1))
    fi
fi

if ! pgrep -f "node.*server/index.js" > /dev/null; then
    echo "❌ Application not running"
    ISSUES=$((ISSUES + 1))
fi

if [ "$ISSUES" -eq 0 ]; then
    echo "✅ All major components appear to be deployed correctly!"
    echo "🎉 Deployment verification passed"
else
    echo "⚠️  Found $ISSUES issues that need attention"
    echo ""
    echo "🔧 Recommended actions:"
    echo "  1. If client changes missing: Clear browser cache (Ctrl+F5)"
    echo "  2. If server changes missing: Check update process completed"
    echo "  3. If app not running: ./start-production.sh"
    echo "  4. If database issues: Check migration logs"
fi

echo ""
echo "📞 For support, share this output along with:"
echo "  - What changes you expected to see"
echo "  - What update/deployment process you used"
echo "  - Any error messages during update"