const express = require('express');
const db = require('../db');
const router = express.Router();

const subjectsFor = (teacherId) =>
  db.all(
    `SELECT sub.id, sub.name FROM teacher_subjects ts
     JOIN subjects sub ON sub.id = ts.subject_id
     WHERE ts.teacher_id = ? ORDER BY sub.name`,
    [teacherId]
  );

const tagsFor = (teacherId) =>
  db.all(
    `SELECT t.* FROM tags t JOIN teacher_tags tt ON tt.tag_id = t.id WHERE tt.teacher_id = ?`,
    [teacherId]
  );

router.get('/', async (req, res) => {
  const teachers = await db.all(
    `SELECT t.*, COUNT(DISTINCT s.id) as student_count,
       (SELECT GROUP_CONCAT(sub.name, ', ')
        FROM teacher_subjects ts JOIN subjects sub ON sub.id = ts.subject_id
        WHERE ts.teacher_id = t.id ORDER BY sub.name) as subject_names
     FROM teachers t
     LEFT JOIN students s ON s.teacher_id = t.id AND s.active = 1
     GROUP BY t.id ORDER BY t.name`
  );
  const result = await Promise.all(
    teachers.map(async t => ({ ...t, subjects: await subjectsFor(t.id), tags: await tagsFor(t.id) }))
  );
  res.json(result);
});

router.get('/:id', async (req, res) => {
  const teacher = await db.get('SELECT * FROM teachers WHERE id = ?', [req.params.id]);
  if (!teacher) return res.status(404).json({ error: 'Not found' });
  res.json({ ...teacher, subjects: await subjectsFor(teacher.id), tags: await tagsFor(teacher.id) });
});

router.post('/', async (req, res) => {
  const { name, phone = '', email = '' } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const result = await db.run(
    'INSERT INTO teachers (name, phone, email) VALUES (?, ?, ?)',
    [name, phone, email]
  );
  res.json({ id: result.lastInsertRowid, name, phone, email, subjects: [] });
});

router.put('/:id', async (req, res) => {
  const { name, phone = '', email = '' } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  await db.run(
    'UPDATE teachers SET name = ?, phone = ?, email = ? WHERE id = ?',
    [name, phone, email, req.params.id]
  );
  res.json({ id: Number(req.params.id), name, phone, email });
});

router.put('/:id/subjects', async (req, res) => {
  const { subject_ids } = req.body;
  if (!Array.isArray(subject_ids)) return res.status(400).json({ error: 'subject_ids array required' });
  const stmts = [
    { sql: 'DELETE FROM teacher_subjects WHERE teacher_id = ?', args: [req.params.id] },
    ...subject_ids.map(sid => ({
      sql: 'INSERT INTO teacher_subjects (teacher_id, subject_id) VALUES (?, ?)',
      args: [req.params.id, sid]
    }))
  ];
  await db.batch(stmts);
  res.json({ subjects: await subjectsFor(req.params.id) });
});

router.delete('/:id', async (req, res) => {
  const row = await db.get(
    'SELECT COUNT(*) as c FROM students WHERE teacher_id = ? AND active = 1',
    [req.params.id]
  );
  if (row.c > 0) return res.status(400).json({ error: 'Cannot delete teacher with active students' });
  await db.run('DELETE FROM teachers WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

module.exports = router;
