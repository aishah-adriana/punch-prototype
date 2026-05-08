import { useEffect, useState } from 'react';
import { api } from '../api';
import { StudentPayment } from '../types';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function printReceipt(r: any, monthLabel: string) {
  const w = window.open('', '_blank', 'width=700,height=800');
  if (!w) { alert('Please allow pop-ups to download the receipt PDF.'); return; }
  const recipientLabel = r.parent_name ? `Parent / Guardian: ${r.parent_name}` : '';
  w.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Receipt ${r.receipt_number}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; color: #222; padding: 48px; font-size: 14px; }
    .header { text-align: center; margin-bottom: 32px; border-bottom: 2px solid #1a1a2e; padding-bottom: 20px; }
    .header h1 { font-size: 22px; color: #1a1a2e; margin-bottom: 4px; }
    .header p { color: #555; font-size: 13px; }
    .receipt-label { text-align: center; font-size: 18px; font-weight: 700; color: #1a1a2e; margin-bottom: 24px; letter-spacing: 1px; text-transform: uppercase; }
    .info-grid { display: flex; justify-content: space-between; margin-bottom: 24px; }
    .info-block .label { font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: #888; margin-bottom: 4px; }
    .info-block .value { font-size: 14px; font-weight: 600; }
    .info-block .sub { font-size: 12px; color: #555; margin-top: 2px; }
    .divider { border: none; border-top: 1px solid #eee; margin: 16px 0; }
    .amount-row { display: flex; justify-content: space-between; padding: 12px 16px; background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 8px; margin-bottom: 24px; }
    .amount-row span { font-size: 15px; font-weight: 600; color: #15803d; }
    .thank-you { text-align: center; padding: 20px; background: #eff6ff; border-radius: 8px; margin-top: 32px; }
    .thank-you p { color: #1d4ed8; font-size: 14px; font-weight: 500; }
    .footer { margin-top: 32px; text-align: center; font-size: 11px; color: #aaa; }
    @media print { body { padding: 32px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>Punch Tuition Centre</h1>
    <p>Payment Receipt</p>
  </div>
  <div class="receipt-label">Official Receipt</div>
  <div class="info-grid">
    <div class="info-block">
      <div class="label">Receipt No.</div>
      <div class="value">${r.receipt_number}</div>
      <div class="sub">Date: ${r.receipt_date}</div>
    </div>
    <div class="info-block" style="text-align:right">
      <div class="label">Student</div>
      <div class="value">${r.student_name}</div>
      ${recipientLabel ? `<div class="sub">${recipientLabel}</div>` : ''}
    </div>
  </div>
  <hr class="divider"/>
  <div style="margin-bottom:16px; color:#555; font-size:13px;">
    Payment for: <strong>${monthLabel}</strong>
    ${r.description ? ` &bull; ${r.description}` : ''}
  </div>
  <div class="amount-row">
    <span>Amount Paid</span>
    <span>RM ${Number(r.amount).toFixed(2)}</span>
  </div>
  <div class="thank-you">
    <p>Thank you for your payment, ${r.parent_name || r.student_name}.</p>
    <p>Thanks for choosing Punch Tuition Centre!</p>
  </div>
  <div class="footer">This is an official receipt issued by Punch Tuition Centre.</div>
  <script>setTimeout(function(){ window.print(); }, 400);</script>
</body>
</html>`);
  w.document.close();
}

async function shareReceiptNative(message: string) {
  if (!('share' in navigator)) return false;
  try { await navigator.share({ title: 'Payment Receipt', text: message }); return true; }
  catch { return false; }
}

export default function StudentPayments() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [payments, setPayments] = useState<StudentPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [msg, setMsg] = useState('');
  const [filterTeacher, setFilterTeacher] = useState('');
  const [filterPaid, setFilterPaid] = useState('');
  const [receiptShare, setReceiptShare] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    try { setPayments(await api.payments.studentList(month, year)); }
    catch { setPayments([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [month, year]);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const calculate = async () => {
    setCalculating(true); setMsg('');
    try {
      await api.payments.calculate(month, year);
      setMsg('Fees calculated successfully.');
      await load();
    } catch (e: any) { setMsg(e.message); }
    finally { setCalculating(false); }
  };

  const togglePaid = async (p: StudentPayment) => {
    const markingPaid = !p.paid;
    const res = await api.payments.markStudentPaid(p.id, markingPaid);
    setPayments(ps => ps.map(x => x.id === p.id ? { ...x, paid: x.paid ? 0 : 1, paid_date: markingPaid ? now.toISOString().split('T')[0] : undefined } : x));

    // Auto-open receipt share modal after marking paid
    if (markingPaid && res.receipt_id) {
      try {
        const data = await api.receipts.share(res.receipt_id);
        setReceiptShare({ ...data, month, year });
      } catch { /* silently skip if receipt fetch fails */ }
    }
  };

  const openReceipt = async (p: StudentPayment) => {
    try {
      const data = await api.receipts.byPayment(p.id);
      const shareData = await api.receipts.share(data.id);
      setReceiptShare({ ...shareData, month, year });
    } catch { alert('No receipt found for this payment.'); }
  };

  const monthLabel = `${MONTHS[month - 1]} ${year}`;
  const teachers = [...new Set(payments.map(p => p.teacher_name))].filter(Boolean);

  const filtered = payments.filter(p =>
    (filterTeacher ? p.teacher_name === filterTeacher : true) &&
    (filterPaid === 'paid' ? p.paid === 1 : filterPaid === 'unpaid' ? p.paid === 0 : true)
  );

  const totalDue = filtered.reduce((s, p) => s + p.total_due, 0);
  const totalPaid = filtered.filter(p => p.paid).reduce((s, p) => s + p.total_due, 0);
  const totalUnpaid = totalDue - totalPaid;

  const syllabusBadge = (s: string) => s === 'Cambridge' ? 'badge-purple' : s === 'KSSM' ? 'badge-yellow' : 'badge-blue';

  return (
    <div>
      <div className="page-header">
        <div><h2>Student Fees</h2><p>Monthly fee tracking per student</p></div>
        <button className="btn btn-primary" onClick={calculate} disabled={calculating}>
          {calculating ? 'Calculating...' : '⟳ Calculate Fees'}
        </button>
      </div>

      {msg && <div className={`alert ${msg.includes('success') ? 'alert-success' : 'alert-danger'}`}>{msg}</div>}

      <div className="filters">
        <div className="month-nav">
          <button className="btn btn-outline btn-sm" onClick={prevMonth}>&lsaquo;</button>
          <span className="month-label">{MONTHS[month - 1]} {year}</span>
          <button className="btn btn-outline btn-sm" onClick={nextMonth}>&rsaquo;</button>
        </div>
        <select className="form-control" value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)}>
          <option value="">All Teachers</option>
          {teachers.map(t => <option key={t}>{t}</option>)}
        </select>
        <select className="form-control" value={filterPaid} onChange={e => setFilterPaid(e.target.value)}>
          <option value="">All Status</option>
          <option value="paid">Paid</option>
          <option value="unpaid">Unpaid</option>
        </select>
      </div>

      <div className="card-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card"><div className="label">Total Due</div><div className="value">RM {totalDue.toFixed(2)}</div></div>
        <div className="stat-card"><div className="label">Collected</div><div className="value success">RM {totalPaid.toFixed(2)}</div></div>
        <div className="stat-card"><div className="label">Outstanding</div><div className="value danger">RM {totalUnpaid.toFixed(2)}</div></div>
        <div className="stat-card"><div className="label">Unpaid Students</div><div className="value danger">{filtered.filter(p => !p.paid).length}</div></div>
      </div>

      {loading ? <div className="loading">Loading...</div> : (
        <div className="card">
          {filtered.length === 0 ? (
            <div className="empty">
              <div className="icon">💰</div>
              <p>No fee records for this month. Click "Calculate Fees" to generate them.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Student</th><th>Teacher</th><th>Syllabus</th><th>Type</th>
                    <th>Classes</th><th>Hours</th><th>Rate</th><th>Tuition</th>
                    <th>Material</th><th>Total Due</th><th>Status</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id} className={p.paid ? 'paid-row' : 'unpaid-row'}>
                      <td><strong>{p.student_name}</strong></td>
                      <td>{p.teacher_name}</td>
                      <td><span className={`badge ${syllabusBadge(p.syllabus || '')}`}>{p.syllabus}</span></td>
                      <td><span className={`badge ${p.class_type === '1on1' ? 'badge-green' : 'badge-blue'}`}>{p.class_type === '1on1' ? '1-on-1' : 'Group'}</span></td>
                      <td>{p.classes_count}</td>
                      <td>{p.duration_hours.toFixed(1)}h</td>
                      <td className="amount">RM {p.hourly_rate.toFixed(2)}/h</td>
                      <td className="amount">RM {p.tuition_fee.toFixed(2)}</td>
                      <td className="amount">RM {p.material_fee.toFixed(2)}</td>
                      <td className="amount amount-large">RM {p.total_due.toFixed(2)}</td>
                      <td>
                        {p.paid
                          ? <span className="badge badge-green">Paid {p.paid_date ? `(${p.paid_date})` : ''}</span>
                          : <span className="badge badge-red">Unpaid</span>}
                      </td>
                      <td>
                        <div className="actions">
                          <button className={`btn btn-sm ${p.paid ? 'btn-outline' : 'btn-success'}`} onClick={() => togglePaid(p)}>
                            {p.paid ? 'Mark Unpaid' : 'Mark Paid'}
                          </button>
                          {p.paid && (
                            <button className="btn btn-sm btn-whatsapp" onClick={() => openReceipt(p)} title="Share Receipt">
                              Receipt
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Receipt QuickShare Modal ── */}
      {receiptShare && (
        <div className="modal-overlay" onClick={() => setReceiptShare(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Receipt — {receiptShare.receipt.receipt_number}</h3>
              <button onClick={() => setReceiptShare(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="invoice-preview">
                <div className="inv-row"><span>Student</span><strong>{receiptShare.receipt.student_name}</strong></div>
                {receiptShare.receipt.parent_name && (
                  <div className="inv-row"><span>Parent / Guardian</span><strong>{receiptShare.receipt.parent_name}</strong></div>
                )}
                <div className="inv-row"><span>Receipt No.</span><strong>{receiptShare.receipt.receipt_number}</strong></div>
                <div className="inv-row"><span>Date</span><strong>{receiptShare.receipt.receipt_date}</strong></div>
                <div className="inv-row"><span>Period</span><strong>{monthLabel}</strong></div>
                <div className="inv-row inv-total"><span>Amount Paid</span><strong>RM {Number(receiptShare.receipt.amount).toFixed(2)}</strong></div>
              </div>

              <div className="share-message">
                <label>Message Preview</label>
                <textarea readOnly value={receiptShare.message} rows={3} />
              </div>

              <div style={{ marginBottom: 12 }}>
                <button
                  className="btn btn-outline"
                  style={{ width: '100%' }}
                  onClick={() => printReceipt(receiptShare.receipt, monthLabel)}
                >
                  🖨 Download / Print Receipt PDF
                </button>
              </div>

              <div className="share-buttons">
                {'share' in navigator && (
                  <button className="btn btn-whatsapp" onClick={() => shareReceiptNative(receiptShare.message)}>
                    Share via WhatsApp (Phone)
                  </button>
                )}
                <a href={receiptShare.whatsapp_link} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp">
                  {'share' in navigator ? 'WhatsApp (Web)' : 'Share via WhatsApp'}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
