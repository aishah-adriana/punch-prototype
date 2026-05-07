const express = require('express');
const db = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();
router.use(auth, adminOnly);

// Monthly revenue summary
router.get('/revenue/monthly', (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ error: 'month and year required' });
  const m = parseInt(month), y = parseInt(year);

  const studentFees = db.prepare(`
    SELECT COUNT(*) as count,
      SUM(total_due) as total_due,
      SUM(CASE WHEN paid=1 THEN total_due ELSE 0 END) as collected,
      SUM(CASE WHEN paid=0 THEN total_due ELSE 0 END) as outstanding,
      SUM(tuition_fee) as total_tuition,
      SUM(material_fee) as total_material
    FROM student_payments WHERE month=? AND year=?
  `).get(m, y);

  const teacherWages = db.prepare(`
    SELECT COUNT(*) as count,
      SUM(net_pay) as total_net_pay,
      SUM(CASE WHEN paid=1 THEN net_pay ELSE 0 END) as paid_wages,
      SUM(CASE WHEN paid=0 THEN net_pay ELSE 0 END) as outstanding_wages
    FROM teacher_payments WHERE month=? AND year=?
  `).get(m, y);

  const sessions = db.prepare(`
    SELECT COUNT(*) as session_count, SUM(duration_hours) as total_hours
    FROM sessions WHERE month=? AND year=?
  `).get(m, y);

  res.json({ studentFees, teacherWages, sessions, month: m, year: y });
});

// Revenue by teacher
router.get('/revenue/by-teacher', (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ error: 'month and year required' });
  const m = parseInt(month), y = parseInt(year);

  const rows = db.prepare(`
    SELECT t.id, t.name as teacher_name,
      COUNT(DISTINCT s.id) as student_count,
      COUNT(DISTINCT sess.id) as session_count,
      SUM(sess.duration_hours) as total_hours,
      COALESCE(SUM(sp.total_due), 0) as total_fees_due,
      COALESCE(SUM(CASE WHEN sp.paid=1 THEN sp.total_due ELSE 0 END), 0) as fees_collected,
      COALESCE(tp.net_pay, 0) as teacher_net_pay,
      tp.paid as teacher_paid
    FROM teachers t
    LEFT JOIN students s ON s.teacher_id = t.id AND s.active = 1
    LEFT JOIN sessions sess ON sess.teacher_id = t.id AND sess.month = ? AND sess.year = ?
    LEFT JOIN student_payments sp ON sp.student_id IN (
      SELECT id FROM students WHERE teacher_id = t.id
    ) AND sp.month = ? AND sp.year = ?
    LEFT JOIN teacher_payments tp ON tp.teacher_id = t.id AND tp.month = ? AND tp.year = ?
    GROUP BY t.id
    ORDER BY total_fees_due DESC
  `).all(m, y, m, y, m, y);

  res.json(rows);
});

// Revenue trend over last N months
router.get('/revenue/trend', (req, res) => {
  const months = Math.min(parseInt(req.query.months) || 6, 24);
  const rows = db.prepare(`
    SELECT month, year,
      SUM(total_due) as total_due,
      SUM(CASE WHEN paid=1 THEN total_due ELSE 0 END) as collected
    FROM student_payments
    GROUP BY year, month
    ORDER BY year DESC, month DESC
    LIMIT ?
  `).all(months);
  res.json(rows.reverse());
});

// Outstanding fees
router.get('/outstanding', (req, res) => {
  const rows = db.prepare(`
    SELECT sp.*, s.name as student_name, s.syllabus, s.class_type,
      t.name as teacher_name
    FROM student_payments sp
    JOIN students s ON s.id = sp.student_id
    JOIN teachers t ON t.id = s.teacher_id
    WHERE sp.paid = 0
    ORDER BY sp.year DESC, sp.month DESC, s.name
  `).all();
  const total = rows.reduce((sum, r) => sum + r.total_due, 0);
  res.json({ rows, total, count: rows.length });
});

// Collection rate per month
router.get('/collection-rate', (req, res) => {
  const rows = db.prepare(`
    SELECT year, month,
      COUNT(*) as total_records,
      SUM(CASE WHEN paid=1 THEN 1 ELSE 0 END) as paid_count,
      SUM(total_due) as total_due,
      SUM(CASE WHEN paid=1 THEN total_due ELSE 0 END) as collected,
      ROUND(100.0 * SUM(CASE WHEN paid=1 THEN 1 ELSE 0 END) / COUNT(*), 1) as rate_pct
    FROM student_payments
    GROUP BY year, month
    ORDER BY year DESC, month DESC
    LIMIT 12
  `).all();
  res.json(rows.reverse());
});

// Student attendance rates
router.get('/attendance/students', (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ error: 'month and year required' });
  const m = parseInt(month), y = parseInt(year);

  const rows = db.prepare(`
    SELECT s.id, s.name as student_name, t.name as teacher_name,
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
    ORDER BY attendance_pct DESC NULLS LAST
  `).all(m, y);

  res.json(rows);
});

