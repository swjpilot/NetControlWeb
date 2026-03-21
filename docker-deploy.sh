#!/bin/bash

# NetControl Docker Deployment Script

set -e

echo "🐳 Deploying NetControl with Docker..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Installing Docker..."
    
    # Install Docker
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    
    echo "✅ Docker installed. Please log out and back in, then run this script again."
    exit 0
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "📦 Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

echo "✅ Docker and Docker Compose are ready"

# Build the React client
echo "📦 Building React client..."
cd client && npm run build && cd ..

# Build and start with Docker Compose
echo "🚀 Building and starting NetControl with Docker..."
docker-compose up -d --build

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 10

# Check if services are running
if docker-compose ps | grep -q "Up"; then
    echo "✅ NetControl is running with Docker!"
    echo ""
    echo "🌐 Access the application at:"
    echo "   - Direct: http://localhost:5000"
    echo "   - Via Nginx: http://localhost"
    echo ""
    echo "📊 Default admin credentials:"
    echo "   - Username: admin"
    echo "   - Password: admin123"
    echo "   - ⚠️  Change the password after first login!"
    echo ""
    echo "🔧 Docker commands:"
    echo "   - View logs: docker-compose logs -f"
    echo "   - Stop: docker-compose down"
    echo "   - Restart: docker-compose restart"
    echo "   - Update: docker-compose up -d --build"
else
    echo "❌ Failed to start NetControl services"
    echo "Check logs with: docker-compose logs"
    exit 1
fi