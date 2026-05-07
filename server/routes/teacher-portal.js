const express = require('express');
const db = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();
router.use(auth);

function requireTeacher(req, res) {
  if (!req.user.teacher_id) {
    res.status(403).json({ error: 'Teacher account required' });
    return false;
  }
  return true;
}

// GET /api/teacher-portal/profile
router.get('/profile', (req, res) => {
  if (!requireTeacher(req, res)) return;
  const teacher = db.prepare('SELECT * FROM teachers WHERE id = ?').get(req.user.teacher_id);
  if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
  res.json(teacher);
});

// GET /api/teacher-portal/students
router.get('/students', (req, res) => {
  if (!requireTeacher(req, res)) return;
  const students = db.prepare(`
    SELECT s.*, g.name as group_name,
      GROUP_CONCAT(sub.name) as subjects
    FROM students s
    LEFT JOIN class_groups g ON s.group_id = g.id
    LEFT JOIN student_subjects ss ON ss.student_id = s.id
    LEFT JOIN subjects sub ON sub.id = ss.subject_id
    WHERE s.teacher_id = ? AND s.active = 1
    GROUP BY s.id
    ORDER BY s.name
  `).all(req.user.teacher_id);
  res.json(students);
});

// GET /api/teacher-portal/groups
router.get('/groups', (req, res) => {
  if (!requireTeacher(req, res)) return;
  const groups = db.prepare(`
    SELECT g.*, COUNT(s.id) as student_count
    FROM class_groups g
    LEFT JOIN students s ON s.group_id = g.id AND s.active = 1
    WHERE g.teacher_id = ?
    GROUP BY g.id
    ORDER BY g.name
  `).all(req.user.teacher_id);
  res.json(groups);
});

// GET /api/teacher-portal/sessions
router.get('/sessions', (req, res) => {
  if (!requireTeacher(req, res)) return;
  const { month, year } = req.query;
  const params = [req.user.teacher_id];
  let where = 's.teacher_id = ?';
  if (month) { where += ' AND s.month = ?'; params.push(month); }
  if (year) { where += ' AND s.year = ?'; params.push(year); }

  const sessions = db.prepare(`
    SELECT s.*, st.name as student_name, g.name as group_name
    FROM sessions s
    LEFT JOIN students st ON st.id = s.student_id
    LEFT JOIN class_groups g ON g.id = s.group_id
    WHERE ${where}
    ORDER BY s.session_date DESC
  `).all(...params);

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

// POST /api/teacher-portal/sessions
router.post('/sessions', (req, res) => {
  if (!requireTeacher(req, res)) return;
  const { student_id, group_id, session_date, duration_hours, class_type, notes = '' } = req.body;
  if (!session_date || !duration_hours || !class_type)
    return res.status(400).json({ error: 'session_date, duration_hours, class_type required' });

  const date = new Date(session_date);
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  const result = db.prepare(
    'INSERT INTO sessions (teacher_id, student_id, group_id, session_date, duration_hours, class_type, month, year, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(req.user.teacher_id, student_id || null, group_id || null, session_date, duration_hours, class_type, month, year, notes);

  const sessionId = result.lastInsertRowid;

  if (class_type === '1on1' && student_id) {
    db.prepare('INSERT INTO attendance (session_id, student_id, attended) VALUES (?, ?, 1)').run(sessionId, student_id);
  } else if (class_type === 'group' && group_id) {
    const groupStudents = db.prepare('SELECT id FROM students WHERE group_id = ? AND active = 1').all(group_id);
    const ins = db.prepare('INSERT INTO attendance (session_id, student_id, attended) VALUES (?, ?, 1)');
    for (const s of groupStudents) ins.run(sessionId, s.id);
  }

  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  const attendance = db.prepare(`
    SELECT a.*, st.name as student_name FROM attendance a
    JOIN students st ON st.id = a.student_id WHERE a.session_id = ?
  `).all(sessionId);
  res.json({ ...session, attendance });
});

// PUT /api/teacher-portal/sessions/:id/attendance
router.put('/sessions/:id/attendance', (req, res) => {
  if (!requireTeacher(req, res)) return;
  const session = db.prepare('SELECT * FROM sessions WHERE id = ? AND teacher_id = ?')
    .get(req.params.id, req.user.teacher_id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { attendance } = req.body;
  if (!Array.isArray(attendance)) return res.status(400).json({ error: 'attendance array required' });

  const update = db.prepare('UPDATE attendance SET attended = ? WHERE session_id = ? AND student_id = ?');
  for (const a of attendance) update.run(a.attended ? 1 : 0, session.id, a.student_id);
  res.json({ ok: true });
});

// DELETE /api/teacher-portal/sessions/:id
router.delete('/sessions/:id', (req, res) => {
  if (!requireTeacher(req, res)) return;
  const session = db.prepare('SELECT * FROM sessions WHERE id = ? AND teacher_id = ?')
    .get(req.params.id, req.user.teacher_id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  db.prepare('DELETE FROM sessions WHERE id = ?').run(session.id);
  res.json({ ok: true });
});

module.exports = router;
