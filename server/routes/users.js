const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();
router.use(auth, adminOnly);

router.get('/', (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.username, u.role, u.active, u.created_at, u.teacher_id,
      t.name as teacher_name
    FROM users u LEFT JOIN teachers t ON t.id = u.teacher_id
    ORDER BY u.role DESC, u.username
  `).all();
  res.json(users);
});

router.post('/', (req, res) => {
  const { username, password, role = 'teacher', teacher_id } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  if (!['admin', 'teacher'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

  if (role === 'teacher' && !teacher_id)
    return res.status(400).json({ error: 'teacher_id required for teacher accounts' });

  try {
    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(
      'INSERT INTO users (username, password_hash, role, teacher_id) VALUES (?, ?, ?, ?)'
    ).run(username, hash, role, teacher_id || null);
    res.json(db.prepare(`
      SELECT u.id, u.username, u.role, u.active, u.teacher_id, t.name as teacher_name
      FROM users u LEFT JOIN teachers t ON t.id = u.teacher_id WHERE u.id = ?
    `).get(result.lastInsertRowid));
  } catch {
    res.status(409).json({ error: 'Username already exists' });
  }
});

router.put('/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { username, role, teacher_id, active } = req.body;
  db.prepare('UPDATE users SET username=?, role=?, teacher_id=?, active=? WHERE id=?')
    .run(username ?? user.username, role ?? user.role, teacher_id ?? user.teacher_id, active ?? user.active, user.id);
  res.json(db.prepare(`
    SELECT u.id, u.username, u.role, u.active, u.teacher_id, t.name as teacher_name
    FROM users u LEFT JOIN teachers t ON t.id = u.teacher_id WHERE u.id = ?
  `).get(user.id));
});

router.put('/:id/reset-password', (req, res) => {
  const { new_password } = req.body;
  if (!new_password) return res.status(400).json({ error: 'new_password required' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  if (parseInt(req.params.id) === req.user.id)
    return res.status(400).json({ error: 'Cannot delete your own account' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
