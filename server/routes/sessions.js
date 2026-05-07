const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/', async (req, res) => {
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

  const sessions = await db.all(query, params);
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

router.post('/', async (req, res) => {
  const { teacher_id, student_id, group_id, session_date, duration_hours, class_type, notes = '' } = req.body;
  if (!teacher_id || !session_date || !duration_hours || !class_type)
    return res.status(400).json({ error: 'teacher_id, session_date, duration_hours, class_type required' });

  const date = new Date(session_date);
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  const result = await db.run(
    'INSERT INTO sessions (teacher_id, student_id, group_id, session_date, duration_hours, class_type, month, year, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [teacher_id, student_id || null, group_id || null, session_date, duration_hours, class_type, month, year, notes]
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

router.put('/:id/attendance', async (req, res) => {
  const { attendance } = req.body;
  if (!Array.isArray(attendance)) return res.status(400).json({ error: 'attendance array required' });
  if (attendance.length > 0) {
    await db.batch(attendance.map(a => ({
      sql: 'UPDATE attendance SET attended = ? WHERE session_id = ? AND student_id = ?',
      args: [a.attended ? 1 : 0, req.params.id, a.student_id]
    })));
  }
  res.json({ success: true });
});

router.delete('/:id', async (req, res) => {
  await db.run('DELETE FROM sessions WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

module.exports = router;
