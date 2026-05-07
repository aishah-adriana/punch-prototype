const express = require('express');
const db = require('../db');
const router = express.Router();

const subjectsFor = (teacherId) =>
  db.prepare(`SELECT sub.id, sub.name FROM teacher_subjects ts
    JOIN subjects sub ON sub.id = ts.subject_id
    WHERE ts.teacher_id = ? ORDER BY sub.name`).all(teacherId);

const tagsFor = (teacherId) =>
  db.prepare(`SELECT t.* FROM tags t JOIN teacher_tags tt ON tt.tag_id = t.id WHERE tt.teacher_id = ?`).all(teacherId);

router.get('/', (req, res) => {
  const teachers = db.prepare(`
    SELECT t.*, COUNT(DISTINCT s.id) as student_count,
      (SELECT GROUP_CONCAT(sub.name, ', ')
       FROM teacher_subjects ts JOIN subjects sub ON sub.id = ts.subject_id
       WHERE ts.teacher_id = t.id ORDER BY sub.name) as subject_names
    FROM teachers t
    LEFT JOIN students s ON s.teacher_id = t.id AND s.active = 1
    GROUP BY t.id ORDER BY t.name
  `).all().map(t => ({ ...t, subjects: subjectsFor(t.id), tags: tagsFor(t.id) }));
  res.json(teachers);
});

router.get('/:id', (req, res) => {
  const teacher = db.prepare('SELECT * FROM teachers WHERE id = ?').get(req.params.id);
  if (!teacher) return res.status(404).json({ error: 'Not found' });
  res.json({ ...teacher, subjects: subjectsFor(teacher.id), tags: tagsFor(teacher.id) });
});

router.post('/', (req, res) => {
  const { name, phone = '', email = '' } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const result = db.prepare('INSERT INTO teachers (name, phone, email) VALUES (?, ?, ?)').run(name, phone, email);
  res.json({ id: result.lastInsertRowid, name, phone, email, subjects: [] });
});

router.put('/:id', (req, res) => {
  const { name, phone = '', email = '' } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  db.prepare('UPDATE teachers SET name = ?, phone = ?, email = ? WHERE id = ?').run(name, phone, email, req.params.id);
  res.json({ id: Number(req.params.id), name, phone, email });
});

router.put('/:id/subjects', (req, res) => {
  const { subject_ids } = req.body;
  if (!Array.isArray(subject_ids)) return res.status(400).json({ error: 'subject_ids array required' });
  db.prepare('DELETE FROM teacher_subjects WHERE teacher_id = ?').run(req.params.id);
  const insert = db.prepare('INSERT INTO teacher_subjects (teacher_id, subject_id) VALUES (?, ?)');
  db.transaction(() => { for (const sid of subject_ids) insert.run(req.params.id, sid); })();
  res.json({ subjects: subjectsFor(req.params.id) });
});

router.delete('/:id', (req, res) => {
  const students = db.prepare('SELECT COUNT(*) as c FROM students WHERE teacher_id = ? AND active = 1').get(req.params.id);
  if (students.c > 0) return res.status(400).json({ error: 'Cannot delete teacher with active students' });
  db.prepare('DELETE FROM teachers WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
