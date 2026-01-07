# NetControl - AWS Elastic Beanstalk Deployment Guide

## Prerequisites

1. **AWS CLI installed and configured**
   ```bash
   aws configure --profile thejohnweb
   # Enter your AWS credentials when prompted
   ```

2. **EB CLI installed**
   ```bash
   pip install awsebcli
   ```

3. **Verify your AWS profile**
   ```bash
   aws sts get-caller-identity --profile thejohnweb
   ```

## Deployment Steps

### 1. Initialize Elastic Beanstalk Application

```bash
# Initialize EB application (run from project root)
eb init --profile thejohnweb

# When prompted:
# - Application name: netcontrol-web
# - Platform: Node.js 18 running on 64bit Amazon Linux 2023
# - Use CodeCommit: No
# - SSH keypair: Choose existing or create new
```

### 2. Create Environment

```bash
# Create production environment
eb create netcontrol-prod --profile thejohnweb

# Options during creation:
# - Instance type: t3.micro (for cost efficiency)
# - Load balancer: Application Load Balancer
# - Enable Spot Fleet: No (for stability)
```

### 3. Deploy Application

```bash
# Deploy current code
eb deploy --profile thejohnweb

# Monitor deployment
eb logs --profile thejohnweb
```

### 4. Configure Environment Variables (Optional)

```bash
# Set environment variables if needed
eb setenv NODE_ENV=production PORT=8080 --profile thejohnweb
```

### 5. Open Application

```bash
# Open in browser
eb open --profile thejohnweb

# Get URL
eb status --profile thejohnweb
```

## Configuration Files Created

The following files have been created for Elastic Beanstalk:

- **`.ebextensions/01_node_command.config`** - Node.js configuration
- **`.ebextensions/02_nginx.config`** - Nginx proxy configuration  
- **`.ebextensions/03_create_directories.config`** - Directory setup
- **`.elasticbeanstalk/config.yml`** - EB CLI configuration
- **`.ebignore`** - Files to exclude from deployment

## Application Structure for EB

```
netcontrol-web/
├── server/                 # Backend Node.js application
├── client/                 # React frontend (will be built)
├── package.json           # Main package.json with postinstall script
├── .ebextensions/         # EB configuration
└── .elasticbeanstalk/     # EB CLI configuration
```

## How It Works

1. **Build Process**: The `postinstall` script automatically builds the React client
2. **Static Files**: Nginx serves React build files directly
3. **API Routes**: Nginx proxies API requests to Node.js server
4. **Database**: SQLite database created automatically on first run
5. **Uploads**: Directories created with proper permissions

## Monitoring and Management

```bash
# View logs
eb logs --profile thejohnweb

# Check health
eb health --profile thejohnweb

# SSH into instance
eb ssh --profile thejohnweb

# Scale application
eb scale 1 --profile thejohnweb

# Update configuration
eb config --profile thejohnweb
```

## Cost Optimization

- **Instance Type**: t3.micro (~$7.59/month)
- **Auto Scaling**: Disabled for cost savings
- **Load Balancer**: Application LB (required for HTTPS)
- **Storage**: 8GB EBS volume (included)

## Custom Domain Setup (Optional)

1. **Purchase domain** in Route 53 or external registrar
2. **Create hosted zone** in Route 53
3. **Add CNAME record** pointing to EB environment URL
4. **Configure SSL** using AWS Certificate Manager

```bash
# Example CNAME record
netcontrol.yourdomain.com -> netcontrol-prod.us-east-1.elasticbeanstalk.com
```

## Troubleshooting

### Common Issues

1. **Build Failures**
   ```bash
   eb logs --profile thejohnweb
   # Check for npm install or build errors
   ```

2. **Database Permissions**
   ```bash
   eb ssh --profile thejohnweb
   sudo ls -la /var/app/current/server/data/
   ```

3. **Port Configuration**
   - Ensure server listens on `process.env.PORT || 8080`
   - EB automatically sets PORT environment variable

### Health Check

The application includes a health endpoint at `/api/health` that EB uses for monitoring.

## Updates and Maintenance

```bash
# Deploy updates
git add .
git commit -m "Update application"
eb deploy --profile thejohnweb

# Rollback if needed
eb deploy --version-label=previous-version --profile thejohnweb
```

## Environment Termination

```bash
# Terminate environment (saves costs)
eb terminate netcontrol-prod --profile thejohnweb

# Recreate when needed
eb create netcontrol-prod --profile thejohnweb
```

## Security Considerations

- **Default Admin Account**: Change password immediately after deployment
- **HTTPS**: Enable SSL certificate through EB console
- **Security Groups**: EB automatically configures appropriate rules
- **Database**: SQLite file permissions handled by configuration

## Support

- Check EB logs for deployment issues
- Monitor CloudWatch for application metrics
- Use EB console for configuration changes
- SSH access available for debugging

---

**Estimated Monthly Cost**: $9-15 (t3.micro + storage + data transfer)

**Deployment Time**: 5-10 minutes for initial setup, 2-3 minutes for updates