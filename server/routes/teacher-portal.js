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

router.get('/profile', async (req, res) => {
  if (!requireTeacher(req, res)) return;
  const teacher = await db.get('SELECT * FROM teachers WHERE id = ?', [req.user.teacher_id]);
  if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
  res.json(teacher);
});

router.get('/students', async (req, res) => {
  if (!requireTeacher(req, res)) return;
  const students = await db.all(
    `SELECT s.*, g.name as group_name,
       GROUP_CONCAT(sub.name) as subjects
     FROM students s
     LEFT JOIN class_groups g ON s.group_id = g.id
     LEFT JOIN student_subjects ss ON ss.student_id = s.id
     LEFT JOIN subjects sub ON sub.id = ss.subject_id
     WHERE s.teacher_id = ? AND s.active = 1
     GROUP BY s.id ORDER BY s.name`,
    [req.user.teacher_id]
  );
  res.json(students);
});

router.get('/groups', async (req, res) => {
  if (!requireTeacher(req, res)) return;
  const groups = await db.all(
    `SELECT g.*, COUNT(s.id) as student_count
     FROM class_groups g
     LEFT JOIN students s ON s.group_id = g.id AND s.active = 1
     WHERE g.teacher_id = ?
     GROUP BY g.id ORDER BY g.name`,
    [req.user.teacher_id]
  );
  res.json(groups);
});

router.get('/sessions', async (req, res) => {
  if (!requireTeacher(req, res)) return;
  const { month, year } = req.query;
  const params = [req.user.teacher_id];
  let where = 's.teacher_id = ?';
  if (month) { where += ' AND s.month = ?'; params.push(month); }
  if (year) { where += ' AND s.year = ?'; params.push(year); }

  const sessions = await db.all(
    `SELECT s.*, st.name as student_name, g.name as group_name
     FROM sessions s
     LEFT JOIN students st ON st.id = s.student_id
     LEFT JOIN class_groups g ON g.id = s.group_id
     WHERE ${where} ORDER BY s.session_date DESC`,
    params
  );

  const result = await Promise.all(sessions.map(async sess => {
    const attendance = await db.all(
      `SELECT a.*, st.name as student_name
       FROM attendance a JOIN students st ON st.id = a.student_id
       WHERE a.session_id = ?`,
      [sess.id]
    );
    return { ...sess, attendance };
  }));
  res.json(result);
});

router.post('/sessions', async (req, res) => {
  if (!requireTeacher(req, res)) return;
  const { student_id, group_id, session_date, duration_hours, class_type, notes = '' } = req.body;
  if (!session_date || !duration_hours || !class_type)
    return res.status(400).json({ error: 'session_date, duration_hours, class_type required' });

  const date = new Date(session_date);
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  const result = await db.run(
    'INSERT INTO sessions (teacher_id, student_id, group_id, session_date, duration_hours, class_type, month, year, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [req.user.teacher_id, student_id || null, group_id || null, session_date, duration_hours, class_type, month, year, notes]
  );
  const sessionId = result.lastInsertRowid;

  if (class_type === '1on1' && student_id) {
    await db.run('INSERT INTO attendance (session_id, student_id, attended) VALUES (?, ?, 1)', [sessionId, student_id]);
  } else if (class_type === 'group' && group_id) {
    const groupStudents = await db.all('SELECT id FROM students WHERE group_id = ? AND active = 1', [group_id]);
    if (groupStudents.length > 0) {
      await db.batch(groupStudents.map(s => ({
        sql: 'INSERT INTO attendance (session_id, student_id, attended) VALUES (?, ?, 1)',
        args: [sessionId, s.id]
      })));
    }
  }

  const session = await db.get('SELECT * FROM sessions WHERE id = ?', [sessionId]);
  const attendance = await db.all(
    `SELECT a.*, st.name as student_name FROM attendance a
     JOIN students st ON st.id = a.student_id WHERE a.session_id = ?`,
    [sessionId]
  );
  res.json({ ...session, attendance });
});

router.put('/sessions/:id/attendance', async (req, res) => {
  if (!requireTeacher(req, res)) return;
  const session = await db.get(
    'SELECT * FROM sessions WHERE id = ? AND teacher_id = ?',
    [req.params.id, req.user.teacher_id]
  );
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { attendance } = req.body;
  if (!Array.isArray(attendance)) return res.status(400).json({ error: 'attendance array required' });

  if (attendance.length > 0) {
    await db.batch(attendance.map(a => ({
      sql: 'UPDATE attendance SET attended = ? WHERE session_id = ? AND student_id = ?',
      args: [a.attended ? 1 : 0, session.id, a.student_id]
    })));
  }
  res.json({ ok: true });
});

router.delete('/sessions/:id', async (req, res) => {
  if (!requireTeacher(req, res)) return;
  const session = await db.get(
    'SELECT * FROM sessions WHERE id = ? AND teacher_id = ?',
    [req.params.id, req.user.teacher_id]
  );
  if (!session) return res.status(404).json({ error: 'Session not found' });
  await db.run('DELETE FROM sessions WHERE id = ?', [session.id]);
  res.json({ ok: true });
});

module.exports = router;
