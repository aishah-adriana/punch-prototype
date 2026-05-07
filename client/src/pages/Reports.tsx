import { useState, useEffect } from 'react';
import { api } from '../api';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const now = new Date();

type ReportTab = 'revenue' | 'outstanding' | 'attendance' | 'sessions' | 'demographics' | 'yearly';

export default function Reports() {
  const [tab, setTab] = useState<ReportTab>('revenue');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setData(null);

    let promise: Promise<any>;
    if (tab === 'revenue') {
      promise = Promise.all([
        api.reports.revenueMonthly(month, year),
        api.reports.revenueByTeacher(month, year),
        api.reports.revenueTrend(6),
        api.reports.collectionRate(),
        api.reports.feesAnalysis(month, year)
      ]).then(([monthly, byTeacher, trend, collectionRate, fees]) =>
        ({ monthly, byTeacher, trend, collectionRate, fees }));
    } else if (tab === 'outstanding') {
      promise = api.reports.outstanding();
    } else if (tab === 'attendance') {
      promise = api.reports.attendanceStudents(month, year);
    } else if (tab === 'sessions') {
      promise = api.reports.sessionStats(month, year);
    } else if (tab === 'demographics') {
      promise = api.reports.demographics();
    } else {
      promise = api.reports.yearly(year);
    }

    promise
      .then(d => { if (!cancelled) setData(d); })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [tab, month, year]);

  function fmt(n: number | null | undefined) { return `RM ${(n || 0).toFixed(2)}`; }

  return (
    <div>
      <div className="page-header">
        <h1>Financial Reports</h1>
        <div className="filters">
          <select value={month} onChange={e => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}>
            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="report-tabs">
        {(['revenue', 'outstanding', 'attendance', 'sessions', 'demographics', 'yearly'] as ReportTab[]).map(t => (
          <button key={t} className={`report-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {{ revenue: 'Revenue', outstanding: 'Outstanding', attendance: 'Attendance', sessions: 'Sessions', demographics: 'Demographics', yearly: 'Yearly' }[t]}
          </button>
        ))}
      </div>

      {loading && <div className="loading-spinner">Loading report...</div>}

      {!loading && data && (
        <>
          {/* ── Revenue Tab ── */}
          {tab === 'revenue' && (
            <div className="report-content">
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-label">Total Fees Due</div>
                  <div className="stat-value">{fmt(data.monthly?.studentFees?.total_due)}</div>
                  <div className="stat-sub">{data.monthly?.studentFees?.count || 0} students</div>
                </div>
                <div className="stat-card stat-green">
                  <div className="stat-label">Collected</div>
                  <div className="stat-value">{fmt(data.monthly?.studentFees?.collected)}</div>
                </div>
                <div className="stat-card stat-red">
                  <div className="stat-label">Outstanding</div>
                  <div className="stat-value">{fmt(data.monthly?.studentFees?.outstanding)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Teacher Wages</div>
                  <div className="stat-value">{fmt(data.monthly?.teacherWages?.total_net_pay)}</div>
                  <div className="stat-sub">{data.monthly?.teacherWages?.count || 0} teachers</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Sessions</div>
                  <div className="stat-value">{data.monthly?.sessions?.session_count || 0}</div>
                  <div className="stat-sub">{(data.monthly?.sessions?.total_hours || 0).toFixed(1)} hours</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Material Fees</div>
                  <div className="stat-value">{fmt(data.monthly?.studentFees?.total_material)}</div>
                </div>
              </div>

              <h3>Revenue by Teacher — {MONTHS[month - 1]} {year}</h3>
              {(data.byTeacher || []).length === 0 ? <div className="empty-state">No data for this period</div> : (
                <div className="table-wrapper">
                  <table>
                    <thead><tr>
                      <th>Teacher</th><th>Students</th><th>Sessions</th><th>Hours</th>
                      <th>Fees Due</th><th>Collected</th><th>Wage</th><th>Wage Paid</th>
                    </tr></thead>
                    <tbody>
                      {(data.byTeacher || []).map((r: any) => (
                        <tr key={r.id}>
                          <td>{r.teacher_name}</td>
                          <td>{r.student_count}</td>
                          <td>{r.session_count || 0}</td>
                          <td>{(r.total_hours || 0).toFixed(1)}h</td>
                          <td>{fmt(r.total_fees_due)}</td>
                          <td>{fmt(r.fees_collected)}</td>
                          <td>{fmt(r.teacher_net_pay)}</td>
                          <td><span className={`badge badge-${r.teacher_paid ? 'green' : 'red'}`}>{r.teacher_paid ? 'Paid' : 'Unpaid'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <h3>Collection Rate (Last 6 Months)</h3>
              {(data.collectionRate || []).length === 0 ? <div className="empty-state">No payment data yet</div> : (
                <div className="table-wrapper">
                  <table>
                    <thead><tr><th>Period</th><th>Total Due</th><th>Collected</th><th>Rate</th><th>Paid</th><th>Unpaid</th></tr></thead>
                    <tbody>
                      {(data.collectionRate || []).map((r: any) => (
                        <tr key={`${r.year}-${r.month}`}>
                          <td>{MONTHS[r.month - 1]} {r.year}</td>
                          <td>{fmt(r.total_due)}</td>
                          <td>{fmt(r.collected)}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                                <div style={{ width: `${r.rate_pct || 0}%`, height: '100%', background: 'var(--primary)', borderRadius: 4 }} />
                              </div>
                              <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 36 }}>{r.rate_pct || 0}%</span>
                            </div>
                          </td>
                          <td>{r.paid_count}</td>
                          <td>{r.total_records - r.paid_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <h3>Fee Breakdown by Type — {MONTHS[month - 1]} {year}</h3>
              {(data.fees?.breakdown || []).length === 0 ? <div className="empty-state">No fee data for this period</div> : (
                <div className="table-wrapper">
                  <table>
                    <thead><tr><th>Syllabus</th><th>Class</th><th>Students</th><th>Avg Rate/hr</th><th>Avg Tuition</th><th>Total Due</th></tr></thead>
                    <tbody>
                      {(data.fees?.breakdown || []).map((r: any, i: number) => (
                        <tr key={i}>
                          <td>{r.syllabus}</td>
                          <td>{r.class_type === '1on1' ? '1-on-1' : 'Group'}</td>
                          <td>{r.student_count}</td>
                          <td>RM {(r.avg_rate || 0).toFixed(2)}</td>
                          <td>{fmt(r.avg_tuition)}</td>
                          <td>{fmt(r.total_due)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Outstanding Tab ── */}
          {tab === 'outstanding' && (
            <div className="report-content">
              <div className="stat-grid">
                <div className="stat-card stat-red">
                  <div className="stat-label">Total Outstanding</div>
                  <div className="stat-value">{fmt(data?.total)}</div>
                  <div className="stat-sub">{data?.count || 0} unpaid records</div>
                </div>
              </div>
              {(data?.rows || []).length === 0 ? <div className="empty-state">No outstanding fees — all paid up!</div> : (
                <div className="table-wrapper">
                  <table>
                    <thead><tr>
                      <th>Student</th><th>Teacher</th><th>Period</th><th>Classes</th>
                      <th>Hours</th><th>Amount Due</th>
                    </tr></thead>
                    <tbody>
                      {(data?.rows || []).map((r: any) => (
                        <tr key={r.id}>
                          <td>{r.student_name}</td>
                          <td>{r.teacher_name}</td>
                          <td>{MONTHS[r.month - 1]} {r.year}</td>
                          <td>{r.classes_count}</td>
                          <td>{r.duration_hours}h</td>
                          <td className="text-red">{fmt(r.total_due)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Attendance Tab ── */}
          {tab === 'attendance' && (
            <div className="report-content">
              <h3>Student Attendance — {MONTHS[month - 1]} {year}</h3>
              {(Array.isArray(data) ? data : []).length === 0 ? <div className="empty-state">No attendance data for this period</div> : (
                <div className="table-wrapper">
                  <table>
                    <thead><tr>
                      <th>Student</th><th>Teacher</th><th>Syllabus</th><th>Sessions</th>
                      <th>Attended</th><th>Rate</th>
                    </tr></thead>
                    <tbody>
                      {(Array.isArray(data) ? data : []).map((r: any) => (
                        <tr key={r.id}>
                          <td>{r.student_name}</td>
                          <td>{r.teacher_name}</td>
                          <td>{r.syllabus}</td>
                          <td>{r.total_sessions || 0}</td>
                          <td>{r.attended_count || 0}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                                <div style={{ width: `${r.attendance_pct || 0}%`, height: '100%', background: (r.attendance_pct || 0) >= 80 ? '#22c55e' : '#ef4444', borderRadius: 4 }} />
                              </div>
                              <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 36 }}>{r.attendance_pct || 0}%</span>
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

          {/* ── Sessions Tab ── */}
          {tab === 'sessions' && (
            <div className="report-content">
              <div className="stat-grid">
                <div className="stat-card"><div className="stat-label">Total Sessions</div><div className="stat-value">{data?.totals?.total_sessions || 0}</div></div>
                <div className="stat-card"><div className="stat-label">Total Hours</div><div className="stat-value">{(data?.totals?.total_hours || 0).toFixed(1)}</div></div>
                <div className="stat-card"><div className="stat-label">1-on-1</div><div className="stat-value">{data?.totals?.oneon1 || 0}</div></div>
                <div className="stat-card"><div className="stat-label">Group</div><div className="stat-value">{data?.totals?.group_count || 0}</div></div>
              </div>

              {(data?.byTeacher || []).length === 0 ? <div className="empty-state">No sessions logged for this period</div> : (
                <>
                  <h3>Sessions by Teacher</h3>
                  <div className="table-wrapper">
                    <table>
                      <thead><tr><th>Teacher</th><th>Sessions</th><th>Hours</th><th>1-on-1</th><th>Group</th></tr></thead>
                      <tbody>
                        {(data?.byTeacher || []).map((r: any) => (
                          <tr key={r.teacher_name}>
                            <td>{r.teacher_name}</td>
                            <td>{r.session_count}</td>
                            <td>{(r.total_hours || 0).toFixed(1)}h</td>
                            <td>{r.oneon1_count}</td>
                            <td>{r.group_count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <h3>Sessions by Day</h3>
                  <div className="table-wrapper">
                    <table>
                      <thead><tr><th>Date</th><th>Sessions</th><th>Hours</th></tr></thead>
                      <tbody>
                        {(data?.byDay || []).map((r: any) => (
                          <tr key={r.session_date}><td>{r.session_date}</td><td>{r.count}</td><td>{r.hours}h</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Demographics Tab ── */}
          {tab === 'demographics' && (
            <div className="report-content">
              <div className="stat-grid">
                <div className="stat-card"><div className="stat-label">Active Students</div><div className="stat-value">{data?.total || 0}</div></div>
              </div>
              <div className="demo-grid">
                <div>
                  <h3>By Syllabus</h3>
                  {(data?.bySyllabus || []).map((r: any) => (
                    <div key={r.syllabus} className="demo-row">
                      <span>{r.syllabus}</span>
                      <span className="badge badge-blue">{r.count}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <h3>By Class Type</h3>
                  {(data?.byClassType || []).map((r: any) => (
                    <div key={r.class_type} className="demo-row">
                      <span>{r.class_type === '1on1' ? '1-on-1' : 'Group'}</span>
                      <span className="badge badge-green">{r.count}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <h3>By Age Group</h3>
                  {(data?.byAge || []).map((r: any) => (
                    <div key={r.age_group} className="demo-row">
                      <span>{r.age_group}</span>
                      <span className="badge badge-purple">{r.count}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <h3>By Teacher</h3>
                  {(data?.byTeacher || []).map((r: any) => (
                    <div key={r.teacher_name} className="demo-row">
                      <span>{r.teacher_name}</span>
                      <span className="badge badge-blue">{r.student_count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Yearly Tab ── */}
          {tab === 'yearly' && (
            <div className="report-content">
              <div className="stat-grid">
                <div className="stat-card"><div className="stat-label">Annual Revenue</div><div className="stat-value">{fmt(data?.annualTotals?.total_revenue)}</div></div>
                <div className="stat-card stat-green"><div className="stat-label">Total Collected</div><div className="stat-value">{fmt(data?.annualTotals?.total_collected)}</div></div>
                <div className="stat-card stat-red"><div className="stat-label">Outstanding</div><div className="stat-value">{fmt((data?.annualTotals?.total_revenue || 0) - (data?.annualTotals?.total_collected || 0))}</div></div>
              </div>

              {(data?.monthly || []).length === 0 ? <div className="empty-state">No data for {year}</div> : (
                <>
                  <h3>Monthly Breakdown — {year}</h3>
                  <div className="table-wrapper">
                    <table>
                      <thead><tr><th>Month</th><th>Fees Due</th><th>Collected</th><th>Outstanding</th><th>Teacher Wages</th><th>Students</th></tr></thead>
                      <tbody>
                        {(data?.monthly || []).map((r: any) => {
                          const wages = (data?.teacherPayments || []).find((t: any) => t.month === r.month);
                          return (
                            <tr key={r.month}>
                              <td>{MONTHS[r.month - 1]}</td>
                              <td>{fmt(r.total_due)}</td>
                              <td>{fmt(r.collected)}</td>
                              <td className="text-red">{fmt((r.total_due || 0) - (r.collected || 0))}</td>
                              <td>{fmt(wages?.total_wages)}</td>
                              <td>{r.student_count}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {!loading && !data && <div className="empty-state">No data available. Add sessions and calculate fees first.</div>}
    </div>
  );
}
