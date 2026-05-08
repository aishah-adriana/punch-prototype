const express = require('express');
const db = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();
router.use(auth, adminOnly);

async function nextInvoiceNumber() {
  const last = await db.get('SELECT invoice_number FROM einvoices ORDER BY id DESC LIMIT 1');
  if (!last) return 'INV-0001';
  const num = parseInt(last.invoice_number.split('-')[1] || '0') + 1;
  return `INV-${String(num).padStart(4, '0')}`;
}

// ─── Recurring Rules (must be BEFORE /:id routes) ────────────────────────────

router.get('/recurring', async (req, res) => {
  const rows = await db.all(
    `SELECT r.*, s.name as student_name, t.name as teacher_name
     FROM recurring_rules r
     JOIN students s ON s.id = r.student_id
     JOIN teachers t ON t.id = s.teacher_id
     ORDER BY s.name`
  );
  res.json(rows);
});

router.post('/recurring', async (req, res) => {
  const { student_id, frequency = 'monthly', day_of_month = 1, notes = '' } = req.body;
  if (!student_id) return res.status(400).json({ error: 'student_id required' });

  const existing = await db.get('SELECT id FROM recurring_rules WHERE student_id = ?', [student_id]);
  if (existing) return res.status(409).json({ error: 'Recurring rule already exists for this student' });

  const result = await db.run(
    'INSERT INTO recurring_rules (student_id, frequency, day_of_month, notes) VALUES (?, ?, ?, ?)',
    [student_id, frequency, day_of_month, notes]
  );
  const rule = await db.get(
    `SELECT r.*, s.name as student_name FROM recurring_rules r
     JOIN students s ON s.id = r.student_id WHERE r.id = ?`,
    [result.lastInsertRowid]
  );
  res.json(rule);
});

router.put('/recurring/:id', async (req, res) => {
  const rule = await db.get('SELECT * FROM recurring_rules WHERE id = ?', [req.params.id]);
  if (!rule) return res.status(404).json({ error: 'Rule not found' });
  const { frequency, day_of_month, active, notes } = req.body;
  await db.run(
    'UPDATE recurring_rules SET frequency=?, day_of_month=?, active=?, notes=? WHERE id=?',
    [frequency ?? rule.frequency, day_of_month ?? rule.day_of_month, active ?? rule.active, notes ?? rule.notes, rule.id]
  );
  res.json(await db.get('SELECT * FROM recurring_rules WHERE id = ?', [rule.id]));
});

router.delete('/recurring/:id', async (req, res) => {
  await db.run('DELETE FROM recurring_rules WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

router.post('/recurring/:id/trigger', async (req, res) => {
  const rule = await db.get('SELECT * FROM recurring_rules WHERE id = ?', [req.params.id]);
  if (!rule) return res.status(404).json({ error: 'Rule not found' });

  const today = new Date();
  const month = today.getMonth() + 1;
  const year = today.getFullYear();

  const payment = await db.get(
    'SELECT * FROM student_payments WHERE student_id = ? AND month = ? AND year = ?',
    [rule.student_id, month, year]
  );
  if (!payment) {
    return res.status(404).json({ error: 'No fee record found for this student this month. Calculate fees first.' });
  }

  const invoice_number = await nextInvoiceNumber();
  const invoice_date = today.toISOString().split('T')[0];
  const description = `Tuition fee for ${today.toLocaleString('default', { month: 'long' })} ${year}`;

  const result = await db.run(
    `INSERT INTO einvoices (student_id, payment_id, invoice_number, invoice_date, description, amount, tax_amount, total_amount, status)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'draft')`,
    [rule.student_id, payment.id, invoice_number, invoice_date, description, payment.total_due, payment.total_due]
  );
  await db.run('UPDATE recurring_rules SET last_generated=? WHERE id=?', [invoice_date, rule.id]);

  res.json({
    ok: true,
    invoice: await db.get('SELECT * FROM einvoices WHERE id = ?', [result.lastInsertRowid])
  });
});

// ─── E-Invoices ───────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const { student_id, status } = req.query;
  let where = '';
  const params = [];
  if (student_id) { where += ' AND e.student_id = ?'; params.push(student_id); }
  if (status) { where += ' AND e.status = ?'; params.push(status); }
  const rows = await db.all(
    `SELECT e.*, s.name as student_name
     FROM einvoices e JOIN students s ON s.id = e.student_id
     WHERE 1=1 ${where} ORDER BY e.created_at DESC`,
    params
  );
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const inv = await db.get(
    `SELECT e.*, s.name as student_name, s.age, s.syllabus, s.class_type,
       t.name as teacher_name, t.email as teacher_email
     FROM einvoices e
     JOIN students s ON s.id = e.student_id
     JOIN teachers t ON t.id = (SELECT teacher_id FROM students WHERE id = e.student_id)
     WHERE e.id = ?`,
    [req.params.id]
  );
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });
  res.json(inv);
});

