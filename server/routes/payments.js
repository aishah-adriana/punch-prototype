const express = require('express');
const db = require('../db');
const { getHourlyRate, calculateCollaborationFee } = require('../utils/calculations');
const router = express.Router();

router.post('/calculate', async (req, res) => {
  const { month, year } = req.body;
  if (!month || !year) return res.status(400).json({ error: 'month and year required' });

  const students = await db.all('SELECT * FROM students WHERE active = 1');

  const upsertStudentSQL = `
    INSERT INTO student_payments (student_id, month, year, classes_count, duration_hours, hourly_rate, tuition_fee, material_fee, total_due)
    VALUES (?, ?, ?, ?, ?, ?, ?, 6, ?)
    ON CONFLICT(student_id, month, year) DO UPDATE SET
      classes_count = excluded.classes_count,
      duration_hours = excluded.duration_hours,
      hourly_rate = excluded.hourly_rate,
      tuition_fee = excluded.tuition_fee,
      total_due = excluded.total_due
  `;

  const studentStmts = [];
  for (const student of students) {
    let classesCount = 0;
    let totalHours = 0;
    const rate = getHourlyRate(student.age, student.syllabus, student.class_type);

    if (student.class_type === '1on1') {
      const attended = await db.all(
        `SELECT s.duration_hours FROM sessions s
         JOIN attendance a ON a.session_id = s.id
         WHERE a.student_id = ? AND a.attended = 1 AND s.month = ? AND s.year = ?`,
        [student.id, month, year]
      );
      classesCount = attended.length;
      totalHours = attended.reduce((sum, s) => sum + s.duration_hours, 0);
    } else {
      const sessions = await db.all(
        'SELECT duration_hours FROM sessions WHERE group_id = ? AND month = ? AND year = ?',
        [student.group_id, month, year]
      );
      classesCount = sessions.length;
      totalHours = sessions.reduce((sum, s) => sum + s.duration_hours, 0);
    }

    const tuitionFee = totalHours * rate;
    const totalDue = tuitionFee + 6;
    studentStmts.push({ sql: upsertStudentSQL, args: [student.id, month, year, classesCount, totalHours, rate, tuitionFee, totalDue] });
  }
  if (studentStmts.length > 0) await db.batch(studentStmts);

  const teachers = await db.all('SELECT * FROM teachers');
  const upsertTeacherSQL = `
    INSERT INTO teacher_payments (teacher_id, month, year, total_tuition_fee, collaboration_fee, material_fee, net_pay)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(teacher_id, month, year) DO UPDATE SET
      total_tuition_fee = excluded.total_tuition_fee,
      collaboration_fee = excluded.collaboration_fee,
      material_fee = excluded.material_fee,
      net_pay = excluded.net_pay
  `;

  const teacherStmts = [];
  for (const teacher of teachers) {
    const teacherStudents = await db.all(
      'SELECT * FROM students WHERE teacher_id = ? AND active = 1',
      [teacher.id]
    );
    const studentFeeMap = {};
    let totalTuition = 0;

    for (const s of teacherStudents) {
      const record = await db.get(
        'SELECT tuition_fee FROM student_payments WHERE student_id = ? AND month = ? AND year = ?',
        [s.id, month, year]
      );
      const fee = record ? record.tuition_fee : 0;
      studentFeeMap[s.id] = fee;
      totalTuition += fee;
    }

    const collabFee = calculateCollaborationFee(teacherStudents, studentFeeMap);
    const materialFee = teacherStudents.length * 6;
    const netPay = totalTuition - collabFee + materialFee;
    teacherStmts.push({ sql: upsertTeacherSQL, args: [teacher.id, month, year, totalTuition, collabFee, materialFee, netPay] });
  }
  if (teacherStmts.length > 0) await db.batch(teacherStmts);

  res.json({ success: true, message: `Calculated payments for ${month}/${year}` });
});

