const express = require('express');
const db = require('../db');
const router = express.Router();

const withCounts = () => db.prepare(`
  SELECT s.id, s.name,
    (SELECT COUNT(*) FROM student_subjects ss WHERE ss.subject_id = s.id) as student_count,
    (SELECT COUNT(*) FROM teacher_subjects ts WHERE ts.subject_id = s.id) as teacher_count
  FROM subjects s ORDER BY s.name
`).all();

router.get('/', (req, res) => res.json(withCounts()));

router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  try {
    const result = db.prepare('INSERT INTO subjects (name) VALUES (?)').run(name.trim());
    res.json({ id: result.lastInsertRowid, name: name.trim(), student_count: 0, teacher_count: 0 });
  } catch {
    res.status(400).json({ error: 'Subject name already exists' });
  }
});

router.put('/:id', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  try {
    db.prepare('UPDATE subjects SET name = ? WHERE id = ?').run(name.trim(), req.params.id);
    res.json({ id: Number(req.params.id), name: name.trim() });
  } catch {
    res.status(400).json({ error: 'Subject name already exists' });
  }
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM student_subjects WHERE subject_id = ?').run(req.params.id);
  db.prepare('DELETE FROM teacher_subjects WHERE subject_id = ?').run(req.params.id);
  db.prepare('DELETE FROM subjects WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
