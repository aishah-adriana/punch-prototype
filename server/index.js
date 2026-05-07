const express = require('express');
const cors = require('cors');
const { auth, adminOnly } = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(express.json());

// Public route — no auth required
app.use('/api/auth', require('./routes/auth'));

// Teacher portal — auth required, teacher role
app.use('/api/teacher-portal', require('./routes/teacher-portal'));

// Admin-only routes — auth + admin role enforced inside each router
app.use('/api/subjects', auth, adminOnly, require('./routes/subjects'));
app.use('/api/teachers', auth, adminOnly, require('./routes/teachers'));
app.use('/api/students', auth, adminOnly, require('./routes/students'));
app.use('/api/groups', auth, adminOnly, require('./routes/groups'));
app.use('/api/sessions', auth, adminOnly, require('./routes/sessions'));
app.use('/api/payments', auth, adminOnly, require('./routes/payments'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/tags', require('./routes/tags'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/users', require('./routes/users'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Punch Tracker server running on port ${PORT}`));
