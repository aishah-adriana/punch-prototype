// Vercel serverless entry point
let app;
try {
  app = require('../server/index');
} catch (e) {
  console.error('Server initialization failed:', e);
  const express = require('express');
  app = express();
  app.all('*', (req, res) =>
    res.status(500).json({ error: 'Server init failed: ' + e.message, stack: e.stack })
  );
}
module.exports = app;