router.post('/', async (req, res) => {
  const { student_id, payment_id, invoice_date, amount, tax_amount = 0, description = '' } = req.body;
  if (!student_id || !invoice_date || amount === undefined)
    return res.status(400).json({ error: 'student_id, invoice_date, amount required' });

  const invoice_number = await nextInvoiceNumber();
  const total_amount = amount + tax_amount;

  const result = await db.run(
    `INSERT INTO einvoices (student_id, payment_id, invoice_number, invoice_date, description, amount, tax_amount, total_amount, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
    [student_id, payment_id || null, invoice_number, invoice_date, description, amount, tax_amount, total_amount]
  );
  res.json(await db.get('SELECT * FROM einvoices WHERE id = ?', [result.lastInsertRowid]));
});

router.put('/:id', async (req, res) => {
  const inv = await db.get('SELECT * FROM einvoices WHERE id = ?', [req.params.id]);
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });
  if (inv.status !== 'draft') return res.status(400).json({ error: 'Only draft invoices can be edited' });

  const { invoice_date, amount, tax_amount, description } = req.body;
  const total = (amount ?? inv.amount) + (tax_amount ?? inv.tax_amount);
  await db.run(
    'UPDATE einvoices SET invoice_date=?, amount=?, tax_amount=?, total_amount=?, description=? WHERE id=?',
    [invoice_date ?? inv.invoice_date, amount ?? inv.amount, tax_amount ?? inv.tax_amount, total, description ?? inv.description, inv.id]
  );
  res.json(await db.get('SELECT * FROM einvoices WHERE id = ?', [inv.id]));
});

router.post('/:id/submit', async (req, res) => {
  const inv = await db.get('SELECT * FROM einvoices WHERE id = ?', [req.params.id]);
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });
  if (inv.status !== 'draft') return res.status(400).json({ error: 'Only draft invoices can be submitted' });

  const stub_uuid = `MY-${Date.now()}-${inv.id}`;
  await db.run(
    `UPDATE einvoices SET status='submitted', myinvois_uuid=?, submitted_at=datetime('now') WHERE id=?`,
    [stub_uuid, inv.id]
  );
  res.json({
    ok: true,
    message: 'Invoice marked as submitted (MyInvois API integration requires credentials)',
    uuid: stub_uuid
  });
});

router.get('/:id/share', async (req, res) => {
  const inv = await db.get(
    `SELECT e.*, s.name as student_name, s.parent_name, s.age, s.syllabus,
       t.name as teacher_name, t.email as teacher_email, t.phone as teacher_phone
     FROM einvoices e
     JOIN students s ON s.id = e.student_id
     JOIN teachers t ON t.id = (SELECT teacher_id FROM students WHERE id = e.student_id)
     WHERE e.id = ?`,
    [req.params.id]
  );
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });

  const recipient = inv.parent_name || inv.student_name;
  const message = `Hi ${recipient}, your invoice ${inv.invoice_number} dated ${inv.invoice_date} for RM${inv.total_amount.toFixed(2)} is ready. Please contact us for payment. Thank you!`;
  const waLink = `https://wa.me/?text=${encodeURIComponent(message)}`;
  const mailtoLink = `mailto:?subject=${encodeURIComponent(`Invoice ${inv.invoice_number}`)}&body=${encodeURIComponent(message)}`;

  res.json({ invoice: inv, whatsapp_link: waLink, mailto_link: mailtoLink, message });
});

router.delete('/:id', async (req, res) => {
  const inv = await db.get('SELECT * FROM einvoices WHERE id = ?', [req.params.id]);
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });
  if (inv.status === 'submitted') return res.status(400).json({ error: 'Cannot delete submitted invoice' });
  await db.run('DELETE FROM einvoices WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
