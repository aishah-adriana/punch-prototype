import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const now = new Date();

export default function TeacherPortal() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<'sessions' | 'students'>('sessions');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [sessions, setSessions] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [editAtt, setEditAtt] = useState<any | null>(null);
  const [form, setForm] = useState({ student_id: '', group_id: '', session_date: '', duration_hours: '1.5', class_type: '1on1', notes: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.teacherPortal.profile().then(setProfile).catch(() => {});
    api.teacherPortal.students().then(setStudents).catch(() => {});
    api.teacherPortal.groups().then(setGroups).catch(() => {});
  }, []);

  function loadSessions() {
    setLoading(true);
    api.teacherPortal.sessions({ month, year })
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadSessions(); }, [month, year]);

  async function submitSession() {
    setError('');
    if (!form.session_date || !form.duration_hours) return setError('Date and duration required');
    if (form.class_type === '1on1' && !form.student_id) return setError('Select a student for this 1-on-1 class');
    if (form.class_type === 'group' && !form.group_id) return setError('Select a group');
    try {
      const created = await api.teacherPortal.createSession({
        student_id: form.class_type === '1on1' ? Number(form.student_id) : undefined,
        group_id: form.class_type === 'group' ? Number(form.group_id) : undefined,
        session_date: form.session_date,
        duration_hours: Number(form.duration_hours),
        class_type: form.class_type,
        notes: form.notes
      });
      setShowForm(false);
      setForm({ student_id: '', group_id: '', session_date: '', duration_hours: '1.5', class_type: '1on1', notes: '' });
      await loadSessions();
      // For group sessions, immediately open the attendance modal so teacher can mark absences
      if (form.class_type === 'group') {
        setEditAtt({ ...created });
      }
    } catch (err: any) { setError(err.message); }
  }

  async function saveAttendance() {
    if (!editAtt) return;
    await api.teacherPortal.updateAttendance(editAtt.id, editAtt.attendance);
    setEditAtt(null);
    loadSessions();
  }

  async function deleteSession(id: number) {
    if (!confirm('Delete this session?')) return;
    await api.teacherPortal.deleteSession(id);
    loadSessions();
  }

  const oneOnOneStudents = students.filter(s => s.class_type === '1on1');

  return (
    <div className="teacher-portal">
      <header className="tp-header">
        <div className="tp-header-left">
          <h1>Punch Tuition</h1>
          <span className="tp-badge">Teacher Portal</span>
        </div>
        <div className="tp-header-right">
          <span className="tp-user">{profile?.name || user?.username}</span>
          <button className="btn btn-outline btn-sm" onClick={logout}>Sign Out</button>
        </div>
      </header>

      <div className="tp-body">
        <div className="tp-tabs">
          <button className={`tp-tab ${tab === 'sessions' ? 'active' : ''}`} onClick={() => setTab('sessions')}>My Sessions</button>
          <button className={`tp-tab ${tab === 'students' ? 'active' : ''}`} onClick={() => setTab('students')}>My Students</button>
        </div>

        {tab === 'sessions' && (
          <div>
            <div className="page-header">
              <div className="filters">
                <select value={month} onChange={e => setMonth(Number(e.target.value))}>
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
                <select value={year} onChange={e => setYear(Number(e.target.value))}>
                  {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <button className="btn btn-primary" onClick={() => { setShowForm(true); setError(''); }}>+ Log Session</button>
            </div>

            {showForm && (
              <div className="card" style={{ marginBottom: '1rem' }}>
                <h3>Log New Session</h3>
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-row">
                  <div className="form-group">
                    <label>Date</label>
                    <input type="date" value={form.session_date} onChange={e => setForm(f => ({ ...f, session_date: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Class Type</label>
                    <select value={form.class_type} onChange={e => setForm(f => ({ ...f, class_type: e.target.value, student_id: '', group_id: '' }))}>
                      <option value="1on1">1-on-1 Private</option>
                      <option value="group">Group Class</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Duration (hours)</label>
                    <input type="number" step="0.5" min="0.5" value={form.duration_hours} onChange={e => setForm(f => ({ ...f, duration_hours: e.target.value }))} />
                  </div>
                </div>
                <div className="form-row">
                  {form.class_type === '1on1' ? (
                    <div className="form-group">
                      <label>Student</label>
                      <select value={form.student_id} onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))}>
                        <option value="">Select student...</option>
                        {oneOnOneStudents.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  ) : (
                    <div className="form-group">
                      <label>Group Class</label>
                      <select value={form.group_id} onChange={e => setForm(f => ({ ...f, group_id: e.target.value }))}>
                        <option value="">Select group...</option>
                        {groups.map(g => <option key={g.id} value={g.id}>{g.name} ({g.student_count} students)</option>)}
                      </select>
                    </div>
                  )}
                  <div className="form-group">
                    <label>Notes (optional)</label>
                    <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Topic covered, homework, etc." />
                  </div>
                </div>
                {form.class_type === 'group' && form.group_id && (
                  <div className="info-banner">
                    All students in this group will be marked present. You can adjust attendance right after saving.
                  </div>
                )}
                <div className="form-actions">
                  <button className="btn btn-primary" onClick={submitSession}>Save Session</button>
                  <button className="btn btn-outline" onClick={() => { setShowForm(false); setError(''); }}>Cancel</button>
                </div>
              </div>
            )}

            {/* ── Attendance Modal ── */}
            {editAtt && (
              <div className="modal-overlay" onClick={() => setEditAtt(null)}>
                <div className="modal" onClick={e => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3>Mark Attendance</h3>
                    <button onClick={() => setEditAtt(null)}>&times;</button>
                  </div>
                  <div className="modal-body">
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
                      Session: {editAtt.session_date} &bull; {editAtt.class_type === '1on1' ? '1-on-1' : 'Group'}<br />
                      Tick the students who <strong>attended</strong> this session. Untick for absences.
                    </p>
                    {editAtt.attendance.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)' }}>No students in attendance record.</p>
                    ) : (
                      <div className="att-checklist">
                        {editAtt.attendance.map((a: any) => (
                          <label key={a.student_id} className={`att-check-row ${a.attended ? 'present' : 'absent'}`}>
                            <input
                              type="checkbox"
                              checked={!!a.attended}
                              onChange={e => setEditAtt((prev: any) => ({
                                ...prev,
                                attendance: prev.attendance.map((x: any) =>
                                  x.student_id === a.student_id ? { ...x, attended: e.target.checked ? 1 : 0 } : x
                                )
                              }))}
                            />
                            <span className="att-student-name">{a.student_name}</span>
                            <span className={`badge badge-${a.attended ? 'green' : 'red'}`} style={{ marginLeft: 'auto' }}>
                              {a.attended ? 'Present' : 'Absent'}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                    <div style={{ background: '#f8fafc', borderRadius: 6, padding: '8px 12px', marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                      {editAtt.attendance.filter((a: any) => a.attended).length} of {editAtt.attendance.length} students present
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button className="btn btn-primary" onClick={saveAttendance}>Save Attendance</button>
                    <button className="btn btn-outline" onClick={() => setEditAtt(null)}>Cancel</button>
                  </div>
                </div>
              </div>
            )}

            {loading ? <p>Loading sessions...</p> : sessions.length === 0 ? (
              <div className="empty-state">No sessions logged for {MONTHS[month - 1]} {year}</div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Student / Group</th>
                      <th>Duration</th>
                      <th>Attendance</th>
                      <th>Notes</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map(s => {
                      const presentCount = s.attendance.filter((a: any) => a.attended).length;
                      const totalCount = s.attendance.length;
                      const allPresent = presentCount === totalCount && totalCount > 0;
                      return (
                        <tr key={s.id}>
                          <td>{s.session_date}</td>
                          <td><span className={`badge badge-${s.class_type === '1on1' ? 'blue' : 'green'}`}>{s.class_type === '1on1' ? '1-on-1' : 'Group'}</span></td>
                          <td>{s.student_name || s.group_name || '—'}</td>
                          <td>{s.duration_hours}h</td>
                          <td>
                            <button
                              className={`att-inline-btn ${allPresent ? 'all-present' : presentCount === 0 ? 'all-absent' : 'partial'}`}
                              onClick={() => setEditAtt({ ...s })}
                              title="Click to edit attendance"
                            >
                              {presentCount}/{totalCount} present
                            </button>
                          </td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{s.notes || '—'}</td>
                          <td>
                            <button className="btn btn-sm btn-danger" onClick={() => deleteSession(s.id)}>Delete</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'students' && (
          <div>
            <h2 className="section-title">My Students ({students.length})</h2>
            {students.length === 0 ? (
              <div className="empty-state">No students assigned yet</div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Age</th>
                      <th>Syllabus</th>
                      <th>Class Type</th>
                      <th>Group</th>
                      <th>Subjects</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map(s => (
                      <tr key={s.id}>
                        <td>{s.name}</td>
                        <td>{s.age}</td>
                        <td><span className={`badge badge-${s.syllabus === 'Cambridge' ? 'purple' : 'blue'}`}>{s.syllabus}</span></td>
                        <td>{s.class_type === '1on1' ? '1-on-1' : 'Group'}</td>
                        <td>{s.group_name || '—'}</td>
                        <td>{s.subjects || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
