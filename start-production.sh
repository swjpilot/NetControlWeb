#!/bin/bash

# NetControl Production Startup Script

echo "🚀 Starting NetControl in Production Mode..."

# Stop any existing processes
echo "Stopping existing processes..."
pkill -f "node server/index.js" 2>/dev/null || true
pkill -f "react-scripts start" 2>/dev/null || true

# Build the client if not already built
if [ ! -d "client/build" ]; then
    echo "📦 Building React client..."
    cd client && npm run build && cd ..
fi

# Start the server in production mode
echo "🖥️  Starting server on port 5000..."
NODE_ENV=production node server/index.js &

# Wait a moment for server to start
sleep 2

echo "✅ NetControl is running in production mode!"
echo "🌐 Access the application at: http://localhost:5000"
echo ""
echo "🔧 Management commands:"
echo "   ./stop-production.sh   - Stop the application"
echo "   ./status-production.sh - Check application status"