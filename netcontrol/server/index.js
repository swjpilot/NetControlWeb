const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const db = require('./database/db');
const authRoutes = require('./routes/auth');
const fccRoutes = require('./routes/fcc');
const settingsRoutes = require('./routes/settings');
const qrzRoutes = require('./routes/qrz');
const operatorsRoutes = require('./routes/operators');
const sessionsRoutes = require('./routes/sessions');
const reportsRoutes = require('./routes/reports');
const preCheckInRoutes = require('./routes/preCheckIn');

const app = express();

// Ensure required directories exist
const requiredDirs = [
  path.join(__dirname, 'data'),
  path.join(__dirname, 'uploads'),
  path.join(__dirname, 'uploads/audio'),
  path.join(__dirname, 'downloads')
];

requiredDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// Initialize database
db.init();

// Security middleware
app.use(cors());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/fcc', fccRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/qrz', qrzRoutes);
app.use('/api/operators', operatorsRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/pre-checkin', preCheckInRoutes);

// Mock API routes for development
// Remove the mock sessions route since we now have a real one
// app.get('/api/sessions', (req, res) => {
//   res.json([]);
// });

// Remove the mock operators route since we now have a real one
// app.get('/api/operators', (req, res) => {
//   res.json([]);
// });

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve React app in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

const PORT = process.env.PORT || 5000;

// Handle port conflicts gracefully
const server = app.listen(PORT, () => {
  console.log(`NetControl server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please stop the existing process or use a different port.`);
    console.error('You can kill the existing process with: kill $(lsof -ti:5000)');
    process.exit(1);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});

module.exports = app;