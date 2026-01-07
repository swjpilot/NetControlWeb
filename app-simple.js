const express = require('express');
const app = express();

const PORT = process.env.PORT || 8081;

// Health check endpoint
app.get('/', (req, res) => {
  res.send(`
    <h1>NetControl Test Application</h1>
    <p>Status: Running successfully!</p>
    <p>Port: ${PORT}</p>
    <p>Environment: ${process.env.NODE_ENV || 'development'}</p>
    <p>Time: ${new Date().toISOString()}</p>
  `);
});

// Health check for load balancer
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    port: PORT,
    env: process.env.NODE_ENV || 'development'
  });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`NetControl test app running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Listening on all interfaces (0.0.0.0:${PORT})`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});