const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/', async (req, res) => {
  const rows = await db.all(
    `SELECT s.id, s.name,
       (SELECT COUNT(*) FROM student_subjects ss WHERE ss.subject_id = s.id) as student_count,
       (SELECT COUNT(*) FROM teacher_subjects ts WHERE ts.subject_id = s.id) as teacher_count
     FROM subjects s ORDER BY s.name`
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  try {
    const result = await db.run('INSERT INTO subjects (name) VALUES (?)', [name.trim()]);
    res.json({ id: result.lastInsertRowid, name: name.trim(), student_count: 0, teacher_count: 0 });
  } catch {
    res.status(400).json({ error: 'Subject name already exists' });
  }
});

router.put('/:id', async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  try {
    await db.run('UPDATE subjects SET name = ? WHERE id = ?', [name.trim(), req.params.id]);
    res.json({ id: Number(req.params.id), name: name.trim() });
  } catch {
    res.status(400).json({ error: 'Subject name already exists' });
  }
});

router.delete('/:id', async (req, res) => {
  await db.batch([
    { sql: 'DELETE FROM student_subjects WHERE subject_id = ?', args: [req.params.id] },
    { sql: 'DELETE FROM teacher_subjects WHERE subject_id = ?', args: [req.params.id] },
    { sql: 'DELETE FROM subjects WHERE id = ?', args: [req.params.id] }
  ]);
  res.json({ success: true });
});

module.exports = router;
