import { useEffect, useState } from 'react';
import { api } from '../api';
import { ClassGroup, Teacher, Subject } from '../types';
import Modal from '../components/Modal';

const SYLLABI = ['KSSR', 'KSSM', 'Cambridge'];
const DURATIONS = [1, 1.5, 2, 2.5, 3];

function GroupForm({ initial, teachers, subjects, onSave, onClose }: {
  initial?: ClassGroup; teachers: Teacher[]; subjects: Subject[];
  onSave: (g: ClassGroup) => void; onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    teacher_id: initial?.teacher_id?.toString() || '',
    syllabus: initial?.syllabus || 'KSSR',
    subject_id: initial?.subject_id?.toString() || '',
    standard: initial?.standard || '',
    duration_hours: initial?.duration_hours?.toString() || '1.5'
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim() || !form.teacher_id) { setError('Name and teacher are required'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        teacher_id: Number(form.teacher_id),
        duration_hours: Number(form.duration_hours),
        subject_id: form.subject_id ? Number(form.subject_id) : null,
      };
      const result = initial ? await api.groups.update(initial.id, payload) : await api.groups.create(payload);
      onSave(result);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={initial ? 'Edit Group Class' : 'Create Group Class'} onClose={onClose}
      footer={<><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button></>}>
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="form-group"><label>Group Name *</label><input className="form-control" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. KSSR Std 4 Group A" /></div>
      <div className="form-row">
        <div className="form-group"><label>Teacher *</label>
          <select className="form-control" value={form.teacher_id} onChange={e => set('teacher_id', e.target.value)}>
            <option value="">Select teacher...</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="form-group"><label>Syllabus *</label>
          <select className="form-control" value={form.syllabus} onChange={e => set('syllabus', e.target.value)}>
            {SYLLABI.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Subject</label>
          <select className="form-control" value={form.subject_id} onChange={e => set('subject_id', e.target.value)}>
            <option value="">— None —</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="form-group"><label>Standard / Form</label>
          <input className="form-control" value={form.standard} onChange={e => set('standard', e.target.value)} placeholder="e.g. Standard 4, Form 2" />
        </div>
      </div>
      <div className="form-group"><label>Class Duration (hours)</label>
        <select className="form-control" value={form.duration_hours} onChange={e => set('duration_hours', e.target.value)}>
          {DURATIONS.map(d => <option key={d} value={d}>{d}h</option>)}
        </select>
      </div>
    </Modal>
  );
}

export default function Groups() {
  const [groups, setGroups] = useState<ClassGroup[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'add' | ClassGroup | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    const [g, t, s] = await Promise.all([api.groups.list(), api.teachers.list(), api.subjects.list()]);
    setGroups(g); setTeachers(t); setSubjects(s); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleDelete = async (g: ClassGroup) => {
    if (!confirm(`Delete group "${g.name}"? Students in this group must be removed first.`)) return;
    try { await api.groups.delete(g.id); setGroups(gs => gs.filter(x => x.id !== g.id)); }
    catch (e: any) { setError(e.message); }
  };

  const handleSave = (saved: ClassGroup) => {
    setGroups(gs => gs.some(g => g.id === saved.id) ? gs.map(g => g.id === saved.id ? { ...g, ...saved } : g) : [...gs, saved]);
    setModal(null);
    load();
  };

  const syllabusBadge = (s: string) => s === 'Cambridge' ? 'badge-purple' : s === 'KSSM' ? 'badge-yellow' : 'badge-blue';

  return (
    <div>
      <div className="page-header">
        <div><h2>Group Classes</h2><p>Manage class groups and their members</p></div>
        <button className="btn btn-primary" onClick={() => setModal('add')}>+ Create Group</button>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {loading ? <div className="loading">Loading...</div> : (
        <div className="card">
          <div className="table-wrap">
            {groups.length === 0 ? (
              <div className="empty"><div className="icon">👥</div><p>No group classes yet. Create one to get started.</p></div>
            ) : (
              <table>
                <thead><tr><th>Group Name</th><th>Teacher</th><th>Syllabus</th><th>Subject</th><th>Standard</th><th>Duration</th><th>Students</th><th>Actions</th></tr></thead>
                <tbody>
                  {groups.map(g => (
                    <tr key={g.id}>
                      <td><strong>{g.name}</strong></td>
                      <td>{g.teacher_name}</td>
                      <td><span className={`badge ${syllabusBadge(g.syllabus)}`}>{g.syllabus}</span></td>
                      <td>{g.subject_name ? <span className="badge badge-blue">{g.subject_name}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                      <td>{g.standard || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                      <td>{g.duration_hours}h / class</td>
                      <td><span className="badge badge-green">{g.student_count ?? 0} students</span></td>
                      <td><div className="actions">
                        <button className="btn btn-outline btn-sm" onClick={() => setModal(g)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(g)}>Delete</button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
      {modal && <GroupForm
        initial={modal === 'add' ? undefined : modal as ClassGroup}
        teachers={teachers}
        subjects={subjects}
        onSave={handleSave}
        onClose={() => setModal(null)}
      />}
    </div>
  );
}
