import { useState, useEffect } from 'react';
import { api } from '../api';

type InvoiceTab = 'invoices' | 'recurring';
type CreateMode = 'manual' | 'from-fee';
const STATUS_COLORS: Record<string, string> = { draft: 'blue', submitted: 'purple', accepted: 'green', rejected: 'red' };
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const now = new Date();

export default function Invoices() {
  const [tab, setTab] = useState<InvoiceTab>('invoices');
  const [invoices, setInvoices] = useState<any[]>([]);
  const [recurring, setRecurring] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);

  // create invoice form state
  const [showForm, setShowForm] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode>('from-fee');
  const [feeMonth, setFeeMonth] = useState(now.getMonth() + 1);
  const [feeYear, setFeeYear] = useState(now.getFullYear());
  const [feeRecord, setFeeRecord] = useState<any | null>(null);
  const [feeLoading, setFeeLoading] = useState(false);
  const [form, setForm] = useState({ student_id: '', invoice_date: now.toISOString().split('T')[0], amount: '', description: '' });

  // share modal
  const [shareData, setShareData] = useState<any | null>(null);

  // recurring form state
  const [showRecurForm, setShowRecurForm] = useState(false);
  const [recurForm, setRecurForm] = useState({ student_id: '', frequency: 'monthly', day_of_month: '1', notes: '' });

  const [error, setError] = useState('');

  function refresh() {
    api.invoices.list().then(setInvoices);
    api.invoices.recurring.list().then(setRecurring);
    api.students.list({ active: 1 }).then(setStudents);
  }
  useEffect(() => { refresh(); }, []);

  // Auto-fetch fee record when student/month/year change in 'from-fee' mode
  useEffect(() => {
    if (createMode !== 'from-fee' || !form.student_id) { setFeeRecord(null); return; }
    setFeeLoading(true);
    setFeeRecord(null);
    api.payments.studentMonthly(Number(form.student_id), feeMonth, feeYear)
      .then(rec => {
        setFeeRecord(rec);
        setForm(f => ({
          ...f,
          amount: String(rec.total_due),
          description: `Tuition fee for ${MONTHS[feeMonth - 1]} ${feeYear}`,
          invoice_date: now.toISOString().split('T')[0]
        }));
      })
      .catch(() => setFeeRecord(null))
      .finally(() => setFeeLoading(false));
  }, [form.student_id, feeMonth, feeYear, createMode]);

  async function createInvoice() {
    setError('');
    if (!form.student_id || !form.amount) return setError('Student and amount required');
    try {
      const payload: any = {
        student_id: Number(form.student_id),
        invoice_date: form.invoice_date,
        amount: Number(form.amount),
        description: form.description
      };
      if (createMode === 'from-fee' && feeRecord) payload.payment_id = feeRecord.id;
      await api.invoices.create(payload);
      setShowForm(false);
      setForm({ student_id: '', invoice_date: now.toISOString().split('T')[0], amount: '', description: '' });
      setFeeRecord(null);
      refresh();
    } catch (err: any) { setError(err.message); }
  }

  async function submitToLHDN(id: number) {
    if (!confirm('Submit this invoice to LHDN MyInvois? This will mark it as submitted.')) return;
    try { await api.invoices.submit(id); refresh(); }
    catch (err: any) { alert(err.message); }
  }

  async function openShare(id: number) {
    const data = await api.invoices.share(id);
    setShareData(data);
  }

  async function deleteInvoice(id: number) {
    if (!confirm('Delete this invoice?')) return;
    await api.invoices.delete(id);
    refresh();
  }

  async function createRecurring() {
    setError('');
    if (!recurForm.student_id) return setError('Student required');
    try {
      await api.invoices.recurring.create({ ...recurForm, student_id: Number(recurForm.student_id), day_of_month: Number(recurForm.day_of_month) });
      setShowRecurForm(false);
      setRecurForm({ student_id: '', frequency: 'monthly', day_of_month: '1', notes: '' });
      refresh();
    } catch (err: any) { setError(err.message); }
  }

  async function triggerRecurring(id: number) {
    try {
      const result = await api.invoices.recurring.trigger(id);
      alert(`Invoice ${result.invoice.invoice_number} created for RM${result.invoice.total_amount.toFixed(2)}`);
      refresh();
    } catch (err: any) { alert(err.message); }
  }

  async function deleteRecurring(id: number) {
    if (!confirm('Delete this recurring rule?')) return;
    await api.invoices.recurring.delete(id);
    refresh();
  }

  return (
    <div>
      <div className="page-header">
        <h1>Invoices</h1>
        <button className="btn btn-primary" onClick={() => { setShowForm(true); setError(''); setFeeRecord(null); }}>+ New Invoice</button>
      </div>

      <div className="report-tabs">
        <button className={`report-tab ${tab === 'invoices' ? 'active' : ''}`} onClick={() => setTab('invoices')}>E-Invoices</button>
        <button className={`report-tab ${tab === 'recurring' ? 'active' : ''}`} onClick={() => setTab('recurring')}>Repeating Invoices</button>
      </div>

      {/* ── Create Invoice Form ── */}
      {showForm && (
        <div className="card" style={{ marginBottom: '1.5rem', maxWidth: 560 }}>
          <h3>New Invoice</h3>
          {error && <div className="alert alert-error">{error}</div>}

          {/* Mode toggle */}
          <div className="mode-toggle">
            <button className={`mode-btn ${createMode === 'from-fee' ? 'active' : ''}`} onClick={() => setCreateMode('from-fee')}>
              From Fee Record
            </button>
            <button className={`mode-btn ${createMode === 'manual' ? 'active' : ''}`} onClick={() => setCreateMode('manual')}>
              Manual
            </button>
          </div>

          <div className="form-group" style={{ marginTop: 12 }}>
            <label>Student</label>
            <select value={form.student_id} onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))}>
              <option value="">Select student...</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {createMode === 'from-fee' && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label>Month</label>
                  <select value={feeMonth} onChange={e => setFeeMonth(Number(e.target.value))}>
                    {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Year</label>
                  <select value={feeYear} onChange={e => setFeeYear(Number(e.target.value))}>
                    {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>

              {feeLoading && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Looking up fee record...</p>}

              {form.student_id && !feeLoading && feeRecord && (
                <div className="fee-record-preview">
                  <div className="fee-row"><span>Classes attended</span><strong>{feeRecord.classes_count}</strong></div>
                  <div className="fee-row"><span>Duration</span><strong>{feeRecord.duration_hours}h</strong></div>
                  <div className="fee-row"><span>Hourly rate</span><strong>RM {feeRecord.hourly_rate}/hr</strong></div>
                  <div className="fee-row"><span>Tuition fee</span><strong>RM {feeRecord.tuition_fee.toFixed(2)}</strong></div>
                  <div className="fee-row"><span>Material fee</span><strong>RM {feeRecord.material_fee.toFixed(2)}</strong></div>
                  <div className="fee-row fee-total"><span>Total due</span><strong>RM {feeRecord.total_due.toFixed(2)}</strong></div>
                  {feeRecord.paid ? <div className="fee-paid-badge">Already marked as paid</div> : null}
                </div>
              )}

              {form.student_id && !feeLoading && !feeRecord && (
                <div className="alert alert-error">No fee record found for this student in {MONTHS[feeMonth - 1]} {feeYear}. Go to Student Fees and calculate fees for this month first.</div>
              )}
            </>
          )}

          <div className="form-row" style={{ marginTop: 12 }}>
            <div className="form-group">
              <label>Invoice Date</label>
              <input type="date" value={form.invoice_date} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Amount (RM)</label>
              <input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" readOnly={createMode === 'from-fee' && !!feeRecord} />
            </div>
          </div>
          <div className="form-group">
            <label>Description</label>
            <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Tuition fee April 2025" />
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" onClick={createInvoice} disabled={createMode === 'from-fee' && !!form.student_id && !feeRecord}>
              Create Invoice
            </button>
            <button className="btn btn-outline" onClick={() => { setShowForm(false); setError(''); setFeeRecord(null); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── QuickShare Modal ── */}
      {shareData && (
        <div className="modal-overlay" onClick={() => setShareData(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>QuickShare — {shareData.invoice.invoice_number}</h3>
              <button onClick={() => setShareData(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="invoice-preview">
                <div className="inv-row"><span>Student</span><strong>{shareData.invoice.student_name}</strong></div>
                <div className="inv-row"><span>Invoice No.</span><strong>{shareData.invoice.invoice_number}</strong></div>
                <div className="inv-row"><span>Date</span><strong>{shareData.invoice.invoice_date}</strong></div>
                <div className="inv-row"><span>Description</span><strong>{shareData.invoice.description || '—'}</strong></div>
                <div className="inv-row inv-total"><span>Total Amount</span><strong>RM {shareData.invoice.total_amount.toFixed(2)}</strong></div>
              </div>
              <div className="share-message">
                <label>Message Preview</label>
                <textarea readOnly value={shareData.message} rows={4} />
              </div>
              <div className="share-buttons">
                <a href={shareData.whatsapp_link} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp">
                  Share via WhatsApp
                </a>
                <a href={shareData.mailto_link} className="btn btn-email">
                  Share via Email
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── E-Invoices List ── */}
      {tab === 'invoices' && (
        <div>
          <div className="lhdn-notice">
            <strong>LHDN E-Invoice (MyInvois)</strong> — Submit LHDN-compliant invoices to MyInvois. Full API integration requires your MyInvois API credentials in the server environment variables.
          </div>
          {invoices.length === 0 ? (
            <div className="empty-state">No invoices yet. Create your first invoice above.</div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Invoice No.</th><th>Student</th><th>Period</th><th>Description</th>
                    <th>Amount</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id}>
                      <td><code>{inv.invoice_number}</code></td>
                      <td>{inv.student_name}</td>
                      <td>{inv.invoice_date}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{inv.description || '—'}</td>
                      <td><strong>RM {inv.total_amount.toFixed(2)}</strong></td>
                      <td><span className={`badge badge-${STATUS_COLORS[inv.status] || 'blue'}`}>{inv.status}</span></td>
                      <td>
                        <button className="btn btn-sm btn-whatsapp" onClick={() => openShare(inv.id)} title="QuickShare via WhatsApp/Email">Share</button>
                        {inv.status === 'draft' && (
                          <button className="btn btn-sm btn-purple" onClick={() => submitToLHDN(inv.id)} title="Submit to LHDN MyInvois">LHDN</button>
                        )}
                        {inv.status === 'draft' && (
                          <button className="btn btn-sm btn-danger" onClick={() => deleteInvoice(inv.id)}>Del</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Recurring Invoices ── */}
      {tab === 'recurring' && (
        <div>
          <div className="page-subheader">
            <p>Set up recurring invoice rules per student. Click <strong>Generate</strong> each month to auto-create an invoice from their fee record.</p>
            <button className="btn btn-primary btn-sm" onClick={() => { setShowRecurForm(true); setError(''); }}>+ Add Rule</button>
          </div>

          {showRecurForm && (
            <div className="card" style={{ marginBottom: '1.5rem', maxWidth: 480 }}>
              <h3>New Recurring Rule</h3>
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-group">
                <label>Student</label>
                <select value={recurForm.student_id} onChange={e => setRecurForm(f => ({ ...f, student_id: e.target.value }))}>
                  <option value="">Select student...</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Frequency</label>
                  <select value={recurForm.frequency} onChange={e => setRecurForm(f => ({ ...f, frequency: e.target.value }))}>
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Day of Month</label>
                  <input type="number" min="1" max="28" value={recurForm.day_of_month} onChange={e => setRecurForm(f => ({ ...f, day_of_month: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <input type="text" value={recurForm.notes} onChange={e => setRecurForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" />
              </div>
              <div className="form-actions">
                <button className="btn btn-primary" onClick={createRecurring}>Save Rule</button>
                <button className="btn btn-outline" onClick={() => { setShowRecurForm(false); setError(''); }}>Cancel</button>
              </div>
            </div>
          )}

          {recurring.length === 0 ? (
            <div className="empty-state">No recurring rules yet.</div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Student</th><th>Teacher</th><th>Frequency</th><th>Day</th><th>Status</th><th>Last Generated</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {recurring.map(r => (
                    <tr key={r.id}>
                      <td>{r.student_name}</td>
                      <td>{r.teacher_name}</td>
                      <td>{r.frequency}</td>
                      <td>{r.day_of_month}</td>
                      <td><span className={`badge badge-${r.active ? 'green' : 'red'}`}>{r.active ? 'Active' : 'Paused'}</span></td>
                      <td>{r.last_generated || 'Never'}</td>
                      <td>
                        <button className="btn btn-sm btn-primary" onClick={() => triggerRecurring(r.id)}>Generate</button>
                        <button className="btn btn-sm btn-outline" onClick={() => api.invoices.recurring.update(r.id, { active: r.active ? 0 : 1 }).then(refresh)}>
                          {r.active ? 'Pause' : 'Resume'}
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => deleteRecurring(r.id)}>Del</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
