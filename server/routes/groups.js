const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
  const { teacher_id } = req.query;
  let query = `
    SELECT g.*, t.name as teacher_name, COUNT(s.id) as student_count
    FROM class_groups g
    JOIN teachers t ON t.id = g.teacher_id
    LEFT JOIN students s ON s.group_id = g.id AND s.active = 1
  `;
  const params = [];
  if (teacher_id) { query += ' WHERE g.teacher_id = ?'; params.push(teacher_id); }
  query += ' GROUP BY g.id ORDER BY g.name';
  res.json(db.prepare(query).all(...params));
});

router.get('/:id', (req, res) => {
  const group = db.prepare(`
    SELECT g.*, t.name as teacher_name FROM class_groups g
    JOIN teachers t ON t.id = g.teacher_id WHERE g.id = ?
  `).get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Not found' });
  const students = db.prepare('SELECT * FROM students WHERE group_id = ? AND active = 1').all(req.params.id);
  res.json({ ...group, students });
});

router.post('/', (req, res) => {
  const { name, teacher_id, syllabus, duration_hours = 1.5 } = req.body;
  if (!name || !teacher_id || !syllabus) return res.status(400).json({ error: 'name, teacher_id, syllabus required' });
  const result = db.prepare('INSERT INTO class_groups (name, teacher_id, syllabus, duration_hours) VALUES (?, ?, ?, ?)').run(name, teacher_id, syllabus, duration_hours);
  res.json({ id: result.lastInsertRowid, name, teacher_id, syllabus, duration_hours });
});

router.put('/:id', (req, res) => {
  const { name, teacher_id, syllabus, duration_hours } = req.body;
  if (!name || !teacher_id || !syllabus) return res.status(400).json({ error: 'name, teacher_id, syllabus required' });
  db.prepare('UPDATE class_groups SET name = ?, teacher_id = ?, syllabus = ?, duration_hours = ? WHERE id = ?')
    .run(name, teacher_id, syllabus, duration_hours, req.params.id);
  res.json({ id: Number(req.params.id), name, teacher_id, syllabus, duration_hours });
});

router.delete('/:id', (req, res) => {
  const students = db.prepare('SELECT COUNT(*) as c FROM students WHERE group_id = ? AND active = 1').get(req.params.id);
  if (students.c > 0) return res.status(400).json({ error: 'Cannot delete group with active students' });
  db.prepare('DELETE FROM class_groups WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
