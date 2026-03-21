#!/bin/bash

# NetControl Production Stop Script

echo "🛑 Stopping NetControl Web Application..."

STOPPED_SOMETHING=false

# Function to check if a process is running
check_process() {
    if pgrep -f "$1" > /dev/null; then
        return 0  # Process found
    else
        return 1  # Process not found
    fi
}

# Stop PM2 processes
echo "🔍 Checking for PM2 processes..."
if command -v pm2 &> /dev/null; then
    PM2_PROCESSES=$(pm2 list 2>/dev/null | grep -c "netcontrol")
    if [ "$PM2_PROCESSES" -gt 0 ]; then
        echo "📦 Stopping PM2 processes..."
        pm2 stop netcontrol 2>/dev/null || true
        pm2 delete netcontrol 2>/dev/null || true
        pm2 stop all 2>/dev/null || true
        echo "✅ PM2 processes stopped"
        STOPPED_SOMETHING=true
    else
        echo "ℹ️  No PM2 processes found"
    fi
else
    echo "ℹ️  PM2 not installed"
fi

# Stop Docker containers
echo "🔍 Checking for Docker containers..."
if command -v docker &> /dev/null; then
    if docker ps | grep -q netcontrol; then
        echo "🐳 Stopping Docker containers..."
        docker-compose down 2>/dev/null || true
        docker stop $(docker ps -q --filter "name=netcontrol") 2>/dev/null || true
        echo "✅ Docker containers stopped"
        STOPPED_SOMETHING=true
    else
        echo "ℹ️  No NetControl Docker containers running"
    fi
else
    echo "ℹ️  Docker not installed"
fi

# Stop systemd service
echo "🔍 Checking for systemd service..."
if systemctl is-active --quiet netcontrol 2>/dev/null; then
    echo "⚙️  Stopping systemd service..."
    sudo systemctl stop netcontrol
    echo "✅ Systemd service stopped"
    STOPPED_SOMETHING=true
else
    echo "ℹ️  No systemd service running"
fi

# Stop Node.js processes (direct)
echo "🔍 Checking for Node.js processes..."
if check_process "node server/index.js"; then
    echo "🟢 Stopping Node.js server processes..."
    pkill -f "node server/index.js" 2>/dev/null || true
    sleep 2
    
    # Force kill if still running
    if check_process "node server/index.js"; then
        echo "⚠️  Force killing remaining processes..."
        pkill -9 -f "node server/index.js" 2>/dev/null || true
    fi
    echo "✅ Node.js processes stopped"
    STOPPED_SOMETHING=true
else
    echo "ℹ️  No Node.js server processes found"
fi

# Stop any processes using port 5000
echo "🔍 Checking for processes on port 5000..."
PORT_PROCESSES=$(lsof -ti:5000 2>/dev/null || true)
if [ ! -z "$PORT_PROCESSES" ]; then
    echo "🔌 Stopping processes on port 5000..."
    echo "$PORT_PROCESSES" | xargs kill 2>/dev/null || true
    sleep 2
    
    # Force kill if still running
    REMAINING_PROCESSES=$(lsof -ti:5000 2>/dev/null || true)
    if [ ! -z "$REMAINING_PROCESSES" ]; then
        echo "⚠️  Force killing processes on port 5000..."
        echo "$REMAINING_PROCESSES" | xargs kill -9 2>/dev/null || true
    fi
    echo "✅ Port 5000 processes stopped"
    STOPPED_SOMETHING=true
else
    echo "ℹ️  No processes found on port 5000"
fi

# Stop React development server (if running)
echo "🔍 Checking for React development server..."
if check_process "react-scripts start"; then
    echo "⚛️  Stopping React development server..."
    pkill -f "react-scripts start" 2>/dev/null || true
    echo "✅ React development server stopped"
    STOPPED_SOMETHING=true
else
    echo "ℹ️  No React development server found"
fi

# Stop any remaining NetControl processes
echo "🔍 Checking for other NetControl processes..."
NETCONTROL_PROCESSES=$(pgrep -f "netcontrol" 2>/dev/null || true)
if [ ! -z "$NETCONTROL_PROCESSES" ]; then
    echo "🔧 Stopping remaining NetControl processes..."
    echo "$NETCONTROL_PROCESSES" | xargs kill 2>/dev/null || true
    sleep 2
    
    # Force kill if still running
    REMAINING_NETCONTROL=$(pgrep -f "netcontrol" 2>/dev/null || true)
    if [ ! -z "$REMAINING_NETCONTROL" ]; then
        echo "⚠️  Force killing remaining NetControl processes..."
        echo "$REMAINING_NETCONTROL" | xargs kill -9 2>/dev/null || true
    fi
    echo "✅ NetControl processes stopped"
    STOPPED_SOMETHING=true
fi

echo ""

# Final status check
if [ "$STOPPED_SOMETHING" = true ]; then
    echo "✅ NetControl has been stopped successfully!"
    echo ""
    echo "📋 Status Check:"
    
    # Check if anything is still running
    if check_process "node server/index.js"; then
        echo "⚠️  Warning: Some Node.js processes may still be running"
    else
        echo "✅ No Node.js server processes running"
    fi
    
    PORT_CHECK=$(lsof -ti:5000 2>/dev/null || true)
    if [ ! -z "$PORT_CHECK" ]; then
        echo "⚠️  Warning: Port 5000 may still be in use"
    else
        echo "✅ Port 5000 is free"
    fi
    
    if command -v pm2 &> /dev/null; then
        PM2_STATUS=$(pm2 list 2>/dev/null | grep -c "online" || echo "0")
        if [ "$PM2_STATUS" -gt 0 ]; then
            echo "ℹ️  PM2 has $PM2_STATUS other processes still running"
        else
            echo "✅ No PM2 processes running"
        fi
    fi
    
else
    echo "ℹ️  NetControl was not running or no processes were found to stop"
fi

echo ""
echo "🚀 To start NetControl again, run:"
echo "   ./start-production.sh"
echo "   or"
echo "   pm2 start ecosystem.config.js"
echo "   or"
echo "   docker-compose up -d"