const express = require('express');
const db = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();
router.use(auth, adminOnly);

router.get('/revenue/monthly', async (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ error: 'month and year required' });
  const m = parseInt(month), y = parseInt(year);

  const [studentFees, teacherWages, sessions] = await Promise.all([
    db.get(
      `SELECT COUNT(*) as count,
         SUM(total_due) as total_due,
         SUM(CASE WHEN paid=1 THEN total_due ELSE 0 END) as collected,
         SUM(CASE WHEN paid=0 THEN total_due ELSE 0 END) as outstanding,
         SUM(tuition_fee) as total_tuition,
         SUM(material_fee) as total_material
       FROM student_payments WHERE month=? AND year=?`,
      [m, y]
    ),
    db.get(
      `SELECT COUNT(*) as count,
         SUM(net_pay) as total_net_pay,
         SUM(CASE WHEN paid=1 THEN net_pay ELSE 0 END) as paid_wages,
         SUM(CASE WHEN paid=0 THEN net_pay ELSE 0 END) as outstanding_wages
       FROM teacher_payments WHERE month=? AND year=?`,
      [m, y]
    ),
    db.get(
      `SELECT COUNT(*) as session_count, SUM(duration_hours) as total_hours
       FROM sessions WHERE month=? AND year=?`,
      [m, y]
    )
  ]);

  res.json({ studentFees, teacherWages, sessions, month: m, year: y });
});

router.get('/revenue/by-teacher', async (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ error: 'month and year required' });
  const m = parseInt(month), y = parseInt(year);

  // Use correlated subqueries to avoid fan-out when joining sessions + payments together
  const rows = await db.all(
    `SELECT t.id, t.name as teacher_name,
       COUNT(DISTINCT s.id) as student_count,
       (SELECT COUNT(*) FROM sessions WHERE teacher_id = t.id AND month = ? AND year = ?) as session_count,
       COALESCE((SELECT SUM(duration_hours) FROM sessions WHERE teacher_id = t.id AND month = ? AND year = ?), 0) as total_hours,
       COALESCE((SELECT SUM(sp.total_due) FROM student_payments sp
                 JOIN students st ON st.id = sp.student_id
                 WHERE st.teacher_id = t.id AND sp.month = ? AND sp.year = ?), 0) as total_fees_due,
       COALESCE((SELECT SUM(sp.total_due) FROM student_payments sp
                 JOIN students st ON st.id = sp.student_id
                 WHERE st.teacher_id = t.id AND sp.month = ? AND sp.year = ? AND sp.paid = 1), 0) as fees_collected,
       COALESCE(tp.net_pay, 0) as teacher_net_pay,
       tp.paid as teacher_paid
     FROM teachers t
     LEFT JOIN students s ON s.teacher_id = t.id AND s.active = 1
     LEFT JOIN teacher_payments tp ON tp.teacher_id = t.id AND tp.month = ? AND tp.year = ?
     GROUP BY t.id ORDER BY total_fees_due DESC`,
    [m, y, m, y, m, y, m, y, m, y]
  );
  res.json(rows);
});

router.get('/revenue/trend', async (req, res) => {
  const months = Math.min(parseInt(req.query.months) || 6, 24);
  const rows = await db.all(
    `SELECT month, year,
       SUM(total_due) as total_due,
       SUM(CASE WHEN paid=1 THEN total_due ELSE 0 END) as collected
     FROM student_payments
     GROUP BY year, month
     ORDER BY year DESC, month DESC
     LIMIT ?`,
    [months]
  );
  res.json(rows.reverse());
});

router.get('/outstanding', async (req, res) => {
  const rows = await db.all(
    `SELECT sp.*, s.name as student_name, s.syllabus, s.class_type,
       t.name as teacher_name
     FROM student_payments sp
     JOIN students s ON s.id = sp.student_id
     JOIN teachers t ON t.id = s.teacher_id
     WHERE sp.paid = 0
     ORDER BY sp.year DESC, sp.month DESC, s.name`
  );
  const total = rows.reduce((sum, r) => sum + r.total_due, 0);
  res.json({ rows, total, count: rows.length });
});

