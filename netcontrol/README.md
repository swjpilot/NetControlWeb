# NetControl - Ham Radio Net Management System

A comprehensive web-based system for managing amateur radio net sessions, participants, and traffic records.

## Quick Start

### For Users
1. **Download** the latest release package
2. **Extract** and run `./deploy-server.sh`
3. **Access** the web interface at `http://localhost:3001`
4. **Login** with `admin` / `admin123` (change immediately)

### For Developers
```bash
git clone <repository>
cd netcontrol
npm install
npm run dev
```

## Documentation

- **[docs/FEATURES.md](docs/FEATURES.md)** - Complete feature list and implementation details
- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** - Deployment, production setup, and troubleshooting
- **[docs/README-DEPLOYMENT.md](docs/README-DEPLOYMENT.md)** - Quick deployment reference

## Key Features

### ✅ Core Functionality
- **Net Session Management** - Create and manage net sessions
- **Participant Tracking** - Track check-ins and participation
- **Traffic Handling** - Record and manage message traffic
- **Operator Database** - Maintain operator information with QRZ integration
- **Reports System** - Comprehensive analytics and reporting

### ✅ Modern Features
- **Mobile Responsive** - Optimized for all device types
- **Email Integration** - SMTP support with STARTTLS and no-auth options
- **Password Reset** - Email-based password recovery
- **Interactive Maps** - Operator location mapping
- **Version Management** - Automatic versioning and updates

### ✅ Technical Features
- **Automatic Database Migrations** - Seamless updates
- **RESTful API** - Clean API design
- **Real-time Updates** - Dynamic content updates
- **Comprehensive Logging** - Detailed system logging
- **Production Ready** - PM2, systemd, and Docker support

## System Requirements

- **Node.js** 18 or higher
- **Operating System** Linux, macOS, or Windows
- **Memory** 512MB RAM minimum
- **Storage** 1GB available space
- **Network** Internet connection for QRZ lookups (optional)

## Architecture

```
NetControl/
├── client/          # React frontend application
├── server/          # Node.js backend API
├── docs/           # Documentation files
└── scripts/        # Deployment and utility scripts
```

**Frontend**: React with Bootstrap for responsive UI  
**Backend**: Node.js with Express and SQLite database  
**Authentication**: Session-based with bcrypt password hashing  
**Email**: Nodemailer with multiple provider support  

## Quick Commands

```bash
# Development
npm run dev          # Start development servers
npm run build        # Build production client
npm test            # Run tests

# Production
npm start           # Start production server
npm run deploy      # Create deployment package

# Maintenance
./update-production.sh    # Update production installation
./status-production.sh    # Check system status
./troubleshoot-installation.sh  # Diagnose issues
```

## Configuration

### Environment Variables
```bash
PORT=3001                    # Server port
NODE_ENV=production         # Environment
DB_PATH=./server/data/netcontrol.db  # Database location
SMTP_HOST=smtp.gmail.com    # Email server
SMTP_PORT=587               # Email port
SMTP_STARTTLS=true         # Use STARTTLS
```

### Email Providers
- **Gmail** - App passwords required
- **Office 365** - Standard authentication
- **Local SMTP** - No authentication option available

## Default Login
- **Username**: `admin`
- **Password**: `admin123`
- **⚠️ Change immediately after first login**

## Mobile Support

NetControl is fully optimized for mobile devices with:
- Responsive navigation with hamburger menu
- Touch-friendly forms and buttons
- Optimized table scrolling
- Mobile-first design approach

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

### Core Features
- `GET /api/sessions` - List net sessions
- `GET /api/operators` - List operators
- `GET /api/reports/*` - Various reports
- `GET /api/qrz/lookup/:callsign` - QRZ callsign lookup

## Browser Support

### Mobile
- iOS Safari 12+
- Chrome Mobile 70+
- Firefox Mobile 68+
- Samsung Internet 10+

### Desktop
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

### Documentation
- **Features**: See [docs/FEATURES.md](docs/FEATURES.md) for detailed feature information
- **Deployment**: See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for setup and troubleshooting
- **API**: API documentation available at `/api/docs` when running

### Troubleshooting
1. Run `./remote-diagnostics.sh` for system analysis
2. Check logs in `/opt/netcontrol/logs/`
3. Verify service status: `sudo systemctl status netcontrol`

### Getting Help
- Check the documentation first
- Run diagnostic scripts
- Review system logs
- Report issues with full diagnostic output

---

**NetControl** - Making amateur radio net management simple and efficient.