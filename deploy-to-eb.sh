#!/bin/bash

# NetControl - Elastic Beanstalk Deployment Script
# This script deploys the NetControl application to AWS Elastic Beanstalk

set -e

echo "🚀 Deploying NetControl to AWS Elastic Beanstalk..."

# Check if EB CLI is installed
if ! command -v eb &> /dev/null; then
    echo "❌ EB CLI is not installed. Please install it first:"
    echo "   pip install awsebcli"
    exit 1
fi

# Check if AWS profile exists
if ! aws sts get-caller-identity --profile thejohnweb &> /dev/null; then
    echo "❌ AWS profile 'thejohnweb' not found or not configured."
    echo "   Please run: aws configure --profile thejohnweb"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Update version with new build timestamp
echo "🔄 Updating version..."
BUILD_TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
ISO_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

cat > version.js << EOF
// Auto-generated version file - do not edit manually
const version = {
  major: '1.1',
  build: '${BUILD_TIMESTAMP}',
  timestamp: '${ISO_TIMESTAMP}',
  environment: process.env.NODE_ENV || 'production',
  features: ['FCC Lambda Integration', 'Pre-Check-In', 'QRZ Lookup', 'PostgreSQL Database']
};
module.exports = version;

EOF

echo "✅ Version updated to build ${BUILD_TIMESTAMP}"

# Build the React client
echo "📦 Building React client..."
cd client && npm run build && cd ..

echo "🔧 Checking EB initialization..."
if [ ! -f ".elasticbeanstalk/config.yml" ]; then
    echo "⚠️  EB not initialized. Please run:"
    echo "   eb init --profile thejohnweb"
    echo "   Then run this script again."
    exit 1
fi

# Check if environment exists
echo "🔍 Checking environment status..."
if eb status --profile thejohnweb &> /dev/null; then
    echo "📤 Deploying to existing environment..."
    eb deploy --profile thejohnweb
else
    echo "🆕 Creating new environment..."
    eb create netcontrol-prod --profile thejohnweb --instance-type t3.micro
fi

echo "🎉 Deployment complete!"
echo ""
echo "🌐 Application URLs:"
echo "   EB URL: https://netcontrol-prod.eba-tu7jpbdw.us-east-1.elasticbeanstalk.com"
echo "   Custom domain: https://netcontrol.hamsunite.org"
echo ""
echo "💡 To open the application, visit one of the URLs above or run:"
echo "   eb open --profile thejohnweb"

echo ""
echo "📊 Environment status:"
eb status --profile thejohnweb

echo ""
echo "💡 Useful commands:"
echo "   eb logs --profile thejohnweb          # View logs"
echo "   eb health --profile thejohnweb        # Check health"
echo "   eb ssh --profile thejohnweb           # SSH to instance"
echo "   eb terminate --profile thejohnweb     # Terminate (save costs)"
echo ""
echo "📖 For detailed instructions, see ELASTIC_BEANSTALK_DEPLOYMENT.md"