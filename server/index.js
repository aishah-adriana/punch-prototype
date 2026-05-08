const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const { auth, adminOnly } = require('./middleware/auth');

const app = express();
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*'
}));
app.use(express.json());

// Ensure DB is initialised before any request is handled
app.use(async (req, res, next) => {
  try { await db.ensureInit(); next(); }
  catch (e) { res.status(500).json({ error: 'Database initialisation failed: ' + e.message }); }
});

// Public route — no auth required
app.use('/api/auth', require('./routes/auth'));

// Teacher portal — auth required, teacher role enforced inside router
app.use('/api/teacher-portal', require('./routes/teacher-portal'));

// Admin-only routes
app.use('/api/subjects', auth, adminOnly, require('./routes/subjects'));
app.use('/api/teachers', auth, adminOnly, require('./routes/teachers'));
app.use('/api/students', auth, adminOnly, require('./routes/students'));
app.use('/api/groups', auth, adminOnly, require('./routes/groups'));
app.use('/api/sessions', auth, adminOnly, require('./routes/sessions'));
app.use('/api/payments', auth, adminOnly, require('./routes/payments'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/tags', require('./routes/tags'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/receipts', require('./routes/receipts').router);
app.use('/api/users', require('./routes/users'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

// Serve React frontend (production / Vercel)
const distPath = path.join(__dirname, '../client/dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Local development: listen directly
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Punch Tracker server running on port ${PORT}`));
}

module.exports = app;
