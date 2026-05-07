const express = require('express');
const db = require('../db');
const { getHourlyRate, calculateCollaborationFee } = require('../utils/calculations');
const router = express.Router();

// Generate/recalculate student payment records for a month
router.post('/calculate', (req, res) => {
  const { month, year } = req.body;
  if (!month || !year) return res.status(400).json({ error: 'month and year required' });

  const students = db.prepare('SELECT * FROM students WHERE active = 1').all();

  const upsertStudent = db.prepare(`
    INSERT INTO student_payments (student_id, month, year, classes_count, duration_hours, hourly_rate, tuition_fee, material_fee, total_due)
    VALUES (?, ?, ?, ?, ?, ?, ?, 6, ?)
    ON CONFLICT(student_id, month, year) DO UPDATE SET
      classes_count = excluded.classes_count,
      duration_hours = excluded.duration_hours,
      hourly_rate = excluded.hourly_rate,
      tuition_fee = excluded.tuition_fee,
      total_due = excluded.total_due
  `);

  for (const student of students) {
    let classesCount = 0;
    let totalHours = 0;
    const rate = getHourlyRate(student.age, student.syllabus, student.class_type);

    if (student.class_type === '1on1') {
      // Count sessions where student attended
      const attended = db.prepare(`
        SELECT s.duration_hours FROM sessions s
        JOIN attendance a ON a.session_id = s.id
        WHERE a.student_id = ? AND a.attended = 1 AND s.month = ? AND s.year = ?
      `).all(student.id, month, year);
      classesCount = attended.length;
      totalHours = attended.reduce((sum, s) => sum + s.duration_hours, 0);
    } else {
      // Count all held sessions for the group
      const sessions = db.prepare(`
        SELECT duration_hours FROM sessions
        WHERE group_id = ? AND month = ? AND year = ?
      `).all(student.group_id, month, year);
      classesCount = sessions.length;
      totalHours = sessions.reduce((sum, s) => sum + s.duration_hours, 0);
    }

    const tuitionFee = totalHours * rate;
    const totalDue = tuitionFee + 6;
    upsertStudent.run(student.id, month, year, classesCount, totalHours, rate, tuitionFee, totalDue);
  }

  // Now calculate teacher payments
  const teachers = db.prepare('SELECT * FROM teachers').all();

  const upsertTeacher = db.prepare(`
    INSERT INTO teacher_payments (teacher_id, month, year, total_tuition_fee, collaboration_fee, material_fee, net_pay)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(teacher_id, month, year) DO UPDATE SET
      total_tuition_fee = excluded.total_tuition_fee,
      collaboration_fee = excluded.collaboration_fee,
      material_fee = excluded.material_fee,
      net_pay = excluded.net_pay
  `);

  for (const teacher of teachers) {
    const teacherStudents = db.prepare('SELECT * FROM students WHERE teacher_id = ? AND active = 1').all(teacher.id);
    const studentFeeMap = {};
    let totalTuition = 0;

    for (const s of teacherStudents) {
      const record = db.prepare('SELECT tuition_fee FROM student_payments WHERE student_id = ? AND month = ? AND year = ?').get(s.id, month, year);
      const fee = record ? record.tuition_fee : 0;
      studentFeeMap[s.id] = fee;
      totalTuition += fee;
    }

    const collabFee = calculateCollaborationFee(teacherStudents, studentFeeMap);
    const materialFee = teacherStudents.length * 6;
    const netPay = totalTuition - collabFee + materialFee;

    upsertTeacher.run(teacher.id, month, year, totalTuition, collabFee, materialFee, netPay);
  }

  res.json({ success: true, message: `Calculated payments for ${month}/${year}` });
});

// Get student payments for a month
router.get('/students', (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ error: 'month and year required' });
  const records = db.prepare(`
    SELECT sp.*, s.name as student_name, s.age, s.syllabus, s.class_type,
      t.name as teacher_name, g.name as group_name
    FROM student_payments sp
    JOIN students s ON s.id = sp.student_id
    JOIN teachers t ON t.id = s.teacher_id
    LEFT JOIN class_groups g ON g.id = s.group_id
    WHERE sp.month = ? AND sp.year = ?
    ORDER BY t.name, s.name
  `).all(month, year);
  res.json(records);
});

// Fetch one student's fee record for a specific month (used by invoice generator)
router.get('/student-monthly', (req, res) => {
  const { student_id, month, year } = req.query;
  if (!student_id || !month || !year) return res.status(400).json({ error: 'student_id, month, year required' });
  const record = db.prepare(`
    SELECT sp.*, s.name as student_name, s.syllabus, s.class_type, t.name as teacher_name
    FROM student_payments sp
    JOIN students s ON s.id = sp.student_id
    JOIN teachers t ON t.id = s.teacher_id
    WHERE sp.student_id = ? AND sp.month = ? AND sp.year = ?
  `).get(student_id, month, year);
  if (!record) return res.status(404).json({ error: 'No fee record found. Calculate fees for this month first.' });
  res.json(record);
});

// Mark student payment as paid/unpaid
router.put('/students/:id/paid', (req, res) => {
  const { paid, notes } = req.body;
  const paid_date = paid ? new Date().toISOString().split('T')[0] : null;
  db.prepare('UPDATE student_payments SET paid = ?, paid_date = ?, notes = COALESCE(?, notes) WHERE id = ?')
    .run(paid ? 1 : 0, paid_date, notes, req.params.id);
  res.json({ success: true });
});

// Get teacher payments for a month
router.get('/teachers', (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ error: 'month and year required' });
  const records = db.prepare(`
    SELECT tp.*, t.name as teacher_name
    FROM teacher_payments tp
    JOIN teachers t ON t.id = tp.teacher_id
    WHERE tp.month = ? AND tp.year = ?
    ORDER BY t.name
  `).all(month, year);
  res.json(records);
});

// Mark teacher payment as paid/unpaid
router.put('/teachers/:id/paid', (req, res) => {
  const { paid, notes } = req.body;
  const paid_date = paid ? new Date().toISOString().split('T')[0] : null;
  db.prepare('UPDATE teacher_payments SET paid = ?, paid_date = ?, notes = COALESCE(?, notes) WHERE id = ?')
    .run(paid ? 1 : 0, paid_date, notes, req.params.id);
  res.json({ success: true });
});

// Dashboard summary
router.get('/summary', (req, res) => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const totalStudents = db.prepare('SELECT COUNT(*) as c FROM students WHERE active = 1').get().c;
  const totalTeachers = db.prepare('SELECT COUNT(*) as c FROM teachers').get().c;
  const unpaidStudents = db.prepare('SELECT COUNT(*) as c FROM student_payments WHERE month = ? AND year = ? AND paid = 0').get(month, year).c;
  const unpaidTeachers = db.prepare('SELECT COUNT(*) as c FROM teacher_payments WHERE month = ? AND year = ? AND paid = 0').get(month, year).c;
  const sessionsThisMonth = db.prepare('SELECT COUNT(*) as c FROM sessions WHERE month = ? AND year = ?').get(month, year).c;
  const totalDue = db.prepare('SELECT COALESCE(SUM(total_due), 0) as s FROM student_payments WHERE month = ? AND year = ?').get(month, year).s;
  const totalCollected = db.prepare('SELECT COALESCE(SUM(total_due), 0) as s FROM student_payments WHERE month = ? AND year = ? AND paid = 1').get(month, year).s;

  res.json({ totalStudents, totalTeachers, unpaidStudents, unpaidTeachers, sessionsThisMonth, totalDue, totalCollected, month, year });
});

module.exports = router;