router.get('/collection-rate', async (req, res) => {
  const rows = await db.all(
    `SELECT year, month,
       COUNT(*) as total_records,
       SUM(CASE WHEN paid=1 THEN 1 ELSE 0 END) as paid_count,
       SUM(total_due) as total_due,
       SUM(CASE WHEN paid=1 THEN total_due ELSE 0 END) as collected,
       ROUND(100.0 * SUM(CASE WHEN paid=1 THEN 1 ELSE 0 END) / COUNT(*), 1) as rate_pct
     FROM student_payments
     GROUP BY year, month
     ORDER BY year DESC, month DESC
     LIMIT 12`
  );
  res.json(rows.reverse());
});

router.get('/attendance/students', async (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ error: 'month and year required' });
  const m = parseInt(month), y = parseInt(year);

  const rows = await db.all(
    `SELECT s.id, s.name as student_name, t.name as teacher_name,
       s.syllabus, s.class_type,
       COUNT(a.id) as total_sessions,
       SUM(a.attended) as attended_count,
       ROUND(100.0 * SUM(a.attended) / NULLIF(COUNT(a.id), 0), 1) as attendance_pct
     FROM students s
     JOIN teachers t ON t.id = s.teacher_id
     LEFT JOIN attendance a ON a.student_id = s.id
     LEFT JOIN sessions sess ON sess.id = a.session_id AND sess.month = ? AND sess.year = ?
     WHERE s.active = 1
     GROUP BY s.id
     ORDER BY attendance_pct DESC`,
    [m, y]
  );
  res.json(rows);
});

router.get('/sessions/stats', async (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ error: 'month and year required' });
  const m = parseInt(month), y = parseInt(year);

  const [byTeacher, byDay, totals] = await Promise.all([
    db.all(
      `SELECT t.name as teacher_name,
         COUNT(DISTINCT sess.id) as session_count,
         SUM(sess.duration_hours) as total_hours,
         COUNT(DISTINCT CASE WHEN sess.class_type='1on1' THEN sess.id END) as oneon1_count,
         COUNT(DISTINCT CASE WHEN sess.class_type='group' THEN sess.id END) as group_count
       FROM sessions sess JOIN teachers t ON t.id = sess.teacher_id
       WHERE sess.month = ? AND sess.year = ?
       GROUP BY t.id ORDER BY session_count DESC`,
      [m, y]
    ),
    db.all(
      `SELECT session_date, COUNT(*) as count, SUM(duration_hours) as hours
       FROM sessions WHERE month = ? AND year = ?
       GROUP BY session_date ORDER BY session_date`,
      [m, y]
    ),
    db.get(
      `SELECT COUNT(*) as total_sessions, SUM(duration_hours) as total_hours,
         COUNT(CASE WHEN class_type='1on1' THEN 1 END) as oneon1,
         COUNT(CASE WHEN class_type='group' THEN 1 END) as group_count
       FROM sessions WHERE month = ? AND year = ?`,
      [m, y]
    )
  ]);

  res.json({ byTeacher, byDay, totals });
});

router.get('/students/demographics', async (req, res) => {
  const [bySyllabus, byClassType, byAge, byTeacher, totalRow] = await Promise.all([
    db.all(`SELECT syllabus, COUNT(*) as count FROM students WHERE active=1 GROUP BY syllabus`),
    db.all(`SELECT class_type, COUNT(*) as count FROM students WHERE active=1 GROUP BY class_type`),
    db.all(
      `SELECT
         CASE WHEN age < 10 THEN 'Under 10'
              WHEN age BETWEEN 10 AND 12 THEN '10-12 (Primary)'
              WHEN age BETWEEN 13 AND 15 THEN '13-15 (Lower Sec)'
              ELSE '16+ (Upper Sec)' END as age_group,
         COUNT(*) as count
       FROM students WHERE active=1
       GROUP BY age_group ORDER BY age_group`
    ),
    db.all(
      `SELECT t.name as teacher_name, COUNT(s.id) as student_count
       FROM teachers t LEFT JOIN students s ON s.teacher_id = t.id AND s.active=1
       GROUP BY t.id ORDER BY student_count DESC`
    ),
    db.get(`SELECT COUNT(*) as count FROM students WHERE active=1`)
  ]);

  res.json({ bySyllabus, byClassType, byAge, byTeacher, total: totalRow.count });
});

