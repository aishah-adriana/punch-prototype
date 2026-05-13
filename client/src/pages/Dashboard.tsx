import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { DashboardSummary } from '../types';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.payments.summary().then(setSummary).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading…</div>;
  if (!summary) return <div className="alert alert-danger">Failed to load summary.</div>;

  const monthName = MONTHS[summary.month - 1];
  const collectionRate = summary.totalDue > 0
    ? Math.round((summary.totalCollected / summary.totalDue) * 100)
    : 0;
  const outstanding = summary.totalDue - summary.totalCollected;

  return (
    <div>
      {/* ── KPI row ── */}
      <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        <div className="stat-card stat-primary">
          <div className="label">Active Students</div>
          <div className="value primary">{summary.totalStudents}</div>
          <div className="stat-sub">enrolled this period</div>
        </div>
        <div className="stat-card stat-primary">
          <div className="label">Teachers</div>
          <div className="value primary">{summary.totalTeachers}</div>
          <div className="stat-sub">active instructors</div>
        </div>
        <div className="stat-card">
          <div className="label">Sessions — {monthName}</div>
          <div className="value">{summary.sessionsThisMonth}</div>
          <div className="stat-sub">classes conducted</div>
        </div>
        <div className="stat-card">
          <div className="label">Total Fees Due</div>
          <div className="value">RM {summary.totalDue.toFixed(2)}</div>
          <div className="stat-sub">{monthName} {summary.year}</div>
        </div>
        <div className="stat-card stat-green">
          <div className="label">Collected</div>
          <div className="value success">RM {summary.totalCollected.toFixed(2)}</div>
          <div className="stat-sub">{collectionRate}% collection rate</div>
        </div>
        <div className="stat-card stat-red">
          <div className="label">Outstanding</div>
          <div className="value danger">RM {outstanding.toFixed(2)}</div>
          <div className="stat-sub">{summary.unpaidStudents} unpaid students</div>
        </div>
      </div>

      {/* ── Lower grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Pending actions */}
        <div className="card">
          <h3 style={{ marginBottom: 20, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
            Pending Actions
          </h3>

          <div className="info-row">
            <span className="label">Student fees unpaid</span>
            <Link to="/payments/students">
              <span className={`badge ${summary.unpaidStudents > 0 ? 'badge-red' : 'badge-green'}`}>
                {summary.unpaidStudents} unpaid
              </span>
            </Link>
          </div>
          <div className="info-row">
            <span className="label">Teacher wages unpaid</span>
            <Link to="/payments/teachers">
              <span className={`badge ${summary.unpaidTeachers > 0 ? 'badge-red' : 'badge-green'}`}>
                {summary.unpaidTeachers} unpaid
              </span>
            </Link>
          </div>

          {/* Collection progress */}
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
              <span style={{ color: 'var(--text-muted)' }}>Collection Rate</span>
              <span style={{ color: collectionRate >= 80 ? 'var(--success)' : 'var(--danger)' }}>
                {collectionRate}%
              </span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${collectionRate}%`,
                  background: collectionRate >= 80 ? 'var(--success)' : 'var(--primary)'
                }}
              />
            </div>
          </div>
        </div>

        {/* Quick links */}
        <div className="card">
          <h3 style={{ marginBottom: 20, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
            Quick Actions
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Link
              to="/attendance"
              className="btn btn-primary"
              style={{ justifyContent: 'center', padding: '11px 18px' }}
            >
              Log Attendance
            </Link>
            <Link
              to="/payments/students"
              className="btn btn-outline"
              style={{ justifyContent: 'center' }}
            >
              Student Fees — {monthName} {summary.year}
            </Link>
            <Link
              to="/payments/teachers"
              className="btn btn-outline"
              style={{ justifyContent: 'center' }}
            >
              Teacher Wages — {monthName} {summary.year}
            </Link>
            <Link
              to="/reports"
              className="btn btn-outline"
              style={{ justifyContent: 'center' }}
            >
              View Reports
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
