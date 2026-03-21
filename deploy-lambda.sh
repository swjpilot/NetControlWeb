#!/bin/bash

# Deploy FCC Database Processor Lambda Function

set -e

echo "🚀 Deploying FCC Database Processor Lambda Function..."

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if AWS profile exists
if ! aws sts get-caller-identity --profile thejohnweb &> /dev/null; then
    echo "❌ AWS profile 'thejohnweb' not found or not configured."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Update version for consistency
echo "🔄 Updating version..."
BUILD_TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
ISO_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

cat > ../version.js << EOF
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

# Build Lambda package
echo "📦 Building Lambda package..."
cd lambda-fcc-processor

# Install dependencies
npm install

# Create deployment package
zip -r fcc-processor.zip . -x "*.git*" "node_modules/.cache/*"

echo "📤 Deploying Lambda function..."

# Create or update Lambda function
FUNCTION_NAME="netcontrol-fcc-processor"
ROLE_ARN="arn:aws:iam::156667292120:role/netcontrol-lambda-execution-role"

# Check if function exists
if aws lambda get-function --function-name $FUNCTION_NAME --profile thejohnweb --region us-east-1 &> /dev/null; then
    echo "🔄 Updating existing Lambda function..."
    aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --zip-file fileb://fcc-processor.zip \
        --profile thejohnweb \
        --region us-east-1 \
        --no-cli-pager
    
    aws lambda update-function-configuration \
        --function-name $FUNCTION_NAME \
        --timeout 900 \
        --memory-size 3008 \
        --ephemeral-storage Size=4096 \
        --environment Variables="{
            DB_HOST=netcontrol-db.cxo7udmbhoo3.us-east-1.rds.amazonaws.com,
            DB_PORT=5432,
            DB_NAME=postgres,
            DB_USER=netcontrol,
            DB_PASSWORD=NetControl2024!,
            LAMBDA_FUNCTION_NAME=netcontrol-fcc-processor
        }" \
        --profile thejohnweb \
        --region us-east-1 \
        --no-cli-pager
else
    echo "🆕 Creating new Lambda function..."
    aws lambda create-function \
        --function-name $FUNCTION_NAME \
        --runtime nodejs20.x \
        --role $ROLE_ARN \
        --handler index.handler \
        --zip-file fileb://fcc-processor.zip \
        --timeout 900 \
        --memory-size 3008 \
        --ephemeral-storage Size=4096 \
        --environment Variables="{
            DB_HOST=netcontrol-db.cxo7udmbhoo3.us-east-1.rds.amazonaws.com,
            DB_PORT=5432,
            DB_NAME=postgres,
            DB_USER=netcontrol,
            DB_PASSWORD=NetControl2024!,
            LAMBDA_FUNCTION_NAME=netcontrol-fcc-processor
        }" \
        --profile thejohnweb \
        --region us-east-1 \
        --no-cli-pager
fi

echo "📊 Creating DynamoDB table for progress tracking..."

# Create DynamoDB table for progress tracking
aws dynamodb create-table \
    --table-name fcc-download-progress \
    --attribute-definitions \
        AttributeName=jobId,AttributeType=S \
    --key-schema \
        AttributeName=jobId,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --profile thejohnweb \
    --region us-east-1 \
    --no-cli-pager 2>/dev/null || echo "Table already exists"

cd ..

echo "🎉 Lambda function deployed successfully!"
echo ""
echo "📋 Function Details:"
echo "   Name: $FUNCTION_NAME"
echo "   Runtime: Node.js 20.x"
echo "   Memory: 3008 MB"
echo "   Timeout: 15 minutes"
echo ""
echo "💡 Next steps:"
echo "   1. Update the web application to use Lambda"
echo "   2. Test the FCC database download"
echo "   3. Monitor CloudWatch logs for any issues"