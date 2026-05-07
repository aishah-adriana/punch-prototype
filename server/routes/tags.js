const express = require('express');
const db = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();
router.use(auth, adminOnly);

router.get('/', (req, res) => {
  const tags = db.prepare('SELECT * FROM tags ORDER BY category, name').all();
  res.json(tags);
});

router.post('/', (req, res) => {
  const { name, color = '#6366f1', category = 'general' } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const result = db.prepare('INSERT INTO tags (name, color, category) VALUES (?, ?, ?)').run(name, color, category);
    res.json(db.prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid));
  } catch {
    res.status(409).json({ error: 'Tag name already exists' });
  }
});

router.put('/:id', (req, res) => {
  const { name, color, category } = req.body;
  const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id);
  if (!tag) return res.status(404).json({ error: 'Tag not found' });
  db.prepare('UPDATE tags SET name=?, color=?, category=? WHERE id=?')
    .run(name ?? tag.name, color ?? tag.color, category ?? tag.category, tag.id);
  res.json(db.prepare('SELECT * FROM tags WHERE id = ?').get(tag.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM tags WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Get tags for a teacher
router.get('/teacher/:teacherId', (req, res) => {
  const tags = db.prepare(`
    SELECT t.* FROM tags t
    JOIN teacher_tags tt ON tt.tag_id = t.id
    WHERE tt.teacher_id = ?
  `).all(req.params.teacherId);
  res.json(tags);
});

// Set tags on a teacher
router.put('/teacher/:teacherId', (req, res) => {
  const { tag_ids } = req.body;
  if (!Array.isArray(tag_ids)) return res.status(400).json({ error: 'tag_ids array required' });
  db.prepare('DELETE FROM teacher_tags WHERE teacher_id = ?').run(req.params.teacherId);
  const ins = db.prepare('INSERT OR IGNORE INTO teacher_tags (teacher_id, tag_id) VALUES (?, ?)');
  for (const id of tag_ids) ins.run(req.params.teacherId, id);
  res.json({ ok: true });
});

// Get tags for a student
router.get('/student/:studentId', (req, res) => {
  const tags = db.prepare(`
    SELECT t.* FROM tags t
    JOIN student_tags st ON st.tag_id = t.id
    WHERE st.student_id = ?
  `).all(req.params.studentId);
  res.json(tags);
});

// Set tags on a student
router.put('/student/:studentId', (req, res) => {
  const { tag_ids } = req.body;
  if (!Array.isArray(tag_ids)) return res.status(400).json({ error: 'tag_ids array required' });
  db.prepare('DELETE FROM student_tags WHERE student_id = ?').run(req.params.studentId);
  const ins = db.prepare('INSERT OR IGNORE INTO student_tags (student_id, tag_id) VALUES (?, ?)');
  for (const id of tag_ids) ins.run(req.params.studentId, id);
  res.json({ ok: true });
});

// Get tags for a session
router.get('/session/:sessionId', (req, res) => {
  const tags = db.prepare(`
    SELECT t.* FROM tags t
    JOIN session_tags st ON st.tag_id = t.id
    WHERE st.session_id = ?
  `).all(req.params.sessionId);
  res.json(tags);
});

// Set tags on a session
router.put('/session/:sessionId', (req, res) => {
  const { tag_ids } = req.body;
  if (!Array.isArray(tag_ids)) return res.status(400).json({ error: 'tag_ids array required' });
  db.prepare('DELETE FROM session_tags WHERE session_id = ?').run(req.params.sessionId);
  const ins = db.prepare('INSERT OR IGNORE INTO session_tags (session_id, tag_id) VALUES (?, ?)');
  for (const id of tag_ids) ins.run(req.params.sessionId, id);
  res.json({ ok: true });
});

// Get tags for a student payment
router.get('/payment/:paymentId', (req, res) => {
  const { type = 'student' } = req.query;
  const tags = db.prepare(`
    SELECT t.* FROM tags t
    JOIN payment_tags pt ON pt.tag_id = t.id
    WHERE pt.payment_id = ? AND pt.payment_type = ?
  `).all(req.params.paymentId, type);
  res.json(tags);
});

// Set tags on a payment
router.put('/payment/:paymentId', (req, res) => {
  const { tag_ids, type = 'student' } = req.body;
  if (!Array.isArray(tag_ids)) return res.status(400).json({ error: 'tag_ids array required' });
  db.prepare('DELETE FROM payment_tags WHERE payment_id = ? AND payment_type = ?').run(req.params.paymentId, type);
  const ins = db.prepare('INSERT OR IGNORE INTO payment_tags (payment_id, tag_id, payment_type) VALUES (?, ?, ?)');
  for (const id of tag_ids) ins.run(req.params.paymentId, id, type);
  res.json({ ok: true });
});

module.exports = router;
