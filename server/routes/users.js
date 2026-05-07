const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();
router.use(auth, adminOnly);

router.get('/', async (req, res) => {
  const users = await db.all(
    `SELECT u.id, u.username, u.role, u.active, u.created_at, u.teacher_id,
       t.name as teacher_name
     FROM users u LEFT JOIN teachers t ON t.id = u.teacher_id
     ORDER BY u.role DESC, u.username`
  );
  res.json(users);
});

router.post('/', async (req, res) => {
  const { username, password, role = 'teacher', teacher_id } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  if (!['admin', 'teacher'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (role === 'teacher' && !teacher_id)
    return res.status(400).json({ error: 'teacher_id required for teacher accounts' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await db.run(
      'INSERT INTO users (username, password_hash, role, teacher_id) VALUES (?, ?, ?, ?)',
      [username, hash, role, teacher_id || null]
    );
    const user = await db.get(
      `SELECT u.id, u.username, u.role, u.active, u.teacher_id, t.name as teacher_name
       FROM users u LEFT JOIN teachers t ON t.id = u.teacher_id WHERE u.id = ?`,
      [result.lastInsertRowid]
    );
    res.json(user);
  } catch {
    res.status(409).json({ error: 'Username already exists' });
  }
});

router.put('/:id', async (req, res) => {
  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { username, role, teacher_id, active } = req.body;
  await db.run(
    'UPDATE users SET username=?, role=?, teacher_id=?, active=? WHERE id=?',
    [username ?? user.username, role ?? user.role, teacher_id ?? user.teacher_id, active ?? user.active, user.id]
  );
  const updated = await db.get(
    `SELECT u.id, u.username, u.role, u.active, u.teacher_id, t.name as teacher_name
     FROM users u LEFT JOIN teachers t ON t.id = u.teacher_id WHERE u.id = ?`,
    [user.id]
  );
  res.json(updated);
});

router.put('/:id/reset-password', async (req, res) => {
  const { new_password } = req.body;
  if (!new_password) return res.status(400).json({ error: 'new_password required' });
  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const hash = await bcrypt.hash(new_password, 10);
  await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, user.id]);
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  if (parseInt(req.params.id) === req.user.id)
    return res.status(400).json({ error: 'Cannot delete your own account' });
  await db.run('DELETE FROM users WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
