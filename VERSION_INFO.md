# NetControl Version System

## Overview

NetControl now includes a version footer in the navigation sidebar that displays the current version and build information. This helps with troubleshooting and deployment tracking.

## Version Display

The version footer appears at the bottom of the navigation sidebar and shows:
- **Version**: Major version (e.g., "v1.0.20260106_144954")
- **Clickable**: Click to expand for detailed information

## Detailed Information

When clicked, the version footer expands to show:
- **Version**: Major version number (e.g., "1.0")
- **Build**: Build timestamp (e.g., "20260106_144954")
- **Environment**: Current environment (production/development)
- **Built**: Build date in readable format

## Version Generation

### Automatic Build Numbers
Build numbers are automatically generated during the deployment package creation:
- Format: `YYYYMMDD_HHMMSS`
- Example: `20260106_144954` (January 6, 2026 at 14:49:54)

### Version File
The `version.js` file is auto-generated during `deploy-package.sh`:
```javascript
const version = {
  major: '1.0',
  build: '20260106_144954',
  timestamp: '2026-01-06T19:49:54.177Z',
  environment: process.env.NODE_ENV || 'production'
};
```

## API Endpoint

Version information is available via API:
```bash
GET /api/version
```

Response:
```json
{
  "major": "1.0",
  "build": "20260106_144954", 
  "timestamp": "2026-01-06T19:49:54.177Z",
  "environment": "production"
}
```

## Deployment Integration

### Deploy Package Script
The `deploy-package.sh` script automatically:
1. Generates a unique build number
2. Creates `version.js` with build info
3. Includes version file in deployment package
4. Builds client with version information

### Update Process
When updating an existing installation:
1. New version info is included in the package
2. Version footer updates automatically
3. Users can verify the update was successful

## Styling

The version footer includes:
- **Light/Dark Theme Support**: Adapts to current theme
- **Hover Effects**: Visual feedback on interaction
- **Smooth Animations**: Fade-in effect for details
- **Compact Design**: Minimal space usage

## Troubleshooting

### Version Not Showing
1. Check if client was rebuilt: `npm run build`
2. Verify server restart after deployment
3. Clear browser cache (Ctrl+F5)

### Wrong Version Displayed
1. Ensure `version.js` exists in root directory
2. Check API endpoint: `curl http://localhost:5000/api/version`
3. Verify deployment package included version file

### API Errors
If version API fails, fallback version is used:
- Major version from `package.json`
- Build number as current date
- Environment as 'development'

## Development vs Production

### Development
- Version shows current date as build number
- Environment shows 'development'
- Version file may not exist (uses fallback)

### Production
- Version shows actual build timestamp
- Environment shows 'production'
- Version file generated during deployment

## Future Enhancements

Potential future additions:
- Git commit hash in build info
- Changelog integration
- Update notifications
- Version comparison features
- Deployment history tracking

## Usage Examples

### Check Current Version
Look at the bottom of the navigation sidebar for version info.

### Verify Deployment
After updating, click the version footer to confirm:
- Build number matches deployment package
- Environment shows 'production'
- Build date is recent

### Troubleshooting Issues
Include version information when reporting issues:
- Version: 1.0
- Build: 20260106_144954
- Environment: production
- Browser: Chrome/Firefox/Safari

This helps identify which version is experiencing issues and whether updates are needed.