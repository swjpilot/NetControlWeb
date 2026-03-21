#!/bin/bash

# NetControl Installation Troubleshooting Script
# Run this script on your server to diagnose issues

echo "🔍 NetControl Installation Troubleshooting"
echo "=========================================="
echo "Timestamp: $(date)"
echo "Server: $(hostname)"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check service status
check_service() {
    local service_name="$1"
    if systemctl is-active --quiet "$service_name"; then
        echo "✅ $service_name is running"
    else
        echo "❌ $service_name is not running"
        systemctl status "$service_name" --no-pager -l | head -10
    fi
}

# Function to check port
check_port() {
    local port="$1"
    local service="$2"
    if netstat -tlnp 2>/dev/null | grep -q ":$port "; then
        echo "✅ Port $port is open ($service)"
        netstat -tlnp 2>/dev/null | grep ":$port "
    else
        echo "❌ Port $port is not open ($service)"
    fi
}

# System Information
echo "🖥️  System Information"
echo "====================="
echo "OS: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)"
echo "Kernel: $(uname -r)"
echo "Architecture: $(uname -m)"
echo "Uptime: $(uptime -p)"
echo "Load: $(uptime | awk -F'load average:' '{print $2}')"
echo "Memory: $(free -h | grep Mem | awk '{print $3 "/" $2}')"
echo "Disk: $(df -h / | tail -1 | awk '{print $3 "/" $2 " (" $5 " used)"}')"
echo ""

# Check if we're in NetControl directory
echo "📁 Directory Check"
echo "=================="
echo "Current directory: $(pwd)"
if [ -f "server/index.js" ] && [ -f "package.json" ]; then
    echo "✅ NetControl installation directory detected"
    
    # Check version
    if [ -f "version.js" ]; then
        echo "📦 Version information:"
        node -e "console.log('Version:', require('./version.js').major + '.' + require('./version.js').build)"
    fi
    
    # Check package.json
    if [ -f "package.json" ]; then
        echo "📋 Package info:"
        echo "  Name: $(node -e "console.log(require('./package.json').name)")"
        echo "  Version: $(node -e "console.log(require('./package.json').version)")"
    fi
else
    echo "❌ Not in NetControl installation directory"
    echo "Please run this script from your NetControl installation directory"
    exit 1
fi
echo ""

# Node.js Check
echo "🟢 Node.js Environment"
echo "====================="
if command_exists node; then
    echo "✅ Node.js installed: $(node --version)"
    NODE_MAJOR=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_MAJOR" -ge 16 ]; then
        echo "✅ Node.js version is compatible (>= 16)"
    else
        echo "⚠️  Node.js version may be too old (< 16)"
    fi
else
    echo "❌ Node.js not installed"
fi

if command_exists npm; then
    echo "✅ npm installed: $(npm --version)"
else
    echo "❌ npm not installed"
fi
echo ""

# Dependencies Check
echo "📦 Dependencies Check"
echo "===================="
if [ -f "package.json" ]; then
    if [ -d "node_modules" ]; then
        echo "✅ node_modules directory exists"
        MODULE_COUNT=$(find node_modules -maxdepth 1 -type d | wc -l)
        echo "  Modules installed: $((MODULE_COUNT - 1))"
    else
        echo "❌ node_modules directory missing"
        echo "  Run: npm install --production"
    fi
    
    # Check for critical dependencies
    CRITICAL_DEPS=("express" "sqlite3" "bcrypt" "jsonwebtoken" "nodemailer")
    for dep in "${CRITICAL_DEPS[@]}"; do
        if [ -d "node_modules/$dep" ]; then
            echo "✅ $dep installed"
        else
            echo "❌ $dep missing"
        fi
    done
else
    echo "❌ package.json not found"
fi
echo ""

# Database Check
echo "🗄️  Database Check"
echo "=================="
if [ -f "server/data/netcontrol.db" ]; then
    echo "✅ Database file exists"
    DB_SIZE=$(ls -lh server/data/netcontrol.db | awk '{print $5}')
    echo "  Size: $DB_SIZE"
    
    # Check if database is accessible
    if command_exists sqlite3; then
        TABLE_COUNT=$(sqlite3 server/data/netcontrol.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>/dev/null || echo "0")
        echo "  Tables: $TABLE_COUNT"
        
        # Check for critical tables
        CRITICAL_TABLES=("users" "operators" "sessions" "settings")
        for table in "${CRITICAL_TABLES[@]}"; do
            if sqlite3 server/data/netcontrol.db "SELECT name FROM sqlite_master WHERE type='table' AND name='$table';" 2>/dev/null | grep -q "$table"; then
                echo "  ✅ $table table exists"
            else
                echo "  ❌ $table table missing"
            fi
        done
    else
        echo "  ⚠️  sqlite3 command not available for detailed database check"
    fi
else
    echo "❌ Database file not found at server/data/netcontrol.db"
    echo "  Database will be created on first startup"
fi
echo ""

# Process Check
echo "🔄 Process Check"
echo "==============="
NODE_PROCESSES=$(pgrep -f "node.*server/index.js" | wc -l)
if [ "$NODE_PROCESSES" -gt 0 ]; then
    echo "✅ NetControl processes running: $NODE_PROCESSES"
    pgrep -f "node.*server/index.js" | while read pid; do
        echo "  PID $pid: $(ps -p $pid -o cmd --no-headers)"
    done
else
    echo "❌ No NetControl processes running"
fi

# Check PM2
if command_exists pm2; then
    echo "🔧 PM2 Status:"
    pm2 list | grep -E "(netcontrol|online|stopped|errored)" || echo "  No PM2 processes found"
else
    echo "ℹ️  PM2 not installed"
fi
echo ""

