#!/bin/bash

# NetControl Server Setup Script
# This script prepares a fresh Ubuntu server for NetControl deployment

set -e

echo "🚀 Setting up server for NetControl deployment..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
echo "📦 Installing Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install additional dependencies
echo "📦 Installing additional dependencies..."
sudo apt install -y nginx sqlite3 ufw curl wget git

# Install PM2 globally
echo "📦 Installing PM2 process manager..."
sudo npm install -g pm2

# Create netcontrol user
echo "👤 Creating netcontrol user..."
if ! id "netcontrol" &>/dev/null; then
    sudo useradd -m -s /bin/bash netcontrol
    sudo usermod -aG sudo netcontrol
    echo "✅ User 'netcontrol' created"
else
    echo "✅ User 'netcontrol' already exists"
fi

# Create application directory
echo "📁 Creating application directory..."
sudo mkdir -p /opt/netcontrol
sudo chown netcontrol:netcontrol /opt/netcontrol

# Configure firewall
echo "🔥 Configuring firewall..."
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 5000/tcp
sudo ufw --force enable

# Configure Nginx (basic setup)
echo "🌐 Configuring Nginx..."
sudo systemctl enable nginx
sudo systemctl start nginx

# Create SSL directory for future use
sudo mkdir -p /etc/nginx/ssl

echo ""
echo "✅ Server setup completed successfully!"
echo ""
echo "📋 Server Information:"
echo "   - Node.js version: $(node -v)"
echo "   - NPM version: $(npm -v)"
echo "   - PM2 installed: $(pm2 -v)"
echo "   - Nginx status: $(sudo systemctl is-active nginx)"
echo ""
echo "🚀 Next steps:"
echo "1. Upload your NetControl deployment package to /opt/netcontrol"
echo "2. Switch to netcontrol user: sudo su - netcontrol"
echo "3. Extract and deploy the application"
echo ""
echo "📖 For SSL setup, obtain certificates and update nginx.conf"