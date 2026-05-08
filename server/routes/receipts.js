const express = require('express');
const db = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();
router.use(auth, adminOnly);

async function nextReceiptNumber() {
  const last = await db.get('SELECT receipt_number FROM receipts ORDER BY id DESC LIMIT 1');
  if (!last) return 'RCP-0001';
  const num = parseInt(last.receipt_number.split('-')[1] || '0') + 1;
  return `RCP-${String(num).padStart(4, '0')}`;
}

// Get receipt by payment_id (used after Mark Paid to fetch the auto-created receipt)
router.get('/by-payment/:payment_id', async (req, res) => {
  const receipt = await db.get(
    `SELECT r.*, s.name as student_name, s.parent_name,
            t.name as teacher_name
     FROM receipts r
     JOIN students s ON s.id = r.student_id
     JOIN teachers t ON t.id = (SELECT teacher_id FROM students WHERE id = r.student_id)
     WHERE r.payment_id = ?`,
    [Number(req.params.payment_id)]
  );
  if (!receipt) return res.status(404).json({ error: 'Receipt not found' });
  res.json(receipt);
});

// Share data for a receipt (QuickShare modal)
router.get('/:id/share', async (req, res) => {
  const receipt = await db.get(
    `SELECT r.*, s.name as student_name, s.parent_name,
            t.name as teacher_name
     FROM receipts r
     JOIN students s ON s.id = r.student_id
     JOIN teachers t ON t.id = (SELECT teacher_id FROM students WHERE id = r.student_id)
     WHERE r.id = ?`,
    [Number(req.params.id)]
  );
  if (!receipt) return res.status(404).json({ error: 'Receipt not found' });

  const recipient = receipt.parent_name || receipt.student_name;
  const message = `Thank you for your payment, ${recipient}. Your payment of RM${Number(receipt.amount).toFixed(2)} (Receipt ${receipt.receipt_number}) has been received. Thanks for choosing Punch Tuition Centre!`;
  const waLink = `https://wa.me/?text=${encodeURIComponent(message)}`;

  res.json({ receipt, message, whatsapp_link: waLink });
});

// Manual create (if ever needed)
router.post('/', async (req, res) => {
  const { student_id, payment_id, amount, description = '' } = req.body;
  if (!student_id || !payment_id || amount === undefined)
    return res.status(400).json({ error: 'student_id, payment_id, amount required' });

  const existing = await db.get('SELECT id FROM receipts WHERE payment_id = ?', [payment_id]);
  if (existing) return res.status(409).json({ error: 'Receipt already exists for this payment' });

  const receipt_number = await nextReceiptNumber();
  const receipt_date = new Date().toISOString().split('T')[0];

  const result = await db.run(
    'INSERT INTO receipts (receipt_number, student_id, payment_id, receipt_date, amount, description) VALUES (?, ?, ?, ?, ?, ?)',
    [receipt_number, student_id, payment_id, receipt_date, amount, description]
  );
  res.json(await db.get('SELECT * FROM receipts WHERE id = ?', [result.lastInsertRowid]));
});

module.exports = { router, nextReceiptNumber };
