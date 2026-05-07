import { useEffect, useState } from 'react';
import { api } from '../api';
import { Subject } from '../types';
import Modal from '../components/Modal';

function SubjectForm({ initial, onSave, onClose }: { initial?: Subject; onSave: (s: Subject) => void; onClose: () => void }) {
  const [name, setName] = useState(initial?.name || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) { setError('Subject name is required'); return; }
    setSaving(true);
    try {
      const result = initial ? await api.subjects.update(initial.id, name.trim()) : await api.subjects.create(name.trim());
      onSave(result);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={initial ? 'Edit Subject' : 'Add Subject'} onClose={onClose}
      footer={<><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button></>}>
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="form-group">
        <label>Subject Name *</label>
        <input className="form-control" value={name} onChange={e => setName(e.target.value)}
          placeholder="e.g. Mathematics, English, Science..." autoFocus
          onKeyDown={e => { if (e.key === 'Enter') submit(); }} />
      </div>
    </Modal>
  );
}

export default function Subjects() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'add' | Subject | null>(null);
  const [error, setError] = useState('');

  const load = () => api.subjects.list().then(setSubjects).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const handleDelete = async (s: Subject) => {
    if (!confirm(`Delete "${s.name}"? It will be removed from all students and teachers.`)) return;
    try { await api.subjects.delete(s.id); setSubjects(ss => ss.filter(x => x.id !== s.id)); }
    catch (e: any) { setError(e.message); }
  };

  const handleSave = (saved: Subject) => {
    setSubjects(ss => ss.some(s => s.id === saved.id)
      ? ss.map(s => s.id === saved.id ? { ...s, ...saved } : s)
      : [...ss, { ...saved, student_count: 0, teacher_count: 0 }]);
    setModal(null);
  };

  return (
    <div>
      <div className="page-header">
        <div><h2>Subjects</h2><p>Manage subjects offered at the centre</p></div>
        <button className="btn btn-primary" onClick={() => setModal('add')}>+ Add Subject</button>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {loading ? <div className="loading">Loading...</div> : (
        <div className="card">
          {subjects.length === 0 ? (
            <div className="empty">
              <div className="icon">📚</div>
              <p>No subjects yet. Add subjects like Mathematics, English, Science...</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Subject</th><th>Students</th><th>Teachers</th><th>Actions</th></tr></thead>
                <tbody>
                  {subjects.map(s => (
                    <tr key={s.id}>
                      <td><strong>{s.name}</strong></td>
                      <td><span className="badge badge-blue">{s.student_count ?? 0} students</span></td>
                      <td><span className="badge badge-green">{s.teacher_count ?? 0} teachers</span></td>
                      <td><div className="actions">
                        <button className="btn btn-outline btn-sm" onClick={() => setModal(s)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s)}>Delete</button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {modal && <SubjectForm initial={modal === 'add' ? undefined : modal as Subject} onSave={handleSave} onClose={() => setModal(null)} />}
    </div>
  );
}