// Session statistics
router.get('/sessions/stats', (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ error: 'month and year required' });
  const m = parseInt(month), y = parseInt(year);

  const byTeacher = db.prepare(`
    SELECT t.name as teacher_name,
      COUNT(DISTINCT sess.id) as session_count,
      SUM(sess.duration_hours) as total_hours,
      COUNT(DISTINCT CASE WHEN sess.class_type='1on1' THEN sess.id END) as oneon1_count,
      COUNT(DISTINCT CASE WHEN sess.class_type='group' THEN sess.id END) as group_count
    FROM sessions sess
    JOIN teachers t ON t.id = sess.teacher_id
    WHERE sess.month = ? AND sess.year = ?
    GROUP BY t.id
    ORDER BY session_count DESC
  `).all(m, y);

  const byDay = db.prepare(`
    SELECT session_date, COUNT(*) as count, SUM(duration_hours) as hours
    FROM sessions WHERE month = ? AND year = ?
    GROUP BY session_date ORDER BY session_date
  `).all(m, y);

  const totals = db.prepare(`
    SELECT COUNT(*) as total_sessions, SUM(duration_hours) as total_hours,
      COUNT(CASE WHEN class_type='1on1' THEN 1 END) as oneon1,
      COUNT(CASE WHEN class_type='group' THEN 1 END) as group_count
    FROM sessions WHERE month = ? AND year = ?
  `).get(m, y);

  res.json({ byTeacher, byDay, totals });
});

// Student demographics
router.get('/students/demographics', (req, res) => {
  const bySyllabus = db.prepare(`
    SELECT syllabus, COUNT(*) as count FROM students WHERE active=1 GROUP BY syllabus
  `).all();

  const byClassType = db.prepare(`
    SELECT class_type, COUNT(*) as count FROM students WHERE active=1 GROUP BY class_type
  `).all();

  const byAge = db.prepare(`
    SELECT
      CASE WHEN age < 10 THEN 'Under 10'
           WHEN age BETWEEN 10 AND 12 THEN '10-12 (Primary)'
           WHEN age BETWEEN 13 AND 15 THEN '13-15 (Lower Sec)'
           ELSE '16+ (Upper Sec)' END as age_group,
      COUNT(*) as count
    FROM students WHERE active=1
    GROUP BY age_group ORDER BY age_group
  `).all();

  const byTeacher = db.prepare(`
    SELECT t.name as teacher_name, COUNT(s.id) as student_count
    FROM teachers t LEFT JOIN students s ON s.teacher_id = t.id AND s.active=1
    GROUP BY t.id ORDER BY student_count DESC
  `).all();

  const total = db.prepare('SELECT COUNT(*) as count FROM students WHERE active=1').get();

  res.json({ bySyllabus, byClassType, byAge, byTeacher, total: total.count });
});

// Teacher performance
router.get('/teachers/performance', (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ error: 'month and year required' });
  const m = parseInt(month), y = parseInt(year);

  const rows = db.prepare(`
    SELECT t.id, t.name as teacher_name,
      COUNT(DISTINCT s.id) as active_students,
      COUNT(DISTINCT sess.id) as sessions_this_month,
      COALESCE(SUM(sess.duration_hours), 0) as hours_this_month,
      COALESCE(tp.net_pay, 0) as net_pay,
      tp.paid as wage_paid
    FROM teachers t
    LEFT JOIN students s ON s.teacher_id = t.id AND s.active = 1
    LEFT JOIN sessions sess ON sess.teacher_id = t.id AND sess.month = ? AND sess.year = ?
    LEFT JOIN teacher_payments tp ON tp.teacher_id = t.id AND tp.month = ? AND tp.year = ?
    GROUP BY t.id
    ORDER BY sessions_this_month DESC
  `).all(m, y, m, y);

  res.json(rows);
});

// Fee analysis
router.get('/fees/analysis', (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ error: 'month and year required' });
  const m = parseInt(month), y = parseInt(year);

  const breakdown = db.prepare(`
    SELECT s.syllabus, s.class_type,
      COUNT(sp.id) as student_count,
      AVG(sp.hourly_rate) as avg_rate,
      AVG(sp.tuition_fee) as avg_tuition,
      SUM(sp.tuition_fee) as total_tuition,
      SUM(sp.material_fee) as total_material,
      SUM(sp.total_due) as total_due
    FROM student_payments sp
    JOIN students s ON s.id = sp.student_id
    WHERE sp.month = ? AND sp.year = ?
    GROUP BY s.syllabus, s.class_type
  `).all(m, y);

  const topStudents = db.prepare(`
    SELECT s.name as student_name, t.name as teacher_name,
      sp.total_due, sp.paid, sp.classes_count, sp.duration_hours
    FROM student_payments sp
    JOIN students s ON s.id = sp.student_id
    JOIN teachers t ON t.id = s.teacher_id
    WHERE sp.month = ? AND sp.year = ?
    ORDER BY sp.total_due DESC LIMIT 10
  `).all(m, y);

  res.json({ breakdown, topStudents });
});

// Yearly summary
router.get('/yearly', (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();

  const monthly = db.prepare(`
    SELECT month,
      SUM(total_due) as total_due,
      SUM(CASE WHEN paid=1 THEN total_due ELSE 0 END) as collected,
      COUNT(*) as student_count
    FROM student_payments WHERE year = ?
    GROUP BY month ORDER BY month
  `).all(year);

  const teacherPayments = db.prepare(`
    SELECT month,
      SUM(net_pay) as total_wages,
      SUM(CASE WHEN paid=1 THEN net_pay ELSE 0 END) as paid_wages
    FROM teacher_payments WHERE year = ?
    GROUP BY month ORDER BY month
  `).all(year);

  const annualTotals = db.prepare(`
    SELECT SUM(total_due) as total_revenue,
      SUM(CASE WHEN paid=1 THEN total_due ELSE 0 END) as total_collected
    FROM student_payments WHERE year = ?
  `).get(year);

  res.json({ monthly, teacherPayments, annualTotals, year });
});

// Active vs inactive students
router.get('/students/status', (req, res) => {
  const rows = db.prepare(`
    SELECT
      SUM(CASE WHEN active=1 THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN active=0 THEN 1 ELSE 0 END) as inactive,
      COUNT(*) as total
    FROM students
  `).get();
  res.json(rows);
});

module.exports = router;
