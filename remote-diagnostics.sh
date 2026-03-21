#!/bin/bash

# Quick Remote Diagnostics for NetControl
# Copy and paste this entire script into your server terminal

echo "🔍 NetControl Quick Diagnostics"
echo "==============================="
echo "Server: $(hostname)"
echo "Time: $(date)"
echo ""

# Basic system check
echo "💻 System:"
echo "  OS: $(cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d'"' -f2 || echo 'Unknown')"
echo "  Load: $(uptime | awk -F'load average:' '{print $2}' | xargs)"
echo "  Memory: $(free -h | grep Mem | awk '{print $3 "/" $2}')"
echo "  Disk: $(df -h . | tail -1 | awk '{print $3 "/" $2 " (" $5 " used)"}')"

# Node.js check
echo ""
echo "🟢 Node.js:"
if command -v node >/dev/null 2>&1; then
    echo "  ✅ Version: $(node --version)"
else
    echo "  ❌ Not installed"
fi

# Directory check
echo ""
echo "📁 Directory: $(pwd)"
if [ -f "server/index.js" ] && [ -f "package.json" ]; then
    echo "  ✅ NetControl directory detected"
    if [ -f "version.js" ]; then
        echo "  📦 Version: $(node -e "try { const v = require('./version.js'); console.log(v.major + '.' + v.build); } catch(e) { console.log('Unknown'); }" 2>/dev/null)"
    fi
else
    echo "  ❌ Not in NetControl directory"
    echo "  Current files: $(ls -1 | head -5 | tr '\n' ' ')"
fi

# Process check
echo ""
echo "🔄 Processes:"
NODE_COUNT=$(pgrep -f "node.*server/index.js" | wc -l)
if [ "$NODE_COUNT" -gt 0 ]; then
    echo "  ✅ NetControl running ($NODE_COUNT processes)"
    pgrep -f "node.*server/index.js" | head -3 | while read pid; do
        echo "    PID $pid: $(ps -p $pid -o pid,ppid,cmd --no-headers 2>/dev/null | awk '{print $1 " " $2 " " substr($0, index($0,$3))}')"
    done
else
    echo "  ❌ NetControl not running"
fi

# Port check
echo ""
echo "🌐 Network:"
if netstat -tlnp 2>/dev/null | grep -q ":5000 "; then
    echo "  ✅ Port 5000 open"
    netstat -tlnp 2>/dev/null | grep ":5000 " | head -1
else
    echo "  ❌ Port 5000 not open"
fi

# Health check
echo ""
echo "🏥 Health Check:"
if curl -s --connect-timeout 5 http://localhost:5000/api/health >/dev/null 2>&1; then
    echo "  ✅ Application responding"
    HEALTH=$(curl -s --connect-timeout 5 http://localhost:5000/api/health 2>/dev/null)
    echo "  Response: $HEALTH"
    
    # Version check
    if curl -s --connect-timeout 5 http://localhost:5000/api/version >/dev/null 2>&1; then
        VERSION=$(curl -s --connect-timeout 5 http://localhost:5000/api/version 2>/dev/null)
        echo "  Version API: $VERSION"
    fi
else
    echo "  ❌ Application not responding"
fi

# Database check
echo ""
echo "🗄️  Database:"
if [ -f "server/data/netcontrol.db" ]; then
    DB_SIZE=$(ls -lh server/data/netcontrol.db | awk '{print $5}')
    echo "  ✅ Database exists ($DB_SIZE)"
else
    echo "  ❌ Database missing"
fi

# Dependencies check
echo ""
echo "📦 Dependencies:"
if [ -d "node_modules" ]; then
    MODULE_COUNT=$(find node_modules -maxdepth 1 -type d 2>/dev/null | wc -l)
    echo "  ✅ node_modules exists ($((MODULE_COUNT - 1)) modules)"
else
    echo "  ❌ node_modules missing - run: npm install --production"
fi

# Recent logs
echo ""
echo "📋 Recent Logs:"
if [ -f "logs/combined.log" ]; then
    echo "  Last 5 log entries:"
    tail -5 logs/combined.log | sed 's/^/    /'
elif [ -f "logs/app.log" ]; then
    echo "  Last 5 log entries:"
    tail -5 logs/app.log | sed 's/^/    /'
else
    echo "  ⚠️  No log files found"
fi

# Quick recommendations
echo ""
echo "🔧 Quick Actions:"
if [ "$NODE_COUNT" -eq 0 ]; then
    echo "  • Start app: ./start-production.sh"
fi
if [ ! -d "node_modules" ]; then
    echo "  • Install deps: npm install --production"
fi
if ! curl -s --connect-timeout 5 http://localhost:5000/api/health >/dev/null 2>&1; then
    echo "  • Check logs: tail -f logs/combined.log"
    echo "  • Check status: ./status-production.sh"
fi

echo ""
echo "📞 For detailed diagnostics, run: ./troubleshoot-installation.sh"
echo "🔍 Diagnostic complete at $(date)"