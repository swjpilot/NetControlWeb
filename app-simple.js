const express = require('express');
const app = express();

const PORT = process.env.PORT || 8081;

// Simple health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Simple root route
app.get('/', (req, res) => {
  res.send('<h1>NetControl Test</h1><p>Application is running!</p>');
});

app.listen(PORT, () => {
  console.log(`Simple test app running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});