#!/bin/bash

# NetControl Server Deployment Script
# Run this script on your target server

set -e

echo "🚀 Deploying NetControl Web Application..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version 16+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install dependencies
echo "📦 Installing server dependencies..."
npm install --production

# Create required directories
echo "📁 Creating required directories..."
mkdir -p server/data
mkdir -p server/uploads
mkdir -p server/uploads/audio
mkdir -p server/downloads
mkdir -p logs

# Set permissions
chmod +x start-production.sh
chmod +x stop-production.sh
chmod +x status-production.sh
chmod +x update-production.sh
chmod +x rollback-production.sh
chmod 755 server/database

echo "✅ NetControl deployed successfully!"
echo ""
echo "🚀 To start the application:"
echo "   ./start-production.sh"
echo ""
echo "🛑 To stop the application:"
echo "   ./stop-production.sh"
echo ""
echo "📊 To check status:"
echo "   ./status-production.sh"
echo ""
echo "🌐 The application will be available at: http://your-server-ip:5000"
echo ""
echo "📖 For advanced deployment options, see PRODUCTION.md"
