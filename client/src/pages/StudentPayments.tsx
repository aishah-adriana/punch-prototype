import { useEffect, useState } from 'react';
import { api } from '../api';
import { StudentPayment } from '../types';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

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
    await api.payments.markStudentPaid(p.id, !p.paid);
    setPayments(ps => ps.map(x => x.id === p.id ? { ...x, paid: x.paid ? 0 : 1 } : x));
  };

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
                        <button className={`btn btn-sm ${p.paid ? 'btn-outline' : 'btn-success'}`} onClick={() => togglePaid(p)}>
                          {p.paid ? 'Mark Unpaid' : 'Mark Paid'}
                        </button>
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
