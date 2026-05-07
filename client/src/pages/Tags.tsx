import { useState, useEffect } from 'react';
import { api } from '../api';

const CATEGORIES = ['general', 'branch', 'department', 'project'];
const PRESET_COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#3b82f6','#ec4899','#8b5cf6','#14b8a6'];

export default function Tags() {
  const [tags, setTags] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ name: '', color: '#6366f1', category: 'general' });
  const [error, setError] = useState('');

  function refresh() { api.tags.list().then(setTags); }
  useEffect(() => { refresh(); }, []);

  function openAdd() { setEditing(null); setForm({ name: '', color: '#6366f1', category: 'general' }); setShowForm(true); setError(''); }
  function openEdit(tag: any) { setEditing(tag); setForm({ name: tag.name, color: tag.color, category: tag.category }); setShowForm(true); setError(''); }

  async function save() {
    setError('');
    if (!form.name.trim()) return setError('Tag name required');
    try {
      if (editing) await api.tags.update(editing.id, form);
      else await api.tags.create(form);
      setShowForm(false);
      refresh();
    } catch (err: any) { setError(err.message); }
  }

  async function remove(id: number) {
    if (!confirm('Delete this tag? It will be removed from all tagged transactions.')) return;
    await api.tags.delete(id);
    refresh();
  }

  const byCategory = CATEGORIES.map(cat => ({
    cat,
    tags: tags.filter(t => t.category === cat)
  })).filter(g => g.tags.length > 0);

  return (
    <div>
      <div className="page-header">
        <h1>Transaction Tags</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ New Tag</button>
      </div>
      <p className="page-desc">Tag sessions and payments with branches, departments, projects or custom labels for detailed reporting.</p>

      {showForm && (
        <div className="card" style={{ marginBottom: '1.5rem', maxWidth: 480 }}>
          <h3>{editing ? 'Edit Tag' : 'New Tag'}</h3>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-group">
            <label>Tag Name</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Branch A, Project X" autoFocus />
          </div>
          <div className="form-group">
            <label>Category</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Color</label>
            <div className="color-swatches">
              {PRESET_COLORS.map(c => (
                <button key={c} className={`color-swatch ${form.color === c ? 'selected' : ''}`}
                  style={{ background: c }} onClick={() => setForm(f => ({ ...f, color: c }))} />
              ))}
              <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} title="Custom color" />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" onClick={save}>{editing ? 'Update' : 'Create'}</button>
            <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {tags.length === 0 ? (
        <div className="empty-state">
          <p>No tags yet. Create tags to start labelling your sessions and payments.</p>
        </div>
      ) : (
        byCategory.map(({ cat, tags: catTags }) => (
          <div key={cat} className="tag-section">
            <h3 className="tag-category">{cat.charAt(0).toUpperCase() + cat.slice(1)}</h3>
            <div className="tag-list">
              {catTags.map(tag => (
                <div key={tag.id} className="tag-chip-row">
                  <span className="tag-chip" style={{ background: tag.color + '22', borderColor: tag.color, color: tag.color }}>
                    <span className="tag-dot" style={{ background: tag.color }} />
                    {tag.name}
                  </span>
                  <div className="tag-actions">
                    <button className="btn btn-sm btn-outline" onClick={() => openEdit(tag)}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => remove(tag.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
