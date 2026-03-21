#!/bin/bash

# NetControl Cloud Deployment Script
# Supports major cloud providers with automated setup

set -e

CLOUD_PROVIDER=""
INSTANCE_TYPE=""
REGION=""
KEY_NAME=""

show_help() {
    echo "NetControl Cloud Deployment Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -p, --provider PROVIDER    Cloud provider (aws, gcp, azure, digitalocean)"
    echo "  -t, --type TYPE           Instance type (small, medium, large)"
    echo "  -r, --region REGION       Deployment region"
    echo "  -k, --key KEY_NAME        SSH key name"
    echo "  -h, --help               Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --provider digitalocean --type small --region nyc1 --key my-ssh-key"
    echo "  $0 --provider aws --type medium --region us-east-1 --key my-aws-key"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--provider)
            CLOUD_PROVIDER="$2"
            shift 2
            ;;
        -t|--type)
            INSTANCE_TYPE="$2"
            shift 2
            ;;
        -r|--region)
            REGION="$2"
            shift 2
            ;;
        -k|--key)
            KEY_NAME="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option $1"
            show_help
            exit 1
            ;;
    esac
done

if [[ -z "$CLOUD_PROVIDER" ]]; then
    echo "❌ Cloud provider is required"
    show_help
    exit 1
fi

echo "🚀 Deploying NetControl to $CLOUD_PROVIDER..."

# Create cloud-init script
cat > cloud-init.yml << 'EOF'
#cloud-config
package_update: true
package_upgrade: true

packages:
  - curl
  - wget
  - git
  - nginx
  - sqlite3
  - ufw

runcmd:
  # Install Node.js 18.x
  - curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  - apt-get install -y nodejs
  
  # Install PM2
  - npm install -g pm2
  
  # Create netcontrol user
  - useradd -m -s /bin/bash netcontrol
  - usermod -aG sudo netcontrol
  
  # Create application directory
  - mkdir -p /opt/netcontrol
  - chown netcontrol:netcontrol /opt/netcontrol
  
  # Configure firewall
  - ufw --force reset
  - ufw default deny incoming
  - ufw default allow outgoing
  - ufw allow ssh
  - ufw allow 80/tcp
  - ufw allow 443/tcp
  - ufw allow 5000/tcp
  - ufw --force enable
  
  # Start and enable nginx
  - systemctl enable nginx
  - systemctl start nginx
  
  # Download and deploy NetControl (you'll need to update this URL)
  - cd /opt/netcontrol
  - wget -O netcontrol-deploy.tar.gz "YOUR_DEPLOYMENT_PACKAGE_URL"
  - tar -xzf netcontrol-deploy.tar.gz
  - cd netcontrol
  - chown -R netcontrol:netcontrol /opt/netcontrol
  - sudo -u netcontrol ./deploy-server.sh
  - sudo -u netcontrol pm2 start ecosystem.config.js
  - sudo -u netcontrol pm2 startup
  - sudo -u netcontrol pm2 save

write_files:
  - path: /etc/motd
    content: |
      
      🚀 NetControl Web Application Server
      
      Application: http://YOUR_SERVER_IP:5000
      Admin Login: admin / admin123 (CHANGE THIS!)
      
      Commands:
        sudo su - netcontrol    # Switch to app user
        pm2 status             # Check app status
        pm2 logs               # View logs
        pm2 restart all        # Restart app
      
      Documentation: /opt/netcontrol/PRODUCTION.md
      
EOF

case $CLOUD_PROVIDER in
    "digitalocean")
        echo "🌊 Deploying to DigitalOcean..."
        if ! command -v doctl &> /dev/null; then
            echo "❌ doctl CLI not found. Please install it first:"
            echo "https://docs.digitalocean.com/reference/doctl/how-to/install/"
            exit 1
        fi
        
        # Set instance size based on type
        case $INSTANCE_TYPE in
            "small") SIZE="s-1vcpu-1gb" ;;
            "medium") SIZE="s-2vcpu-2gb" ;;
            "large") SIZE="s-4vcpu-8gb" ;;
            *) SIZE="s-1vcpu-1gb" ;;
        esac
        
        echo "Creating DigitalOcean droplet..."
        doctl compute droplet create netcontrol-$(date +%s) \
            --image ubuntu-20-04-x64 \
            --size $SIZE \
            --region ${REGION:-nyc1} \
            --ssh-keys $KEY_NAME \
            --user-data-file cloud-init.yml \
            --wait
        ;;
        
    "aws")
        echo "☁️  Deploying to AWS..."
        if ! command -v aws &> /dev/null; then
            echo "❌ AWS CLI not found. Please install it first:"
            echo "https://aws.amazon.com/cli/"
            exit 1
        fi
        
        # Set instance type based on size
        case $INSTANCE_TYPE in
            "small") INSTANCE_TYPE="t3.micro" ;;
            "medium") INSTANCE_TYPE="t3.small" ;;
            "large") INSTANCE_TYPE="t3.medium" ;;
            *) INSTANCE_TYPE="t3.micro" ;;
        esac
        
        echo "Creating AWS EC2 instance..."
        aws ec2 run-instances \
            --image-id ami-0c02fb55956c7d316 \
            --instance-type $INSTANCE_TYPE \
            --key-name $KEY_NAME \
            --security-group-ids sg-default \
            --user-data file://cloud-init.yml \
            --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=NetControl}]'
        ;;
        
    *)
        echo "❌ Unsupported cloud provider: $CLOUD_PROVIDER"
        echo "Supported providers: digitalocean, aws"
        exit 1
        ;;
esac

echo ""
echo "✅ Cloud deployment initiated!"
echo ""
echo "📋 Next steps:"
echo "1. Wait for the instance to boot and initialize (5-10 minutes)"
echo "2. SSH into your server"
echo "3. Check the application status: sudo su - netcontrol && pm2 status"
echo "4. Access NetControl at: http://YOUR_SERVER_IP:5000"
echo "5. Login with admin/admin123 and change the password!"
echo ""
echo "🔧 Troubleshooting:"
echo "   - Check cloud-init logs: sudo cat /var/log/cloud-init-output.log"
echo "   - Check application logs: sudo su - netcontrol && pm2 logs"

# Clean up
rm -f cloud-init.yml