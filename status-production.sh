#!/bin/bash

# NetControl Production Status Script

echo "📊 NetControl Web Application Status"
echo "===================================="

RUNNING=false

# Function to check if a process is running
check_process() {
    if pgrep -f "$1" > /dev/null; then
        return 0  # Process found
    else
        return 1  # Process not found
    fi
}

# Check PM2 processes
echo ""
echo "📦 PM2 Status:"
if command -v pm2 &> /dev/null; then
    PM2_PROCESSES=$(pm2 list 2>/dev/null | grep "netcontrol" || echo "")
    if [ ! -z "$PM2_PROCESSES" ]; then
        echo "$PM2_PROCESSES"
        if echo "$PM2_PROCESSES" | grep -q "online"; then
            RUNNING=true
        fi
    else
        echo "   No NetControl PM2 processes found"
    fi
else
    echo "   PM2 not installed"
fi

# Check Docker containers
echo ""
echo "🐳 Docker Status:"
if command -v docker &> /dev/null; then
    DOCKER_CONTAINERS=$(docker ps --filter "name=netcontrol" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "")
    if [ ! -z "$DOCKER_CONTAINERS" ] && [ "$DOCKER_CONTAINERS" != "NAMES	STATUS	PORTS" ]; then
        echo "$DOCKER_CONTAINERS"
        RUNNING=true
    else
        echo "   No NetControl Docker containers running"
    fi
else
    echo "   Docker not installed"
fi

# Check systemd service
echo ""
echo "⚙️  Systemd Service Status:"
if systemctl is-active --quiet netcontrol 2>/dev/null; then
    systemctl status netcontrol --no-pager -l
    RUNNING=true
else
    echo "   NetControl systemd service not running"
fi

# Check Node.js processes
echo ""
echo "🟢 Node.js Processes:"
if check_process "node server/index.js"; then
    echo "   ✅ NetControl server is running"
    ps aux | grep "node server/index.js" | grep -v grep
    RUNNING=true
else
    echo "   ❌ No NetControl server processes found"
fi

# Check port 5000
echo ""
echo "🔌 Port 5000 Status:"
PORT_PROCESSES=$(lsof -ti:5000 2>/dev/null || true)
if [ ! -z "$PORT_PROCESSES" ]; then
    echo "   ✅ Port 5000 is in use by:"
    lsof -i:5000 2>/dev/null || echo "   Unable to get detailed port information"
    RUNNING=true
else
    echo "   ❌ Port 5000 is not in use"
fi

# Check application health
echo ""
echo "🏥 Application Health:"
if curl -s http://localhost:5000/api/health > /dev/null 2>&1; then
    HEALTH_RESPONSE=$(curl -s http://localhost:5000/api/health)
    echo "   ✅ Application is responding"
    echo "   Response: $HEALTH_RESPONSE"
    RUNNING=true
else
    echo "   ❌ Application is not responding on http://localhost:5000"
fi

# Check React development server
echo ""
echo "⚛️  React Development Server:"
if check_process "react-scripts start"; then
    echo "   ✅ React development server is running"
    RUNNING=true
else
    echo "   ❌ React development server is not running"
fi

# Overall status
echo ""
echo "===================================="
if [ "$RUNNING" = true ]; then
    echo "🟢 OVERALL STATUS: NetControl is RUNNING"
    echo ""
    echo "🌐 Access URLs:"
    echo "   - Main Application: http://localhost:5000"
    echo "   - Health Check: http://localhost:5000/api/health"
    if check_process "react-scripts start"; then
        echo "   - Development Server: http://localhost:3000"
    fi
else
    echo "🔴 OVERALL STATUS: NetControl is NOT RUNNING"
    echo ""
    echo "🚀 To start NetControl:"
    echo "   ./start-production.sh"
    echo "   or"
    echo "   pm2 start ecosystem.config.js"
    echo "   or"
    echo "   docker-compose up -d"
fi

echo ""
echo "🔧 Management Commands:"
echo "   ./start-production.sh  - Start NetControl"
echo "   ./stop-production.sh   - Stop NetControl"
echo "   ./status-production.sh - Check status (this script)"

# Show system resources
echo ""
echo "💻 System Resources:"
echo "   Memory Usage: $(free -h | grep '^Mem:' | awk '{print $3 "/" $2}')"
echo "   Disk Usage: $(df -h . | tail -1 | awk '{print $3 "/" $2 " (" $5 " used)"}')"
echo "   Load Average: $(uptime | awk -F'load average:' '{print $2}')"