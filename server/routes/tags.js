const express = require('express');
const db = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();
router.use(auth, adminOnly);

router.get('/', async (req, res) => {
  res.json(await db.all('SELECT * FROM tags ORDER BY category, name'));
});

router.post('/', async (req, res) => {
  const { name, color = '#6366f1', category = 'general' } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const result = await db.run('INSERT INTO tags (name, color, category) VALUES (?, ?, ?)', [name, color, category]);
    res.json(await db.get('SELECT * FROM tags WHERE id = ?', [result.lastInsertRowid]));
  } catch {
    res.status(409).json({ error: 'Tag name already exists' });
  }
});

router.put('/:id', async (req, res) => {
  const tag = await db.get('SELECT * FROM tags WHERE id = ?', [req.params.id]);
  if (!tag) return res.status(404).json({ error: 'Tag not found' });
  const { name, color, category } = req.body;
  await db.run(
    'UPDATE tags SET name=?, color=?, category=? WHERE id=?',
    [name ?? tag.name, color ?? tag.color, category ?? tag.category, tag.id]
  );
  res.json(await db.get('SELECT * FROM tags WHERE id = ?', [tag.id]));
});

router.delete('/:id', async (req, res) => {
  await db.run('DELETE FROM tags WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

router.get('/teacher/:teacherId', async (req, res) => {
  res.json(await db.all(
    `SELECT t.* FROM tags t JOIN teacher_tags tt ON tt.tag_id = t.id WHERE tt.teacher_id = ?`,
    [req.params.teacherId]
  ));
});

router.put('/teacher/:teacherId', async (req, res) => {
  const { tag_ids } = req.body;
  if (!Array.isArray(tag_ids)) return res.status(400).json({ error: 'tag_ids array required' });
  const stmts = [
    { sql: 'DELETE FROM teacher_tags WHERE teacher_id = ?', args: [req.params.teacherId] },
    ...tag_ids.map(id => ({
      sql: 'INSERT OR IGNORE INTO teacher_tags (teacher_id, tag_id) VALUES (?, ?)',
      args: [req.params.teacherId, id]
    }))
  ];
  await db.batch(stmts);
  res.json({ ok: true });
});

router.get('/student/:studentId', async (req, res) => {
  res.json(await db.all(
    `SELECT t.* FROM tags t JOIN student_tags st ON st.tag_id = t.id WHERE st.student_id = ?`,
    [req.params.studentId]
  ));
});

router.put('/student/:studentId', async (req, res) => {
  const { tag_ids } = req.body;
  if (!Array.isArray(tag_ids)) return res.status(400).json({ error: 'tag_ids array required' });
  const stmts = [
    { sql: 'DELETE FROM student_tags WHERE student_id = ?', args: [req.params.studentId] },
    ...tag_ids.map(id => ({
      sql: 'INSERT OR IGNORE INTO student_tags (student_id, tag_id) VALUES (?, ?)',
      args: [req.params.studentId, id]
    }))
  ];
  await db.batch(stmts);
  res.json({ ok: true });
});

router.get('/session/:sessionId', async (req, res) => {
  res.json(await db.all(
    `SELECT t.* FROM tags t JOIN session_tags st ON st.tag_id = t.id WHERE st.session_id = ?`,
    [req.params.sessionId]
  ));
});

router.put('/session/:sessionId', async (req, res) => {
  const { tag_ids } = req.body;
  if (!Array.isArray(tag_ids)) return res.status(400).json({ error: 'tag_ids array required' });
  const stmts = [
    { sql: 'DELETE FROM session_tags WHERE session_id = ?', args: [req.params.sessionId] },
    ...tag_ids.map(id => ({
      sql: 'INSERT OR IGNORE INTO session_tags (session_id, tag_id) VALUES (?, ?)',
      args: [req.params.sessionId, id]
    }))
  ];
  await db.batch(stmts);
  res.json({ ok: true });
});

router.get('/payment/:paymentId', async (req, res) => {
  const { type = 'student' } = req.query;
  res.json(await db.all(
    `SELECT t.* FROM tags t JOIN payment_tags pt ON pt.tag_id = t.id
     WHERE pt.payment_id = ? AND pt.payment_type = ?`,
    [req.params.paymentId, type]
  ));
});

router.put('/payment/:paymentId', async (req, res) => {
  const { tag_ids, type = 'student' } = req.body;
  if (!Array.isArray(tag_ids)) return res.status(400).json({ error: 'tag_ids array required' });
  const stmts = [
    { sql: 'DELETE FROM payment_tags WHERE payment_id = ? AND payment_type = ?', args: [req.params.paymentId, type] },
    ...tag_ids.map(id => ({
      sql: 'INSERT OR IGNORE INTO payment_tags (payment_id, tag_id, payment_type) VALUES (?, ?, ?)',
      args: [req.params.paymentId, id, type]
    }))
  ];
  await db.batch(stmts);
  res.json({ ok: true });
});

module.exports = router;
