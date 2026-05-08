const express = require('express');
const db = require('../db');
const router = express.Router();

const subjectsFor = (studentId) =>
  db.all(
    `SELECT sub.id, sub.name FROM student_subjects ss
     JOIN subjects sub ON sub.id = ss.subject_id
     WHERE ss.student_id = ? ORDER BY sub.name`,
    [studentId]
  );

const tagsFor = (studentId) =>
  db.all(
    `SELECT t.* FROM tags t JOIN student_tags st ON st.tag_id = t.id WHERE st.student_id = ?`,
    [studentId]
  );

router.get('/', async (req, res) => {
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

  const rows = await db.all(query, params);
  const result = await Promise.all(
    rows.map(async s => ({ ...s, subjects: await subjectsFor(s.id), tags: await tagsFor(s.id) }))
  );
  res.json(result);
});

// Must be before /:id to avoid route conflict
router.get('/import-lookup', async (req, res) => {
  const [teachers, groups, subjects, existing] = await Promise.all([
    db.all('SELECT id, name FROM teachers'),
    db.all('SELECT id, name, teacher_id, syllabus FROM class_groups'),
    db.all('SELECT id, name FROM subjects ORDER BY name'),
    db.all('SELECT name FROM students WHERE active = 1')
  ]);
  res.json({ teachers, groups, subjects, existing: existing.map(r => r.name.trim().toLowerCase()) });
});

router.get('/:id', async (req, res) => {
  const student = await db.get(
    `SELECT s.*, t.name as teacher_name, g.name as group_name
     FROM students s JOIN teachers t ON t.id = s.teacher_id
     LEFT JOIN class_groups g ON g.id = s.group_id WHERE s.id = ?`,
    [req.params.id]
  );
  if (!student) return res.status(404).json({ error: 'Not found' });
  res.json({ ...student, subjects: await subjectsFor(student.id), tags: await tagsFor(student.id) });
});

router.post('/', async (req, res) => {
  const { name, age, syllabus, class_type, teacher_id, group_id, parent_name = '' } = req.body;
  if (!name || !age || !syllabus || !class_type || !teacher_id)
    return res.status(400).json({ error: 'name, age, syllabus, class_type, teacher_id required' });
  if (class_type === 'group' && !group_id)
    return res.status(400).json({ error: 'group_id required for group class' });

  const result = await db.run(
    'INSERT INTO students (name, parent_name, age, syllabus, class_type, teacher_id, group_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [name, parent_name, age, syllabus, class_type, teacher_id, group_id || null]
  );

  // Auto-create recurring invoice rule for new student
  await db.run(
    'INSERT OR IGNORE INTO recurring_rules (student_id, frequency, day_of_month, notes) VALUES (?, ?, ?, ?)',
    [result.lastInsertRowid, 'monthly', 1, '']
  );

  res.json({ id: result.lastInsertRowid, name, parent_name, age, syllabus, class_type, teacher_id, group_id, subjects: [] });
});

router.put('/:id', async (req, res) => {
  const { name, age, syllabus, class_type, teacher_id, group_id, active, parent_name = '' } = req.body;
  if (!name || !age || !syllabus || !class_type || !teacher_id)
    return res.status(400).json({ error: 'name, age, syllabus, class_type, teacher_id required' });
  await db.run(
    'UPDATE students SET name=?, parent_name=?, age=?, syllabus=?, class_type=?, teacher_id=?, group_id=?, active=? WHERE id=?',
    [name, parent_name, age, syllabus, class_type, teacher_id, group_id || null, active !== undefined ? active : 1, req.params.id]
  );
  res.json({ id: Number(req.params.id), name, parent_name, age, syllabus, class_type, teacher_id, group_id, active });
});

router.put('/:id/subjects', async (req, res) => {
  const { subject_ids } = req.body;
  if (!Array.isArray(subject_ids)) return res.status(400).json({ error: 'subject_ids array required' });
  const stmts = [
    { sql: 'DELETE FROM student_subjects WHERE student_id = ?', args: [req.params.id] },
    ...subject_ids.map(sid => ({
      sql: 'INSERT INTO student_subjects (student_id, subject_id) VALUES (?, ?)',
      args: [req.params.id, sid]
    }))
  ];
  await db.batch(stmts);
  res.json({ subjects: await subjectsFor(req.params.id) });
});

router.delete('/:id', async (req, res) => {
  await db.run('UPDATE students SET active = 0 WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

router.post('/bulk', async (req, res) => {
  const { students } = req.body;
  if (!Array.isArray(students) || students.length === 0)
    return res.status(400).json({ error: 'students array required' });

  const existingRows = await db.all('SELECT name FROM students WHERE active = 1');
  const existingNames = new Set(existingRows.map(r => r.name.trim().toLowerCase()));

  const results = { imported: 0, duplicates: 0, errors: [] };

  for (const s of students) {
    if (existingNames.has(s.name.trim().toLowerCase())) { results.duplicates++; continue; }
    try {
      const r = await db.run(
        'INSERT INTO students (name, parent_name, age, syllabus, class_type, teacher_id, group_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [s.name.trim(), s.parent_name || '', s.age, s.syllabus, s.class_type, s.teacher_id, s.group_id || null]
      );
      if (Array.isArray(s.subject_ids) && s.subject_ids.length > 0) {
        await db.batch(s.subject_ids.map(sid => ({
          sql: 'INSERT OR IGNORE INTO student_subjects (student_id, subject_id) VALUES (?, ?)',
          args: [r.lastInsertRowid, sid]
        })));
      }
      // Auto-create recurring invoice rule
      await db.run(
        'INSERT OR IGNORE INTO recurring_rules (student_id, frequency, day_of_month, notes) VALUES (?, ?, ?, ?)',
        [r.lastInsertRowid, 'monthly', 1, '']
      );
      results.imported++;
    } catch (e) { results.errors.push(`${s.name}: ${e.message}`); }
  }

  res.json(results);
});

module.exports = router;
