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

  if (loading) return <div className="loading">Loading...</div>;
  if (!summary) return <div className="alert alert-danger">Failed to load summary.</div>;

  const monthName = MONTHS[summary.month - 1];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <p>Overview for {monthName} {summary.year}</p>
        </div>
      </div>

      <div className="card-grid">
        <div className="stat-card">
          <div className="label">Active Students</div>
          <div className="value primary">{summary.totalStudents}</div>
        </div>
        <div className="stat-card">
          <div className="label">Teachers</div>
          <div className="value primary">{summary.totalTeachers}</div>
        </div>
        <div className="stat-card">
          <div className="label">Sessions This Month</div>
          <div className="value">{summary.sessionsThisMonth}</div>
        </div>
        <div className="stat-card">
          <div className="label">Total Fees Due</div>
          <div className="value">RM {summary.totalDue.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="label">Fees Collected</div>
          <div className="value success">RM {summary.totalCollected.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="label">Fees Outstanding</div>
          <div className="value danger">RM {(summary.totalDue - summary.totalCollected).toFixed(2)}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 600 }}>Pending Actions</h3>
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
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 600 }}>Quick Links</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Link to="/attendance" className="btn btn-primary btn-sm" style={{ justifyContent: 'center' }}>
              📅 Log Attendance
            </Link>
            <Link to="/payments/students" className="btn btn-outline btn-sm" style={{ justifyContent: 'center' }}>
              💰 View Student Fees — {monthName}
            </Link>
            <Link to="/payments/teachers" className="btn btn-outline btn-sm" style={{ justifyContent: 'center' }}>
              💼 View Teacher Wages — {monthName}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
