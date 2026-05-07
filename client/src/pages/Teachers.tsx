import { useEffect, useState } from 'react';
import { api } from '../api';
import { Teacher, Subject } from '../types';
import Modal from '../components/Modal';
import SubjectSelector from '../components/SubjectSelector';

function TagSelector({ selected, onChange, allTags }: { selected: number[]; onChange: (ids: number[]) => void; allTags: any[] }) {
  const branchTags = allTags.filter(t => t.category === 'branch');
  if (branchTags.length === 0) return <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No branch tags yet. Create them in the Tags section.</p>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {branchTags.map(tag => {
        const active = selected.includes(tag.id);
        return (
          <button key={tag.id} type="button"
            style={{ padding: '4px 12px', borderRadius: 20, border: `1.5px solid ${tag.color}`, background: active ? tag.color : 'transparent', color: active ? '#fff' : tag.color, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
            onClick={() => onChange(active ? selected.filter(id => id !== tag.id) : [...selected, tag.id])}>
            {tag.name}
          </button>
        );
      })}
    </div>
  );
}

const SUBJECT_COLORS = ['badge-blue', 'badge-green', 'badge-purple', 'badge-yellow', 'badge-red'];
const subjectColor = (id: number) => SUBJECT_COLORS[id % SUBJECT_COLORS.length];

function TeacherForm({ initial, allTags, onSave, onClose }: { initial?: Teacher; allTags: any[]; onSave: (t: Teacher) => void; onClose: () => void }) {
  const [form, setForm] = useState({ name: initial?.name || '', phone: initial?.phone || '', email: initial?.email || '' });
  const [selectedSubjects, setSelectedSubjects] = useState<number[]>(initial?.subjects?.map(s => s.id) ?? []);
  const [selectedTags, setSelectedTags] = useState<number[]>((initial as any)?.tags?.map((t: any) => t.id) ?? []);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    try {
      const result = initial ? await api.teachers.update(initial.id, form) : await api.teachers.create(form);
      await api.teachers.setSubjects(result.id, selectedSubjects);
      await api.tags.setForTeacher(result.id, selectedTags);
      onSave({ ...result, subjects: selectedSubjects.map(id => ({ id, name: '' })) });
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={initial ? 'Edit Teacher' : 'Add Teacher'} onClose={onClose}
      footer={<><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button></>}>
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="form-group"><label>Full Name *</label><input className="form-control" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Ms. Sarah" /></div>
      <div className="form-group"><label>Phone</label><input className="form-control" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+60 12-345 6789" /></div>
      <div className="form-group"><label>Email</label><input className="form-control" value={form.email} onChange={e => set('email', e.target.value)} placeholder="teacher@email.com" /></div>
      <div className="form-group">
        <label>Subjects Taught</label>
        <SubjectSelector selected={selectedSubjects} onChange={setSelectedSubjects} />
      </div>
      <div className="form-group">
        <label>Branch</label>
        <TagSelector selected={selectedTags} onChange={setSelectedTags} allTags={allTags} />
      </div>
    </Modal>
  );
}

export default function Teachers() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [allTags, setAllTags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'add' | Teacher | null>(null);
  const [error, setError] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterBranch, setFilterBranch] = useState('');

  const load = async () => {
    const [t, s, tags] = await Promise.all([api.teachers.list(), api.subjects.list(), api.tags.list()]);
    setTeachers(t); setAllSubjects(s); setAllTags(tags);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleDelete = async (t: Teacher) => {
    if (!confirm(`Remove ${t.name}?`)) return;
    try { await api.teachers.delete(t.id); setTeachers(ts => ts.filter(x => x.id !== t.id)); }
    catch (e: any) { setError(e.message); }
  };

  const handleSave = (saved: Teacher) => {
    setTeachers(ts => ts.some(t => t.id === saved.id)
      ? ts.map(t => t.id === saved.id ? { ...t, ...saved } : t)
      : [...ts, saved]);
    setModal(null);
    load();
  };

  const filtered = teachers.filter(t => {
    const subjectOk = filterSubject ? t.subjects?.some(s => s.id === Number(filterSubject)) : true;
    const branchOk = filterBranch ? (t as any).tags?.some((tag: any) => tag.id === Number(filterBranch)) : true;
    return subjectOk && branchOk;
  });
  const branchTags = allTags.filter(t => t.category === 'branch');

  return (
    <div>
      <div className="page-header">
        <div><h2>Teachers</h2><p>Manage teaching staff</p></div>
        <button className="btn btn-primary" onClick={() => setModal('add')}>+ Add Teacher</button>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="filters">
        <select className="form-control" value={filterSubject} onChange={e => setFilterSubject(e.target.value)}>
          <option value="">All Subjects</option>
          {allSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {branchTags.length > 0 && (
          <select className="form-control" value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
            <option value="">All Branches</option>
            {branchTags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{filtered.length} teachers</span>
      </div>
      {loading ? <div className="loading">Loading...</div> : (
        <div className="card">
          <div className="table-wrap">
            {filtered.length === 0 ? (
              <div className="empty"><div className="icon">👩‍🏫</div><p>No teachers found.</p></div>
            ) : (
              <table>
                <thead><tr><th>Name</th><th>Branch</th><th>Phone</th><th>Email</th><th>Subjects</th><th>Students</th><th>Actions</th></tr></thead>
                <tbody>
                  {filtered.map(t => (
                    <tr key={t.id}>
                      <td><strong>{t.name}</strong></td>
                      <td>
                        {(t as any).tags?.filter((tag: any) => tag.category === 'branch').length > 0
                          ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {(t as any).tags.filter((tag: any) => tag.category === 'branch').map((tag: any) => (
                                <span key={tag.id} style={{ background: tag.color + '22', border: `1px solid ${tag.color}`, color: tag.color, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{tag.name}</span>
                              ))}
                            </div>
                          : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td>{t.phone || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                      <td>{t.email || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                      <td>
                        {t.subjects && t.subjects.length > 0
                          ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{t.subjects.map(s => <span key={s.id} className={`badge ${subjectColor(s.id)}`}>{s.name}</span>)}</div>
                          : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td><span className="badge badge-blue">{t.student_count ?? 0}</span></td>
                      <td><div className="actions">
                        <button className="btn btn-outline btn-sm" onClick={() => setModal(t)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t)}>Remove</button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
      {modal && <TeacherForm initial={modal === 'add' ? undefined : modal} allTags={allTags} onSave={handleSave} onClose={() => setModal(null)} />}
    </div>
  );
}