# Port Check
echo "🌐 Network Check"
echo "==============="
check_port 5000 "NetControl"
check_port 80 "HTTP"
check_port 443 "HTTPS"
check_port 22 "SSH"
echo ""

# Service Check
echo "🛠️  Service Check"
echo "================"
if [ -f "/etc/systemd/system/netcontrol.service" ]; then
    echo "✅ systemd service file exists"
    check_service netcontrol
else
    echo "ℹ️  No systemd service configured"
fi

# Check nginx if present
if command_exists nginx; then
    echo "🌐 Nginx Status:"
    check_service nginx
    
    if [ -f "/etc/nginx/sites-enabled/netcontrol" ]; then
        echo "✅ NetControl nginx config exists"
    else
        echo "ℹ️  No NetControl nginx config found"
    fi
else
    echo "ℹ️  Nginx not installed"
fi
echo ""

# File Permissions Check
echo "🔐 Permissions Check"
echo "==================="
if [ -f "server/index.js" ]; then
    PERMS=$(ls -la server/index.js | awk '{print $1}')
    echo "server/index.js: $PERMS"
fi

if [ -d "server/data" ]; then
    PERMS=$(ls -lad server/data | awk '{print $1}')
    echo "server/data/: $PERMS"
fi

if [ -f "server/data/netcontrol.db" ]; then
    PERMS=$(ls -la server/data/netcontrol.db | awk '{print $1}')
    echo "server/data/netcontrol.db: $PERMS"
fi

# Check script permissions
SCRIPTS=("start-production.sh" "stop-production.sh" "status-production.sh")
for script in "${SCRIPTS[@]}"; do
    if [ -f "$script" ]; then
        if [ -x "$script" ]; then
            echo "✅ $script is executable"
        else
            echo "❌ $script is not executable (run: chmod +x $script)"
        fi
    else
        echo "⚠️  $script not found"
    fi
done
echo ""

# Log Check
echo "📋 Log Check"
echo "============"
if [ -d "logs" ]; then
    echo "✅ Logs directory exists"
    LOG_FILES=$(find logs -name "*.log" 2>/dev/null | wc -l)
    echo "  Log files: $LOG_FILES"
    
    # Show recent errors
    if [ -f "logs/combined.log" ]; then
        echo "📄 Recent log entries (last 10 lines):"
        tail -10 logs/combined.log
    elif [ -f "logs/app.log" ]; then
        echo "📄 Recent log entries (last 10 lines):"
        tail -10 logs/app.log
    fi
else
    echo "⚠️  No logs directory found"
fi
echo ""

# Health Check
echo "🏥 Health Check"
echo "==============="
if curl -s http://localhost:5000/api/health >/dev/null 2>&1; then
    echo "✅ Application health check passed"
    HEALTH_RESPONSE=$(curl -s http://localhost:5000/api/health)
    echo "  Response: $HEALTH_RESPONSE"
    
    # Check version endpoint
    if curl -s http://localhost:5000/api/version >/dev/null 2>&1; then
        echo "✅ Version endpoint accessible"
        VERSION_RESPONSE=$(curl -s http://localhost:5000/api/version)
        echo "  Version: $VERSION_RESPONSE"
    else
        echo "⚠️  Version endpoint not accessible"
    fi
else
    echo "❌ Application health check failed"
    echo "  Application may not be running or not accessible on port 5000"
fi
echo ""

# Firewall Check
echo "🔥 Firewall Check"
echo "================="
if command_exists ufw; then
    echo "UFW Status:"
    ufw status | head -10
elif command_exists firewall-cmd; then
    echo "Firewalld Status:"
    firewall-cmd --list-all | head -10
elif command_exists iptables; then
    echo "iptables rules (first 10):"
    iptables -L | head -10
else
    echo "ℹ️  No common firewall tools found"
fi
echo ""

# Disk Space Check
echo "💾 Disk Space Check"
echo "==================="
df -h . | tail -1 | awk '{
    if ($5+0 > 90) 
        print "❌ Disk usage critical: " $5 " used (" $3 "/" $2 ")"
    else if ($5+0 > 80) 
        print "⚠️  Disk usage high: " $5 " used (" $3 "/" $2 ")"
    else 
        print "✅ Disk usage normal: " $5 " used (" $3 "/" $2 ")"
}'

# Check for large files
echo "📁 Large files in current directory:"
find . -type f -size +10M -exec ls -lh {} \; 2>/dev/null | head -5
echo ""

# Summary and Recommendations
echo "📋 TROUBLESHOOTING SUMMARY"
echo "=========================="

# Count issues
ISSUES=0

if ! command_exists node; then
    echo "❌ Install Node.js 16+"
    ISSUES=$((ISSUES + 1))
fi

if [ ! -d "node_modules" ]; then
    echo "❌ Run: npm install --production"
    ISSUES=$((ISSUES + 1))
fi

if [ "$NODE_PROCESSES" -eq 0 ]; then
    echo "❌ Start the application: ./start-production.sh"
    ISSUES=$((ISSUES + 1))
fi

if ! curl -s http://localhost:5000/api/health >/dev/null 2>&1; then
    echo "❌ Application not responding on port 5000"
    ISSUES=$((ISSUES + 1))
fi

if [ "$ISSUES" -eq 0 ]; then
    echo "✅ No major issues detected!"
    echo "🎉 NetControl appears to be running correctly"
else
    echo "⚠️  Found $ISSUES issues that need attention"
fi

echo ""
echo "🔧 Quick Commands:"
echo "  Check status: ./status-production.sh"
echo "  Start app: ./start-production.sh"
echo "  Stop app: ./stop-production.sh"
echo "  View logs: tail -f logs/combined.log"
echo "  Test health: curl http://localhost:5000/api/health"
echo ""
echo "📞 For support, share this output along with your issue description"