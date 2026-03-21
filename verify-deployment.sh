#!/bin/bash

# Script to verify deployment package contents
# This helps ensure all necessary files are included

PACKAGE_FILE="$1"

if [ -z "$PACKAGE_FILE" ]; then
    echo "Usage: $0 <package-file.tar.gz>"
    echo "Example: $0 netcontrol-20260106_145231.tar.gz"
    exit 1
fi

if [ ! -f "$PACKAGE_FILE" ]; then
    echo "❌ Package file not found: $PACKAGE_FILE"
    exit 1
fi

echo "🔍 Verifying deployment package: $PACKAGE_FILE"
echo "=================================================="

# Extract package info
PACKAGE_SIZE=$(ls -lh "$PACKAGE_FILE" | awk '{print $5}')
FILE_COUNT=$(tar -tzf "$PACKAGE_FILE" | wc -l)

echo "📦 Package size: $PACKAGE_SIZE"
echo "📁 Total files: $FILE_COUNT"
echo ""

# Check critical files
echo "🔍 Checking critical files..."

CRITICAL_FILES=(
    "netcontrol/package.json"
    "netcontrol/version.js"
    "netcontrol/server/index.js"
    "netcontrol/server/database/db.js"
    "netcontrol/server/utils/emailService.js"
    "netcontrol/client/build/index.html"
    "netcontrol/start-production.sh"
    "netcontrol/stop-production.sh"
    "netcontrol/update-production.sh"
    "netcontrol/rollback-production.sh"
    "netcontrol/deploy-server.sh"
    "netcontrol/nginx.conf"
    "netcontrol/ecosystem.config.js"
    "netcontrol/docker-compose.yml"
    "netcontrol/Dockerfile"
    "netcontrol/netcontrol.service"
)

MISSING_FILES=()
for file in "${CRITICAL_FILES[@]}"; do
    if tar -tzf "$PACKAGE_FILE" | grep -q "^$file$"; then
        echo "✅ $file"
    else
        echo "❌ $file"
        MISSING_FILES+=("$file")
    fi
done

echo ""

# Check documentation files
echo "📚 Checking documentation files..."
DOC_FILES=(
    "netcontrol/README.md"
    "netcontrol/PRODUCTION.md"
    "netcontrol/UPDATE.md"
    "netcontrol/DEPLOYMENT.md"
    "netcontrol/EMAIL_SETUP.md"
    "netcontrol/VERSION_INFO.md"
    "netcontrol/DATABASE_MIGRATION_INFO.md"
    "netcontrol/INSTALL.md"
    "netcontrol/.env.example"
)

MISSING_DOCS=()
for file in "${DOC_FILES[@]}"; do
    if tar -tzf "$PACKAGE_FILE" | grep -q "^$file$"; then
        echo "✅ $file"
    else
        echo "❌ $file"
        MISSING_DOCS+=("$file")
    fi
done

echo ""

# Check server routes
echo "🛣️  Checking server routes..."
ROUTE_FILES=(
    "netcontrol/server/routes/auth.js"
    "netcontrol/server/routes/fcc.js"
    "netcontrol/server/routes/operators.js"
    "netcontrol/server/routes/qrz.js"
    "netcontrol/server/routes/reports.js"
    "netcontrol/server/routes/sessions.js"
    "netcontrol/server/routes/settings.js"
    "netcontrol/server/routes/preCheckIn.js"
)

MISSING_ROUTES=()
for file in "${ROUTE_FILES[@]}"; do
    if tar -tzf "$PACKAGE_FILE" | grep -q "^$file$"; then
        echo "✅ $file"
    else
        echo "❌ $file"
        MISSING_ROUTES+=("$file")
    fi
done

echo ""

# Check client build files
echo "🌐 Checking client build files..."
CLIENT_FILES=(
    "netcontrol/client/build/index.html"
    "netcontrol/client/build/static/js/"
    "netcontrol/client/build/static/css/"
    "netcontrol/client/package.json"
)

MISSING_CLIENT=()
for file in "${CLIENT_FILES[@]}"; do
    if tar -tzf "$PACKAGE_FILE" | grep -q "$file"; then
        echo "✅ $file"
    else
        echo "❌ $file"
        MISSING_CLIENT+=("$file")
    fi
done

echo ""

# Summary
echo "📋 VERIFICATION SUMMARY"
echo "======================="

TOTAL_MISSING=$((${#MISSING_FILES[@]} + ${#MISSING_DOCS[@]} + ${#MISSING_ROUTES[@]} + ${#MISSING_CLIENT[@]}))

if [ $TOTAL_MISSING -eq 0 ]; then
    echo "✅ All critical files are present!"
    echo "📦 Package is ready for deployment"
else
    echo "❌ Missing $TOTAL_MISSING files:"
    
    if [ ${#MISSING_FILES[@]} -gt 0 ]; then
        echo ""
        echo "Critical files missing:"
        for file in "${MISSING_FILES[@]}"; do
            echo "  - $file"
        done
    fi
    
    if [ ${#MISSING_DOCS[@]} -gt 0 ]; then
        echo ""
        echo "Documentation files missing:"
        for file in "${MISSING_DOCS[@]}"; do
            echo "  - $file"
        done
    fi
    
    if [ ${#MISSING_ROUTES[@]} -gt 0 ]; then
        echo ""
        echo "Route files missing:"
        for file in "${MISSING_ROUTES[@]}"; do
            echo "  - $file"
        done
    fi
    
    if [ ${#MISSING_CLIENT[@]} -gt 0 ]; then
        echo ""
        echo "Client files missing:"
        for file in "${MISSING_CLIENT[@]}"; do
            echo "  - $file"
        done
    fi
    
    echo ""
    echo "⚠️  Package may not deploy correctly"
fi

echo ""

# Additional checks
echo "🔍 Additional Information"
echo "========================"

# Check for database files (should not be present)
DB_FILES=$(tar -tzf "$PACKAGE_FILE" | grep -E '\.db$' | wc -l)
if [ $DB_FILES -gt 0 ]; then
    echo "⚠️  Found $DB_FILES database files (these should be excluded)"
    tar -tzf "$PACKAGE_FILE" | grep -E '\.db$' | head -5
else
    echo "✅ No database files found (correct)"
fi

# Check for node_modules (should not be present)
NODE_MODULES=$(tar -tzf "$PACKAGE_FILE" | grep node_modules | wc -l)
if [ $NODE_MODULES -gt 0 ]; then
    echo "⚠️  Found $NODE_MODULES node_modules files (these should be excluded)"
else
    echo "✅ No node_modules found (correct)"
fi

# Check JavaScript/CSS files
JS_FILES=$(tar -tzf "$PACKAGE_FILE" | grep -E '\.js$' | grep -v node_modules | wc -l)
CSS_FILES=$(tar -tzf "$PACKAGE_FILE" | grep -E '\.css$' | grep -v node_modules | wc -l)

echo "📊 File counts:"
echo "   JavaScript files: $JS_FILES"
echo "   CSS files: $CSS_FILES"
echo "   Total files: $FILE_COUNT"

echo ""
echo "🎯 Deployment package verification complete!"