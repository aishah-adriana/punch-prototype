const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { auth, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password required' });

  const user = await db.get(
    `SELECT u.*, t.name as teacher_name
     FROM users u LEFT JOIN teachers t ON u.teacher_id = t.id
     WHERE u.username = ? AND u.active = 1`,
    [username]
  );

  if (!user || !(await bcrypt.compare(password, user.password_hash)))
    return res.status(401).json({ error: 'Invalid username or password' });

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, teacher_id: user.teacher_id },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({
    token,
    role: user.role,
    username: user.username,
    teacher_name: user.teacher_name || null,
    teacher_id: user.teacher_id || null
  });
});

router.get('/me', auth, async (req, res) => {
  const user = await db.get(
    `SELECT u.id, u.username, u.role, u.teacher_id, t.name as teacher_name
     FROM users u LEFT JOIN teachers t ON u.teacher_id = t.id WHERE u.id = ?`,
    [req.user.id]
  );
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

router.put('/change-password', auth, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password)
    return res.status(400).json({ error: 'Both passwords required' });

  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!(await bcrypt.compare(current_password, user.password_hash)))
    return res.status(401).json({ error: 'Current password is incorrect' });

  const hash = await bcrypt.hash(new_password, 10);
  await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, user.id]);
  res.json({ ok: true });
});

module.exports = router;
