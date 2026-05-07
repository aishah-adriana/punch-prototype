const express = require('express');
const db = require('../db');
const router = express.Router();

const subjectsFor = (studentId) =>
  db.prepare(`SELECT sub.id, sub.name FROM student_subjects ss
    JOIN subjects sub ON sub.id = ss.subject_id
    WHERE ss.student_id = ? ORDER BY sub.name`).all(studentId);

const tagsFor = (studentId) =>
  db.prepare(`SELECT t.* FROM tags t JOIN student_tags st ON st.tag_id = t.id WHERE st.student_id = ?`).all(studentId);

router.get('/', (req, res) => {
  const { teacher_id, active, subject_id } = req.query;
  let query = `
    SELECT s.*, t.name as teacher_name, g.name as group_name
    FROM students s
    JOIN teachers t ON t.id = s.teacher_id
    LEFT JOIN class_groups g ON g.id = s.group_id
  `;
  const conditions = [];
  const params = [];
  if (teacher_id) { conditions.push('s.teacher_id = ?'); params.push(teacher_id); }
  if (active !== undefined) { conditions.push('s.active = ?'); params.push(Number(active)); }
  else { conditions.push('s.active = 1'); }
  if (subject_id) {
    conditions.push('EXISTS (SELECT 1 FROM student_subjects ss WHERE ss.student_id = s.id AND ss.subject_id = ?)');
    params.push(subject_id);
  }
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY s.name';
  const rows = db.prepare(query).all(...params).map(s => ({ ...s, subjects: subjectsFor(s.id), tags: tagsFor(s.id) }));
  res.json(rows);
});

// Must be before /:id to avoid route conflict
router.get('/import-lookup', (req, res) => {
  const teachers = db.prepare('SELECT id, name FROM teachers').all();
  const groups = db.prepare('SELECT id, name, teacher_id, syllabus FROM class_groups').all();
  const subjects = db.prepare('SELECT id, name FROM subjects ORDER BY name').all();
  const existing = db.prepare('SELECT name FROM students WHERE active = 1').all().map(r => r.name.trim().toLowerCase());
  res.json({ teachers, groups, subjects, existing });
});

router.get('/:id', (req, res) => {
  const student = db.prepare(`
    SELECT s.*, t.name as teacher_name, g.name as group_name
    FROM students s JOIN teachers t ON t.id = s.teacher_id
    LEFT JOIN class_groups g ON g.id = s.group_id WHERE s.id = ?
  `).get(req.params.id);
  if (!student) return res.status(404).json({ error: 'Not found' });
  res.json({ ...student, subjects: subjectsFor(student.id), tags: tagsFor(student.id) });
});

router.post('/', (req, res) => {
  const { name, age, syllabus, class_type, teacher_id, group_id } = req.body;
  if (!name || !age || !syllabus || !class_type || !teacher_id)
    return res.status(400).json({ error: 'name, age, syllabus, class_type, teacher_id required' });
  if (class_type === 'group' && !group_id)
    return res.status(400).json({ error: 'group_id required for group class' });
  const result = db.prepare(
    'INSERT INTO students (name, age, syllabus, class_type, teacher_id, group_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(name, age, syllabus, class_type, teacher_id, group_id || null);
  res.json({ id: result.lastInsertRowid, name, age, syllabus, class_type, teacher_id, group_id, subjects: [] });
});

router.put('/:id', (req, res) => {
  const { name, age, syllabus, class_type, teacher_id, group_id, active } = req.body;
  if (!name || !age || !syllabus || !class_type || !teacher_id)
    return res.status(400).json({ error: 'name, age, syllabus, class_type, teacher_id required' });
  db.prepare(
    'UPDATE students SET name=?, age=?, syllabus=?, class_type=?, teacher_id=?, group_id=?, active=? WHERE id=?'
  ).run(name, age, syllabus, class_type, teacher_id, group_id || null, active !== undefined ? active : 1, req.params.id);
  res.json({ id: Number(req.params.id), name, age, syllabus, class_type, teacher_id, group_id, active });
});

router.put('/:id/subjects', (req, res) => {
  const { subject_ids } = req.body;
  if (!Array.isArray(subject_ids)) return res.status(400).json({ error: 'subject_ids array required' });
  db.prepare('DELETE FROM student_subjects WHERE student_id = ?').run(req.params.id);
  const insert = db.prepare('INSERT INTO student_subjects (student_id, subject_id) VALUES (?, ?)');
  db.transaction(() => { for (const sid of subject_ids) insert.run(req.params.id, sid); })();
  res.json({ subjects: subjectsFor(req.params.id) });
});

router.delete('/:id', (req, res) => {
  db.prepare('UPDATE students SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.post('/bulk', (req, res) => {
  const { students } = req.body;
  if (!Array.isArray(students) || students.length === 0)
    return res.status(400).json({ error: 'students array required' });
  const existingNames = new Set(
    db.prepare('SELECT name FROM students WHERE active = 1').all().map(r => r.name.trim().toLowerCase())
  );
  const insert = db.prepare(
    'INSERT INTO students (name, age, syllabus, class_type, teacher_id, group_id) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertSubject = db.prepare('INSERT OR IGNORE INTO student_subjects (student_id, subject_id) VALUES (?, ?)');
  const results = { imported: 0, duplicates: 0, errors: [] };
  db.transaction(() => {
    for (const s of students) {
      if (existingNames.has(s.name.trim().toLowerCase())) { results.duplicates++; continue; }
      try {
        const r = insert.run(s.name.trim(), s.age, s.syllabus, s.class_type, s.teacher_id, s.group_id || null);
        if (Array.isArray(s.subject_ids)) {
          for (const sid of s.subject_ids) insertSubject.run(r.lastInsertRowid, sid);
        }
        results.imported++;
      } catch (e) { results.errors.push(`${s.name}: ${e.message}`); }
    }
  })();
  res.json(results);
});

module.exports = router;