router.get('/students', async (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ error: 'month and year required' });
  const records = await db.all(
    `SELECT sp.*, s.name as student_name, s.age, s.syllabus, s.class_type,
       t.name as teacher_name, g.name as group_name
     FROM student_payments sp
     JOIN students s ON s.id = sp.student_id
     JOIN teachers t ON t.id = s.teacher_id
     LEFT JOIN class_groups g ON g.id = s.group_id
     WHERE sp.month = ? AND sp.year = ?
     ORDER BY t.name, s.name`,
    [month, year]
  );
  res.json(records);
});

router.get('/student-monthly', async (req, res) => {
  const { student_id, month, year } = req.query;
  if (!student_id || !month || !year) return res.status(400).json({ error: 'student_id, month, year required' });
  const record = await db.get(
    `SELECT sp.*, s.name as student_name, s.syllabus, s.class_type, t.name as teacher_name
     FROM student_payments sp
     JOIN students s ON s.id = sp.student_id
     JOIN teachers t ON t.id = s.teacher_id
     WHERE sp.student_id = ? AND sp.month = ? AND sp.year = ?`,
    [student_id, month, year]
  );
  if (!record) return res.status(404).json({ error: 'No fee record found. Calculate fees for this month first.' });
  res.json(record);
});

router.put('/students/:id/paid', async (req, res) => {
  const { paid, notes } = req.body;
  const paid_date = paid ? new Date().toISOString().split('T')[0] : null;
  await db.run(
    'UPDATE student_payments SET paid = ?, paid_date = ?, notes = COALESCE(?, notes) WHERE id = ?',
    [paid ? 1 : 0, paid_date, notes, req.params.id]
  );
  res.json({ success: true });
});

router.get('/teachers', async (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ error: 'month and year required' });
  const records = await db.all(
    `SELECT tp.*, t.name as teacher_name
     FROM teacher_payments tp
     JOIN teachers t ON t.id = tp.teacher_id
     WHERE tp.month = ? AND tp.year = ?
     ORDER BY t.name`,
    [month, year]
  );
  res.json(records);
});

router.put('/teachers/:id/paid', async (req, res) => {
  const { paid, notes } = req.body;
  const paid_date = paid ? new Date().toISOString().split('T')[0] : null;
  await db.run(
    'UPDATE teacher_payments SET paid = ?, paid_date = ?, notes = COALESCE(?, notes) WHERE id = ?',
    [paid ? 1 : 0, paid_date, notes, req.params.id]
  );
  res.json({ success: true });
});

router.get('/summary', async (req, res) => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [totalStudentsRow, totalTeachersRow, unpaidStudentsRow, unpaidTeachersRow, sessionsRow, totalDueRow, totalCollectedRow] = await Promise.all([
    db.get('SELECT COUNT(*) as c FROM students WHERE active = 1'),
    db.get('SELECT COUNT(*) as c FROM teachers'),
    db.get('SELECT COUNT(*) as c FROM student_payments WHERE month = ? AND year = ? AND paid = 0', [month, year]),
    db.get('SELECT COUNT(*) as c FROM teacher_payments WHERE month = ? AND year = ? AND paid = 0', [month, year]),
    db.get('SELECT COUNT(*) as c FROM sessions WHERE month = ? AND year = ?', [month, year]),
    db.get('SELECT COALESCE(SUM(total_due), 0) as s FROM student_payments WHERE month = ? AND year = ?', [month, year]),
    db.get('SELECT COALESCE(SUM(total_due), 0) as s FROM student_payments WHERE month = ? AND year = ? AND paid = 1', [month, year])
  ]);

  res.json({
    totalStudents: totalStudentsRow.c,
    totalTeachers: totalTeachersRow.c,
    unpaidStudents: unpaidStudentsRow.c,
    unpaidTeachers: unpaidTeachersRow.c,
    sessionsThisMonth: sessionsRow.c,
    totalDue: totalDueRow.s,
    totalCollected: totalCollectedRow.s,
    month,
    year
  });
});

module.exports = router;
