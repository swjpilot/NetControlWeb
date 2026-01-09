const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const db = require('./database/postgres-js-db');
const authRoutes = require('./routes/auth-postgres-js');
const settingsRoutes = require('./routes/settings-postgres-js');
const operatorsRoutes = require('./routes/operators-postgres-js');
const sessionsRoutes = require('./routes/sessions');
const reportsRoutes = require('./routes/reports');
const fccRoutes = require('./routes/fcc-postgres-js');
const qrzRoutes = require('./routes/qrz-postgres-js');
const usersRoutes = require('./routes/users-postgres-js');
const preCheckInRoutes = require('./routes/preCheckIn-postgres-js');

const app = express();

// Initialize database
(async () => {
  try {
    await db.init();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
  }
})();

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

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API Routes FIRST - before static files
console.log('Registering API routes...');
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/operators', operatorsRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/fcc', fccRoutes); // FCC routes now include scheduling
app.use('/api/qrz', qrzRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/pre-checkin', preCheckInRoutes);
console.log('All API routes registered');

// Version endpoint
app.get('/api/version', (req, res) => {
  try {
    const versionPath = path.join(__dirname, '../version.js');
    if (fs.existsSync(versionPath)) {
      delete require.cache[require.resolve('../version.js')];
      const version = require('../version.js');
      res.json({
        ...version,
        database: 'PostgreSQL (postgres.js)'
      });
    } else {
      res.json({
        version: '1.1.0',
        buildNumber: 'simple-static',
        buildDate: new Date().toISOString(),
        database: 'PostgreSQL (postgres.js)'
      });
    }
  } catch (error) {
    console.error('Error reading version:', error);
    res.json({
      version: '1.1.0',
      buildNumber: 'simple-static',
      buildDate: new Date().toISOString(),
      database: 'PostgreSQL (postgres.js)'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'NetControl Web Application',
    database: 'PostgreSQL (postgres.js)'
  });
});

// Database health check
app.get('/api/health/db', async (req, res) => {
  try {
    const result = await db.sql`SELECT NOW() as current_time, version() as pg_version`;
    res.json({
      status: 'OK',
      database: 'PostgreSQL (postgres.js)',
      timestamp: result[0].current_time,
      version: result[0].pg_version
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    res.status(500).json({
      status: 'ERROR',
      database: 'PostgreSQL (postgres.js)',
      error: error.message
    });
  }
});

// Serve static files from React build - AFTER API routes
const buildPath = path.join(__dirname, '../client/build');
console.log('Serving static files from:', buildPath);
console.log('Build directory exists:', fs.existsSync(buildPath));

if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));
  console.log('Static file serving configured');
} else {
  console.error('Build directory not found:', buildPath);
}

// Serve React app for all other routes - LAST
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../client/build', 'index.html');
  console.log('Serving index.html for route:', req.path);
  console.log('Index.html path:', indexPath);
  console.log('Index.html exists:', fs.existsSync(indexPath));
  
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    console.error('index.html not found at:', indexPath);
    res.status(404).json({ 
      error: 'React app not found',
      path: indexPath,
      exists: fs.existsSync(indexPath)
    });
  }
});

const PORT = process.env.PORT || 8080;

// Handle port conflicts gracefully
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`NetControl server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Database: PostgreSQL (postgres.js)`);
  console.log(`Listening on all interfaces (0.0.0.0:${PORT})`);
  console.log(`Build path: ${buildPath}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please stop the existing process or use a different port.`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(async () => {
    await db.close();
    console.log('Process terminated');
  });
});

module.exports = app;