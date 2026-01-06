# NetControl Web

A modern web-based Ham Radio Network Management application, ported from the original Windows MFC NetControl application.

## Features

### Core Functionality
- **Net Session Management**: Create and manage amateur radio net sessions with date-based organization
- **Operator Database**: Track call signs, names, locations, grid squares, and license information
- **Real-time Check-ins**: Live participant tracking during net sessions
- **QRZ Integration**: Automatic call sign lookups with distance calculations
- **FCC Database**: Local FCC ULS database for license verification
- **Audio Recording**: Session recording and playback capabilities
- **Report Generation**: Automated session and monthly reports with email distribution

### Modern Web Features
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Real-time Updates**: WebSocket-based live updates across all connected clients
- **RESTful API**: Clean API design for integration with other tools
- **Progressive Web App**: Can be installed and used offline
- **Multi-user Support**: Concurrent access for multiple net control operators

## Technology Stack

### Backend
- **Node.js** with Express.js framework
- **SQLite** database for local data storage
- **Socket.IO** for real-time communication
- **Axios** for HTTP requests and QRZ API integration
- **Multer** for audio file uploads
- **Nodemailer** for email report distribution

### Frontend
- **React** with modern hooks and functional components
- **React Router** for navigation
- **React Query** for data fetching and caching
- **Socket.IO Client** for real-time updates
- **React Calendar** for date selection
- **Lucide React** for icons

## Installation

### Prerequisites
- Node.js 16+ and npm
- Git

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd netcontrol-web
   ```

2. **Install dependencies**
   ```bash
   npm run install-all
   ```

3. **Start development servers**
   ```bash
   npm run dev
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

### Production Deployment

1. **Build the frontend**
   ```bash
   npm run build
   ```

2. **Start production server**
   ```bash
   npm start
   ```

## Configuration

### Environment Variables
Create a `.env` file in the root directory:

```env
NODE_ENV=production
PORT=5000
DATABASE_PATH=./server/data/netcontrol.db
UPLOAD_PATH=./server/uploads
```

### QRZ Configuration
QRZ.com credentials are required for call sign lookups:
- Sign up at https://www.qrz.com
- Use your QRZ username and password in the QRZ Lookup page
- Credentials are stored locally in browser storage (password not saved)

## Usage Guide

### Starting a Net Session

1. **Navigate to Sessions** → Click "New Session" or select today's date
2. **Set Net Control** information (call sign, name)
3. **Record Start Time** when the net begins
4. **Add Participants** as they check in during the net
5. **Mark Traffic** for operators with traffic to pass
6. **End Session** and record end time

### Managing Operators

1. **Add New Operators** manually or via QRZ lookup
2. **Update Information** including grid squares and contact details
3. **Search and Filter** the operator database
4. **Import from QRZ** to automatically populate operator details

### Generating Reports

1. **Session Reports**: Detailed participant lists and traffic summary
2. **Monthly Reports**: Statistics and trends for a given month
3. **Email Distribution**: Send reports to multiple recipients
4. **Export Options**: JSON data for integration with other tools

## API Documentation

### Operators
- `GET /api/operators` - List all operators
- `POST /api/operators` - Create new operator
- `GET /api/operators/:callSign` - Get operator details
- `PUT /api/operators/:callSign` - Update operator
- `DELETE /api/operators/:callSign` - Delete operator

### Sessions
- `GET /api/sessions` - List sessions
- `POST /api/sessions` - Create new session
- `GET /api/sessions/:date` - Get session details
- `PUT /api/sessions/:date` - Update session
- `POST /api/sessions/:date/participants` - Add participant
- `PUT /api/sessions/:date/participants/:id` - Update participant

### QRZ Lookup
- `POST /api/qrz/lookup` - Lookup call sign
- `GET /api/qrz/cache/:callSign` - Get cached data
- `POST /api/qrz/distance` - Calculate grid square distance

### Reports
- `GET /api/reports/session/:date` - Generate session report
- `GET /api/reports/monthly/:year/:month` - Generate monthly report
- `POST /api/reports/email` - Email report

## Database Schema

### Core Tables
- **operators**: Call signs, names, locations, grid squares
- **sessions**: Net session information by date
- **session_participants**: Many-to-many relationship for check-ins
- **qrz_cache**: Cached QRZ lookup results
- **fcc_en/fcc_am**: FCC ULS database records
- **audio_recordings**: Session audio files
- **settings**: Application configuration

## Development

### Project Structure
```
netcontrol-web/
├── server/                 # Backend Node.js application
│   ├── database/          # Database configuration and models
│   ├── routes/            # API route handlers
│   ├── uploads/           # File upload storage
│   └── index.js           # Main server file
├── client/                # Frontend React application
│   ├── src/
│   │   ├── components/    # Reusable React components
│   │   ├── pages/         # Page components
│   │   ├── contexts/      # React contexts (Socket, etc.)
│   │   └── App.js         # Main React app
│   └── package.json
└── package.json           # Root package.json
```

### Adding New Features

1. **Backend**: Add routes in `server/routes/`
2. **Frontend**: Add pages in `client/src/pages/`
3. **Database**: Update schema in `server/database/db.js`
4. **Real-time**: Add Socket.IO events for live updates

### Testing

```bash
# Run backend tests
npm run test:server

# Run frontend tests
npm run test:client

# Run all tests
npm test
```

## Migration from Original NetControl

This web application preserves all core functionality from the original Windows MFC NetControl:

### Preserved Features
- ✅ Net session management with date-based organization
- ✅ Operator database with call sign lookup
- ✅ QRZ.com integration for call sign information
- ✅ FCC database integration (ULS records)
- ✅ Audio recording and playback
- ✅ Report generation and email distribution
- ✅ Grid square distance calculations
- ✅ Traffic message tracking

### Modern Enhancements
- ✅ Web-based interface accessible from any device
- ✅ Real-time collaboration between multiple operators
- ✅ Responsive design for mobile and tablet use
- ✅ RESTful API for integration with other tools
- ✅ Modern database with better performance
- ✅ Improved search and filtering capabilities

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue on GitHub
- Check the documentation in the `/docs` folder
- Review the API documentation above

## Acknowledgments

- Original NetControl MFC application developers
- QRZ.com for call sign lookup services
- FCC for providing ULS database access
- Amateur radio community for feedback and testing