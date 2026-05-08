const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/', async (req, res) => {
  const { teacher_id } = req.query;
  let query = `
    SELECT g.*, t.name as teacher_name, COUNT(s.id) as student_count,
           sub.name as subject_name
    FROM class_groups g
    JOIN teachers t ON t.id = g.teacher_id
    LEFT JOIN students s ON s.group_id = g.id AND s.active = 1
    LEFT JOIN subjects sub ON sub.id = g.subject_id
  `;
  const params = [];
  if (teacher_id) { query += ' WHERE g.teacher_id = ?'; params.push(teacher_id); }
  query += ' GROUP BY g.id ORDER BY g.name';
  res.json(await db.all(query, params));
});

router.get('/:id', async (req, res) => {
  const group = await db.get(
    `SELECT g.*, t.name as teacher_name, sub.name as subject_name
     FROM class_groups g
     JOIN teachers t ON t.id = g.teacher_id
     LEFT JOIN subjects sub ON sub.id = g.subject_id
     WHERE g.id = ?`,
    [req.params.id]
  );
  if (!group) return res.status(404).json({ error: 'Not found' });
  const students = await db.all('SELECT * FROM students WHERE group_id = ? AND active = 1', [req.params.id]);
  res.json({ ...group, students });
});

router.post('/', async (req, res) => {
  const { name, teacher_id, syllabus, duration_hours = 1.5, subject_id = null, standard = '' } = req.body;
  if (!name || !teacher_id || !syllabus) return res.status(400).json({ error: 'name, teacher_id, syllabus required' });
  const result = await db.run(
    'INSERT INTO class_groups (name, teacher_id, syllabus, duration_hours, subject_id, standard) VALUES (?, ?, ?, ?, ?, ?)',
    [name, teacher_id, syllabus, duration_hours, subject_id || null, standard]
  );
  res.json({ id: result.lastInsertRowid, name, teacher_id, syllabus, duration_hours, subject_id, standard });
});

router.put('/:id', async (req, res) => {
  const { name, teacher_id, syllabus, duration_hours, subject_id = null, standard = '' } = req.body;
  if (!name || !teacher_id || !syllabus) return res.status(400).json({ error: 'name, teacher_id, syllabus required' });
  await db.run(
    'UPDATE class_groups SET name = ?, teacher_id = ?, syllabus = ?, duration_hours = ?, subject_id = ?, standard = ? WHERE id = ?',
    [name, teacher_id, syllabus, duration_hours, subject_id || null, standard, req.params.id]
  );
  res.json({ id: Number(req.params.id), name, teacher_id, syllabus, duration_hours, subject_id, standard });
});

router.delete('/:id', async (req, res) => {
  const row = await db.get(
    'SELECT COUNT(*) as c FROM students WHERE group_id = ? AND active = 1',
    [req.params.id]
  );
  if (row.c > 0) return res.status(400).json({ error: 'Cannot delete group with active students' });
  await db.run('DELETE FROM class_groups WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

module.exports = router;