router.get('/teachers/performance', async (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ error: 'month and year required' });
  const m = parseInt(month), y = parseInt(year);

  const rows = await db.all(
    `SELECT t.id, t.name as teacher_name,
       COUNT(DISTINCT s.id) as active_students,
       COUNT(DISTINCT sess.id) as sessions_this_month,
       COALESCE(SUM(sess.duration_hours), 0) as hours_this_month,
       COALESCE(tp.net_pay, 0) as net_pay,
       tp.paid as wage_paid
     FROM teachers t
     LEFT JOIN students s ON s.teacher_id = t.id AND s.active = 1
     LEFT JOIN sessions sess ON sess.teacher_id = t.id AND sess.month = ? AND sess.year = ?
     LEFT JOIN teacher_payments tp ON tp.teacher_id = t.id AND tp.month = ? AND tp.year = ?
     GROUP BY t.id ORDER BY sessions_this_month DESC`,
    [m, y, m, y]
  );
  res.json(rows);
});

router.get('/fees/analysis', async (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ error: 'month and year required' });
  const m = parseInt(month), y = parseInt(year);

  const [breakdown, topStudents] = await Promise.all([
    db.all(
      `SELECT s.syllabus, s.class_type,
         COUNT(sp.id) as student_count,
         AVG(sp.hourly_rate) as avg_rate,
         AVG(sp.tuition_fee) as avg_tuition,
         SUM(sp.tuition_fee) as total_tuition,
         SUM(sp.material_fee) as total_material,
         SUM(sp.total_due) as total_due
       FROM student_payments sp
       JOIN students s ON s.id = sp.student_id
       WHERE sp.month = ? AND sp.year = ?
       GROUP BY s.syllabus, s.class_type`,
      [m, y]
    ),
    db.all(
      `SELECT s.name as student_name, t.name as teacher_name,
         sp.total_due, sp.paid, sp.classes_count, sp.duration_hours
       FROM student_payments sp
       JOIN students s ON s.id = sp.student_id
       JOIN teachers t ON t.id = s.teacher_id
       WHERE sp.month = ? AND sp.year = ?
       ORDER BY sp.total_due DESC LIMIT 10`,
      [m, y]
    )
  ]);

  res.json({ breakdown, topStudents });
});

router.get('/yearly', async (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();

  const [monthly, teacherPayments, annualTotals] = await Promise.all([
    db.all(
      `SELECT month,
         SUM(total_due) as total_due,
         SUM(CASE WHEN paid=1 THEN total_due ELSE 0 END) as collected,
         COUNT(*) as student_count
       FROM student_payments WHERE year = ?
       GROUP BY month ORDER BY month`,
      [year]
    ),
    db.all(
      `SELECT month,
         SUM(net_pay) as total_wages,
         SUM(CASE WHEN paid=1 THEN net_pay ELSE 0 END) as paid_wages
       FROM teacher_payments WHERE year = ?
       GROUP BY month ORDER BY month`,
      [year]
    ),
    db.get(
      `SELECT SUM(total_due) as total_revenue,
         SUM(CASE WHEN paid=1 THEN total_due ELSE 0 END) as total_collected
       FROM student_payments WHERE year = ?`,
      [year]
    )
  ]);

  res.json({ monthly, teacherPayments, annualTotals, year });
});

router.get('/students/status', async (req, res) => {
  const row = await db.get(
    `SELECT
       SUM(CASE WHEN active=1 THEN 1 ELSE 0 END) as active,
       SUM(CASE WHEN active=0 THEN 1 ELSE 0 END) as inactive,
       COUNT(*) as total
     FROM students`
  );
  res.json(row);
});

module.exports = router;
