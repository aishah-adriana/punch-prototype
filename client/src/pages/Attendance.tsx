import { useEffect, useState } from 'react';
import { api } from '../api';
import { Teacher, Student, ClassGroup, Session } from '../types';
import Modal from '../components/Modal';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DURATIONS = [0.5, 1, 1.5, 2, 2.5, 3];

function AddSessionModal({ teachers, students, groups, onSave, onClose }: {
  teachers: Teacher[]; students: Student[]; groups: ClassGroup[]; onSave: (s: Session) => void; onClose: () => void;
}) {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({ teacher_id: '', class_type: '1on1', student_id: '', group_id: '', session_date: today, duration_hours: '1.5', notes: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const teacherStudents = students.filter(s => s.teacher_id === Number(form.teacher_id) && s.active === 1 && s.class_type === '1on1');
  const teacherGroups = groups.filter(g => g.teacher_id === Number(form.teacher_id));

  const submit = async () => {
    if (!form.teacher_id || !form.session_date) { setError('Teacher and date are required'); return; }
    if (form.class_type === '1on1' && !form.student_id) { setError('Select a student for 1-on-1 class'); return; }
    if (form.class_type === 'group' && !form.group_id) { setError('Select a group for group class'); return; }
    setSaving(true);
    try {
      const result = await api.sessions.create({
        teacher_id: Number(form.teacher_id),
        student_id: form.class_type === '1on1' ? Number(form.student_id) : null,
        group_id: form.class_type === 'group' ? Number(form.group_id) : null,
        session_date: form.session_date,
        duration_hours: Number(form.duration_hours),
        class_type: form.class_type,
        notes: form.notes
      });
      onSave(result);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Log New Session" onClose={onClose}
      footer={<><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving...' : 'Save Session'}</button></>}>
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="form-row">
        <div className="form-group"><label>Teacher *</label>
          <select className="form-control" value={form.teacher_id} onChange={e => { set('teacher_id', e.target.value); set('student_id', ''); set('group_id', ''); }}>
            <option value="">Select teacher...</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="form-group"><label>Class Type *</label>
          <select className="form-control" value={form.class_type} onChange={e => { set('class_type', e.target.value); set('student_id', ''); set('group_id', ''); }}>
            <option value="1on1">1-on-1 Private</option>
            <option value="group">Group Class</option>
          </select>
        </div>
      </div>
      {form.class_type === '1on1' ? (
        <div className="form-group"><label>Student *</label>
          <select className="form-control" value={form.student_id} onChange={e => set('student_id', e.target.value)}>
            <option value="">Select student...</option>
            {teacherStudents.map(s => <option key={s.id} value={s.id}>{s.name} (Age {s.age}, {s.syllabus})</option>)}
          </select>
        </div>
      ) : (
        <div className="form-group"><label>Group *</label>
          <select className="form-control" value={form.group_id} onChange={e => set('group_id', e.target.value)}>
            <option value="">Select group...</option>
            {teacherGroups.map(g => <option key={g.id} value={g.id}>{g.name} ({g.student_count} students)</option>)}
          </select>
        </div>
      )}
      <div className="form-row">
        <div className="form-group"><label>Date *</label><input type="date" className="form-control" value={form.session_date} onChange={e => set('session_date', e.target.value)} /></div>
        <div className="form-group"><label>Duration (hours)</label>
          <select className="form-control" value={form.duration_hours} onChange={e => set('duration_hours', e.target.value)}>
            {DURATIONS.map(d => <option key={d} value={d}>{d}h</option>)}
          </select>
        </div>
      </div>
      <div className="form-group"><label>Notes</label><input className="form-control" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional notes..." /></div>
    </Modal>
  );
}

function AttendanceModal({ session, onSave, onClose }: { session: Session; onSave: () => void; onClose: () => void }) {
  const [attendance, setAttendance] = useState(session.attendance?.map(a => ({ ...a })) || []);
  const [saving, setSaving] = useState(false);

  const toggle = (studentId: number) => {
    setAttendance(att => att.map(a => a.student_id === studentId ? { ...a, attended: a.attended ? 0 : 1 } : a));
  };

  const submit = async () => {
    setSaving(true);
    try { await api.sessions.updateAttendance(session.id, attendance); onSave(); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={`Attendance — ${session.session_date}`} onClose={onClose}
      footer={<><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving...' : 'Save Attendance'}</button></>}>
      <div style={{ marginBottom: 12, color: 'var(--text-muted)', fontSize: 13 }}>
        {session.group_name ? `Group: ${session.group_name}` : `Student: ${session.student_name}`} &bull; {session.duration_hours}h
      </div>
      {session.class_type === 'group' && (
        <div className="alert alert-info" style={{ marginBottom: 12 }}>
          Group class: all students are charged for this session regardless of attendance.
        </div>
      )}
      <div className="att-grid">
        {attendance.map(a => (
          <div key={a.student_id} className={`att-row ${a.attended ? 'att-present' : 'att-absent'}`}>
            <label>
              <input type="checkbox" className="att-checkbox" checked={!!a.attended} onChange={() => toggle(a.student_id)} />
              <strong>{a.student_name}</strong>
            </label>
            <span className={`badge ${a.attended ? 'badge-green' : 'badge-red'}`}>{a.attended ? 'Present' : 'Absent'}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export default function Attendance() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<ClassGroup[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<'add' | null>(null);
  const [attModal, setAttModal] = useState<Session | null>(null);
  const [filterTeacher, setFilterTeacher] = useState('');

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const loadSessions = async () => {
    setLoading(true);
    const s = await api.sessions.list({ teacher_id: filterTeacher ? Number(filterTeacher) : undefined, month, year });
    setSessions(s);
    setLoading(false);
  };

  useEffect(() => {
    Promise.all([api.teachers.list(), api.students.list(), api.groups.list()]).then(([t, s, g]) => {
      setTeachers(t); setStudents(s); setGroups(g);
    });
  }, []);

  useEffect(() => { loadSessions(); }, [filterTeacher, month, year]);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this session?')) return;
    await api.sessions.delete(id);
    setSessions(ss => ss.filter(s => s.id !== id));
  };

  return (
    <div>
      <div className="page-header">
        <div><h2>Attendance Log</h2><p>Record class sessions and student attendance</p></div>
        <button className="btn btn-primary" onClick={() => setModal('add')}>+ Log Session</button>
      </div>

      <div className="filters">
        <div className="month-nav">
          <button className="btn btn-outline btn-sm" onClick={prevMonth}>&lsaquo;</button>
          <span className="month-label">{MONTHS[month - 1]} {year}</span>
          <button className="btn btn-outline btn-sm" onClick={nextMonth}>&rsaquo;</button>
        </div>
        <select className="form-control" value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)}>
          <option value="">All Teachers</option>
          {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{sessions.length} sessions</span>
      </div>

      {loading ? <div className="loading">Loading...</div> : (
        <div className="card">
          <div className="table-wrap">
            {sessions.length === 0 ? (
              <div className="empty"><div className="icon">📅</div><p>No sessions logged for this period.</p></div>
            ) : (
              <table>
                <thead><tr><th>Date</th><th>Teacher</th><th>Type</th><th>Class / Student</th><th>Duration</th><th>Attendance</th><th>Notes</th><th>Actions</th></tr></thead>
                <tbody>
                  {sessions.map(s => {
                    const attended = s.attendance?.filter(a => a.attended).length ?? 0;
                    const total = s.attendance?.length ?? 0;
                    return (
                      <tr key={s.id}>
                        <td>{s.session_date}</td>
                        <td>{s.teacher_name}</td>
                        <td><span className={`badge ${s.class_type === '1on1' ? 'badge-green' : 'badge-blue'}`}>{s.class_type === '1on1' ? '1-on-1' : 'Group'}</span></td>
                        <td>{s.class_type === 'group' ? s.group_name : s.student_name}</td>
                        <td>{s.duration_hours}h</td>
                        <td>
                          <span className={`badge ${attended === total ? 'badge-green' : attended === 0 ? 'badge-red' : 'badge-yellow'}`}>
                            {attended}/{total}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>{s.notes || '—'}</td>
                        <td><div className="actions">
                          <button className="btn btn-outline btn-sm" onClick={() => setAttModal(s)}>Attendance</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id)}>Delete</button>
                        </div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {modal === 'add' && <AddSessionModal teachers={teachers} students={students} groups={groups} onSave={s => { setSessions(ss => [s, ...ss]); setModal(null); }} onClose={() => setModal(null)} />}
      {attModal && <AttendanceModal session={attModal} onSave={loadSessions} onClose={() => setAttModal(null)} />}
    </div>
  );
}
