import { useState, useEffect } from 'react';
import { api } from '../api';

export default function Users() {
  const [users, setUsers] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [resetModal, setResetModal] = useState<any | null>(null);
  const [form, setForm] = useState({ username: '', password: '', role: 'teacher', teacher_id: '' });
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');

  function refresh() {
    api.users.list().then(setUsers);
    api.teachers.list().then(setTeachers);
  }
  useEffect(() => { refresh(); }, []);

  async function createUser() {
    setError('');
    if (!form.username || !form.password) return setError('Username and password required');
    if (form.role === 'teacher' && !form.teacher_id) return setError('Select a teacher for this account');
    try {
      await api.users.create({ ...form, teacher_id: form.teacher_id ? Number(form.teacher_id) : undefined });
      setShowForm(false);
      setForm({ username: '', password: '', role: 'teacher', teacher_id: '' });
      refresh();
    } catch (err: any) { setError(err.message); }
  }

  async function toggleActive(user: any) {
    await api.users.update(user.id, { active: user.active ? 0 : 1 });
    refresh();
  }

  async function resetPassword() {
    if (!newPassword) return;
    await api.users.resetPassword(resetModal.id, newPassword);
    setResetModal(null);
    setNewPassword('');
    alert('Password reset successfully');
  }

  async function deleteUser(id: number) {
    if (!confirm('Delete this user account?')) return;
    await api.users.delete(id);
    refresh();
  }

  return (
    <div>
      <div className="page-header">
        <h1>User Accounts</h1>
        <button className="btn btn-primary" onClick={() => { setShowForm(true); setError(''); }}>+ New User</button>
      </div>
      <p className="page-desc">Manage login accounts. Teachers can only access the Teacher Portal (attendance). Admins have full access.</p>

      {showForm && (
        <div className="card" style={{ marginBottom: '1.5rem', maxWidth: 480 }}>
          <h3>New User Account</h3>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-row">
            <div className="form-group">
              <label>Username</label>
              <input type="text" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} autoFocus placeholder="e.g. teacher_ali" />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Set initial password" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Role</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value, teacher_id: '' }))}>
                <option value="teacher">Teacher</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {form.role === 'teacher' && (
              <div className="form-group">
                <label>Link to Teacher</label>
                <select value={form.teacher_id} onChange={e => setForm(f => ({ ...f, teacher_id: e.target.value }))}>
                  <option value="">Select teacher</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" onClick={createUser}>Create Account</button>
            <button className="btn btn-outline" onClick={() => { setShowForm(false); setError(''); }}>Cancel</button>
          </div>
        </div>
      )}

      {resetModal && (
        <div className="modal-overlay" onClick={() => setResetModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Reset Password — {resetModal.username}</h3>
              <button onClick={() => setResetModal(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>New Password</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Enter new password" autoFocus />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={resetPassword}>Reset Password</button>
              <button className="btn btn-outline" onClick={() => { setResetModal(null); setNewPassword(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr><th>Username</th><th>Role</th><th>Linked Teacher</th><th>Status</th><th>Created</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td><strong>{u.username}</strong></td>
                <td><span className={`badge badge-${u.role === 'admin' ? 'purple' : 'blue'}`}>{u.role}</span></td>
                <td>{u.teacher_name || '—'}</td>
                <td><span className={`badge badge-${u.active ? 'green' : 'red'}`}>{u.active ? 'Active' : 'Disabled'}</span></td>
                <td>{u.created_at?.split('T')[0] || ''}</td>
                <td>
                  <button className="btn btn-sm btn-outline" onClick={() => { setResetModal(u); setNewPassword(''); }}>Reset PW</button>
                  <button className="btn btn-sm btn-outline" onClick={() => toggleActive(u)}>{u.active ? 'Disable' : 'Enable'}</button>
                  <button className="btn btn-sm btn-danger" onClick={() => deleteUser(u.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
