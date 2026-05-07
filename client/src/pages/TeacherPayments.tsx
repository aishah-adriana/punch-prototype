import { useEffect, useState } from 'react';
import { api } from '../api';
import { TeacherPayment } from '../types';
import Modal from '../components/Modal';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function PaymentDetail({ payment, onClose }: { payment: TeacherPayment; onClose: () => void }) {
  return (
    <Modal title={`${payment.teacher_name} — Wage Breakdown`} onClose={onClose}>
      <div className="info-row"><span className="label">Total Tuition Fees</span><span className="amount">RM {payment.total_tuition_fee.toFixed(2)}</span></div>
      <div className="info-row"><span className="label">Collaboration Fee (deducted)</span><span className="amount" style={{ color: 'var(--danger)' }}>− RM {payment.collaboration_fee.toFixed(2)}</span></div>
      <div className="info-row"><span className="label">Material Fees (added)</span><span className="amount" style={{ color: 'var(--success)' }}>+ RM {payment.material_fee.toFixed(2)}</span></div>
      <div className="info-row" style={{ fontWeight: 700, fontSize: 15 }}><span>Net Pay</span><span className="amount">RM {payment.net_pay.toFixed(2)}</span></div>
      <div className="info-row"><span className="label">Status</span><span className={`badge ${payment.paid ? 'badge-green' : 'badge-red'}`}>{payment.paid ? `Paid${payment.paid_date ? ` on ${payment.paid_date}` : ''}` : 'Unpaid'}</span></div>
    </Modal>
  );
}

export default function TeacherPayments() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [payments, setPayments] = useState<TeacherPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [msg, setMsg] = useState('');
  const [detail, setDetail] = useState<TeacherPayment | null>(null);

  const load = async () => {
    setLoading(true);
    try { setPayments(await api.payments.teacherList(month, year)); }
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
      setMsg('Wages calculated successfully.');
      await load();
    } catch (e: any) { setMsg(e.message); }
    finally { setCalculating(false); }
  };

  const togglePaid = async (p: TeacherPayment) => {
    await api.payments.markTeacherPaid(p.id, !p.paid);
    setPayments(ps => ps.map(x => x.id === p.id ? { ...x, paid: x.paid ? 0 : 1 } : x));
  };

  const totalNetPay = payments.reduce((s, p) => s + p.net_pay, 0);
  const totalPaid = payments.filter(p => p.paid).reduce((s, p) => s + p.net_pay, 0);

  return (
    <div>
      <div className="page-header">
        <div><h2>Teacher Wages</h2><p>Monthly wage calculation and payment tracking</p></div>
        <button className="btn btn-primary" onClick={calculate} disabled={calculating}>
          {calculating ? 'Calculating...' : '⟳ Calculate Wages'}
        </button>
      </div>

      {msg && <div className={`alert ${msg.includes('success') ? 'alert-success' : 'alert-danger'}`}>{msg}</div>}

      <div className="filters">
        <div className="month-nav">
          <button className="btn btn-outline btn-sm" onClick={prevMonth}>&lsaquo;</button>
          <span className="month-label">{MONTHS[month - 1]} {year}</span>
          <button className="btn btn-outline btn-sm" onClick={nextMonth}>&rsaquo;</button>
        </div>
      </div>

      <div className="card-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card"><div className="label">Total Wages</div><div className="value">RM {totalNetPay.toFixed(2)}</div></div>
        <div className="stat-card"><div className="label">Paid Out</div><div className="value success">RM {totalPaid.toFixed(2)}</div></div>
        <div className="stat-card"><div className="label">Pending</div><div className="value danger">RM {(totalNetPay - totalPaid).toFixed(2)}</div></div>
        <div className="stat-card"><div className="label">Unpaid Teachers</div><div className="value danger">{payments.filter(p => !p.paid).length}</div></div>
      </div>

      {loading ? <div className="loading">Loading...</div> : (
        <div className="card">
          {payments.length === 0 ? (
            <div className="empty">
              <div className="icon">💼</div>
              <p>No wage records for this month. Click "Calculate Wages" to generate them.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Teacher</th><th>Total Tuition</th><th>Collab Fee</th>
                    <th>Material Fee</th><th>Net Pay</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id} className={p.paid ? 'paid-row' : 'unpaid-row'}>
                      <td><strong>{p.teacher_name}</strong></td>
                      <td className="amount">RM {p.total_tuition_fee.toFixed(2)}</td>
                      <td className="amount" style={{ color: 'var(--danger)' }}>− RM {p.collaboration_fee.toFixed(2)}</td>
                      <td className="amount" style={{ color: 'var(--success)' }}>+ RM {p.material_fee.toFixed(2)}</td>
                      <td className="amount amount-large">RM {p.net_pay.toFixed(2)}</td>
                      <td>
                        {p.paid
                          ? <span className="badge badge-green">Paid {p.paid_date ? `(${p.paid_date})` : ''}</span>
                          : <span className="badge badge-red">Unpaid</span>}
                      </td>
                      <td><div className="actions">
                        <button className="btn btn-outline btn-sm" onClick={() => setDetail(p)}>Details</button>
                        <button className={`btn btn-sm ${p.paid ? 'btn-outline' : 'btn-success'}`} onClick={() => togglePaid(p)}>
                          {p.paid ? 'Mark Unpaid' : 'Mark Paid'}
                        </button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {detail && <PaymentDetail payment={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
