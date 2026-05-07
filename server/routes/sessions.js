const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
  const { teacher_id, month, year } = req.query;
  let query = `
    SELECT s.*, t.name as teacher_name,
      st.name as student_name, g.name as group_name
    FROM sessions s
    JOIN teachers t ON t.id = s.teacher_id
    LEFT JOIN students st ON st.id = s.student_id
    LEFT JOIN class_groups g ON g.id = s.group_id
  `;
  const conditions = [];
  const params = [];
  if (teacher_id) { conditions.push('s.teacher_id = ?'); params.push(teacher_id); }
  if (month) { conditions.push('s.month = ?'); params.push(month); }
  if (year) { conditions.push('s.year = ?'); params.push(year); }
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY s.session_date DESC';
  const sessions = db.prepare(query).all(...params);

  const result = sessions.map(sess => {
    const attendance = db.prepare(`
      SELECT a.*, st.name as student_name
      FROM attendance a JOIN students st ON st.id = a.student_id
      WHERE a.session_id = ?
    `).all(sess.id);
    return { ...sess, attendance };
  });
  res.json(result);
});

router.post('/', (req, res) => {
  const { teacher_id, student_id, group_id, session_date, duration_hours, class_type, notes = '' } = req.body;
  if (!teacher_id || !session_date || !duration_hours || !class_type)
    return res.status(400).json({ error: 'teacher_id, session_date, duration_hours, class_type required' });

  const date = new Date(session_date);
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  const result = db.prepare(
    'INSERT INTO sessions (teacher_id, student_id, group_id, session_date, duration_hours, class_type, month, year, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(teacher_id, student_id || null, group_id || null, session_date, duration_hours, class_type, month, year, notes);

  const sessionId = result.lastInsertRowid;

  if (class_type === '1on1' && student_id) {
    db.prepare('INSERT INTO attendance (session_id, student_id, attended) VALUES (?, ?, 1)').run(sessionId, student_id);
  } else if (class_type === 'group' && group_id) {
    const groupStudents = db.prepare('SELECT id FROM students WHERE group_id = ? AND active = 1').all(group_id);
    const insertAtt = db.prepare('INSERT INTO attendance (session_id, student_id, attended) VALUES (?, ?, 1)');
    for (const s of groupStudents) insertAtt.run(sessionId, s.id);
  }

  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  const attendance = db.prepare(`
    SELECT a.*, st.name as student_name FROM attendance a
    JOIN students st ON st.id = a.student_id WHERE a.session_id = ?
  `).all(sessionId);
  res.json({ ...session, attendance });
});

router.put('/:id/attendance', (req, res) => {
  const { attendance } = req.body;
  if (!Array.isArray(attendance)) return res.status(400).json({ error: 'attendance array required' });
  const update = db.prepare('UPDATE attendance SET attended = ? WHERE session_id = ? AND student_id = ?');
  for (const a of attendance) update.run(a.attended ? 1 : 0, req.params.id, a.student_id);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
