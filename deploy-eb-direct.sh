#!/bin/bash

# Direct Elastic Beanstalk Deployment using AWS CLI
# This script creates and deploys a new application version

set -e

PROFILE="thejohnweb"
REGION="us-east-1"
APP_NAME="netcontrol-web"
ENV_NAME="netcontrol-prod"
TIMESTAMP=$(date +"%y%m%d_%H%M%S")
VERSION_LABEL="app-${TIMESTAMP}"
S3_BUCKET="elasticbeanstalk-${REGION}-156667292120"

echo "🚀 Deploying NetControl with Scheduling System to Elastic Beanstalk..."
echo "   Version: ${VERSION_LABEL}"
echo ""

# Update version file
echo "🔄 Updating version..."
cat > version.js << EOF
// Auto-generated version file
const version = {
  major: '1.5',
  build: '${TIMESTAMP}',
  timestamp: '$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")',
  environment: process.env.NODE_ENV || 'production',
  features: ['Backup/Restore', 'Password Reset', 'Readonly Role', 'NC Statistics', 'Net Scheduling', 'Pre-Check-In', 'QRZ Lookup', 'PostgreSQL Database']
};
module.exports = version;
EOF

echo "✅ Version updated to 1.5.0 (build ${TIMESTAMP})"

# Create deployment package
echo "📦 Creating deployment package..."
ZIP_FILE="${VERSION_LABEL}.zip"

# Create a temporary directory for the package
TEMP_DIR=$(mktemp -d)
echo "   Using temp directory: ${TEMP_DIR}"

# Copy necessary files
echo "   Copying files..."
cp -r server "${TEMP_DIR}/"
mkdir -p "${TEMP_DIR}/client"
# Copy client source files for building on server
cp -r client/src "${TEMP_DIR}/client/"
cp -r client/public "${TEMP_DIR}/client/"
cp client/package.json "${TEMP_DIR}/client/"
cp client/package-lock.json "${TEMP_DIR}/client/" 2>/dev/null || true
# Also copy existing build as fallback
if [ -d client/build ]; then
  cp -r client/build "${TEMP_DIR}/client/"
fi
cp package.json package-lock.json version.js "${TEMP_DIR}/"
cp -r .ebextensions "${TEMP_DIR}/"
cp .ebignore "${TEMP_DIR}/" 2>/dev/null || true
cp Procfile "${TEMP_DIR}/" 2>/dev/null || true

# Create the zip file
echo "   Creating zip archive..."
(cd "${TEMP_DIR}" && zip -r -q "${OLDPWD}/${ZIP_FILE}" .)

# Clean up temp directory
rm -rf "${TEMP_DIR}"

ZIP_SIZE=$(ls -lh "${ZIP_FILE}" | awk '{print $5}')
echo "✅ Package created: ${ZIP_FILE} (${ZIP_SIZE})"

# Upload to S3
echo "�� Uploading to S3..."
aws s3 cp "${ZIP_FILE}" "s3://${S3_BUCKET}/${ZIP_FILE}" \
    --profile "${PROFILE}" \
    --region "${REGION}"

echo "✅ Uploaded to S3"

# Create application version
echo "🔧 Creating application version..."
aws elasticbeanstalk create-application-version \
    --profile "${PROFILE}" \
    --region "${REGION}" \
    --application-name "${APP_NAME}" \
    --version-label "${VERSION_LABEL}" \
    --source-bundle S3Bucket="${S3_BUCKET}",S3Key="${ZIP_FILE}" \
    --description "NetControl v1.5.0 - Build ${TIMESTAMP}" \
    --no-auto-create-application

echo "✅ Application version created"

# Deploy to environment
echo "🚀 Deploying to environment ${ENV_NAME}..."
aws elasticbeanstalk update-environment \
    --profile "${PROFILE}" \
    --region "${REGION}" \
    --environment-name "${ENV_NAME}" \
    --version-label "${VERSION_LABEL}"

echo "✅ Deployment initiated"
echo ""
echo "⏳ Waiting for deployment to complete..."
echo "   This may take 3-5 minutes..."
echo ""

# Wait for environment to be ready
aws elasticbeanstalk wait environment-updated \
    --profile "${PROFILE}" \
    --region "${REGION}" \
    --environment-names "${ENV_NAME}"

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "📊 Environment Status:"
aws elasticbeanstalk describe-environments \
    --profile "${PROFILE}" \
    --region "${REGION}" \
    --environment-names "${ENV_NAME}" \
    --query 'Environments[0].[EnvironmentName,Status,Health,CNAME]' \
    --output table

echo ""
echo "🌐 Application URLs:"
echo "   https://netcontrol-prod.eba-tu7jpbdw.us-east-1.elasticbeanstalk.com"
echo "   https://netcontrol.hamsunite.org"
echo ""
echo "📝 What's New in v1.5.0:"
echo "   ✅ Backup/Restore with S3 integration"
echo "   ✅ Forgot password email reset flow"
echo "   ✅ Read-only user role"
echo "   ✅ NC Statistics report"
echo "   ✅ Net script pop-out with group checklist"
echo "   ✅ Participant search and pre-check-in improvements"
echo "   ✅ Application timezone setting"
echo "   ✅ QRZ session auto-refresh on expiry"
echo ""
echo "💡 To view logs:"
echo "   aws logs tail /aws/elasticbeanstalk/${ENV_NAME}/var/log/eb-engine.log --follow --profile ${PROFILE} --region ${REGION}"
echo ""
echo "🧹 Cleaning up local files..."
rm -f "${ZIP_FILE}"
echo "✅ Cleanup complete"
