import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../api';
import { Student, Teacher, ClassGroup, Subject } from '../types';
import Modal from '../components/Modal';
import SubjectSelector from '../components/SubjectSelector';

const SYLLABI = ['KSSR', 'KSSM', 'Cambridge'];

// ─── Add / Edit student form ──────────────────────────────────────────────────

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

function StudentForm({ initial, teachers, allTags, onSave, onClose }: {
  initial?: Student; teachers: Teacher[]; allTags: any[]; onSave: (s: Student) => void; onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name || '', age: initial?.age?.toString() || '',
    syllabus: initial?.syllabus || 'KSSR', class_type: initial?.class_type || '1on1',
    teacher_id: initial?.teacher_id?.toString() || '', group_id: initial?.group_id?.toString() || '',
    active: initial?.active !== undefined ? initial.active : 1
  });
  const [selectedSubjects, setSelectedSubjects] = useState<number[]>(initial?.subjects?.map(s => s.id) ?? []);
  const [selectedTags, setSelectedTags] = useState<number[]>((initial as any)?.tags?.map((t: any) => t.id) ?? []);
  const [groups, setGroups] = useState<ClassGroup[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => { api.groups.list().then(setGroups); }, []);

  const handleGroupChange = (groupId: string) => {
    set('group_id', groupId);
    if (groupId) {
      const grp = groups.find(g => String(g.id) === groupId);
      if (grp) set('teacher_id', String(grp.teacher_id));
    }
  };

  const submit = async () => {
    if (!form.name.trim() || !form.age || !form.teacher_id) { setError('Name, age, and teacher are required'); return; }
    if (form.class_type === 'group' && !form.group_id) { setError('Please select a group class'); return; }
    const age = Number(form.age);
    if (age < 7 || age > 17) { setError('Age must be between 7 and 17'); return; }
    setSaving(true);
    try {
      const payload = { ...form, age, teacher_id: Number(form.teacher_id), group_id: form.group_id ? Number(form.group_id) : null };
      const result = initial ? await api.students.update(initial.id, payload) : await api.students.create(payload);
      await api.students.setSubjects(result.id, selectedSubjects);
      await api.tags.setForStudent(result.id, selectedTags);
      onSave({ ...result, subjects: selectedSubjects.map(id => ({ id, name: '' })) });
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={initial ? 'Edit Student' : 'Add Student'} onClose={onClose}
      footer={<><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button></>}>
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="form-group"><label>Full Name *</label><input className="form-control" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Student name" /></div>
      <div className="form-row">
        <div className="form-group"><label>Age *</label><input className="form-control" type="number" min={7} max={17} value={form.age} onChange={e => set('age', e.target.value)} /></div>
        <div className="form-group"><label>Syllabus *</label>
          <select className="form-control" value={form.syllabus} onChange={e => set('syllabus', e.target.value)}>
            {SYLLABI.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Class Type *</label>
          <select className="form-control" value={form.class_type} onChange={e => { set('class_type', e.target.value); set('group_id', ''); }}>
            <option value="1on1">1-on-1 Private</option>
            <option value="group">Group Class</option>
          </select>
        </div>
        <div className="form-group"><label>Teacher *</label>
          <select className="form-control" value={form.teacher_id} onChange={e => { set('teacher_id', e.target.value); set('group_id', ''); }}>
            <option value="">Select teacher...</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>
      {form.class_type === 'group' && (
        <div className="form-group"><label>Group Class *</label>
          <select className="form-control" value={form.group_id} onChange={e => handleGroupChange(e.target.value)}>
            <option value="">Select group...</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name} — {g.teacher_name} ({g.syllabus}, {g.duration_hours}h)</option>)}
          </select>
          {groups.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>No groups found. Create one in Group Classes first.</p>}
        </div>
      )}
      <div className="form-group">
        <label>Subjects</label>
        <SubjectSelector selected={selectedSubjects} onChange={setSelectedSubjects} />
      </div>
      <div className="form-group">
        <label>Branch</label>
        <TagSelector selected={selectedTags} onChange={setSelectedTags} allTags={allTags} />
      </div>
      {initial && (
        <div className="form-group"><label>Status</label>
          <select className="form-control" value={form.active} onChange={e => set('active', Number(e.target.value))}>
            <option value={1}>Active</option>
            <option value={0}>Inactive</option>
          </select>
        </div>
      )}
    </Modal>
  );
}

// ─── Excel import modal ───────────────────────────────────────────────────────

interface ImportRow {
  rowNum: number;
  sheet: 'group' | '1on1';
  name: string;
  age: string;
  syllabus: string;
  teacher_name: string;
  group_name: string;
  subject_names_raw: string;
  teacher_id?: number;
  group_id?: number;
  subject_ids: number[];
  subject_warnings: string[];   // subject names from Excel that couldn't be matched
  status: 'valid' | 'duplicate' | 'error';
  errors: string[];
}

function ImportModal({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const [lookup, setLookup] = useState<{ teachers: any[]; groups: any[]; subjects: any[]; existing: string[] } | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; duplicates: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { api.students.importLookup().then(setLookup); }, []);

  // Build and download a 2-sheet template pre-filled with actual groups / teachers / subjects
  const downloadTemplate = () => {
    if (!lookup) return;
    const wb = XLSX.utils.book_new();
    const subjectHint = lookup.subjects.length
      ? lookup.subjects.map((s: any) => s.name).join(', ')
      : 'Mathematics, English, Science';

    // ── Sheet 1: Group Students ──────────────────────────────────────────
    const grpHeader = ['Group Class', 'Student Name', 'Age', 'Subjects'];
    const grpNote   = [`Must match a group name in the system`, '(required)', '7–17', `Optional — comma-separated. Available: ${subjectHint}`];
    const grpRows: any[][] = [grpHeader, grpNote];

    if (lookup.groups.length > 0) {
      for (const g of lookup.groups) {
        grpRows.push([g.name, '', '', '']);
        grpRows.push([g.name, '', '', '']);
      }
    } else {
      grpRows.push(['KSSR Standard 3', 'Ali bin Ahmad', 10, 'Mathematics, English']);
      grpRows.push(['KSSR Standard 3', 'Siti Aminah', 9, 'Mathematics']);
      grpRows.push(['Cambridge Year 6', 'John Tan', 12, 'Science, English']);
    }

    const ws1 = XLSX.utils.aoa_to_sheet(grpRows);
    ws1['!cols'] = [{ wch: 26 }, { wch: 26 }, { wch: 6 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Group Students');

    // ── Sheet 2: 1-on-1 Students ─────────────────────────────────────────
    const priHeader = ['Teacher', 'Student Name', 'Age', 'Syllabus', 'Subjects'];
    const priNote   = ['Must match a teacher name', '(required)', '7–17', 'KSSR / KSSM / Cambridge', `Optional — comma-separated. Available: ${subjectHint}`];
    const priRows: any[][] = [priHeader, priNote];

    if (lookup.teachers.length > 0) {
      for (const t of lookup.teachers) {
        priRows.push([t.name, '', '', 'KSSR', '']);
        priRows.push([t.name, '', '', 'KSSR', '']);
      }
    } else {
      priRows.push(['Ms. Sarah', 'Ahmad Faris', 11, 'KSSR', 'Mathematics, English']);
      priRows.push(['Mr. Kumar', 'Emily Chen', 14, 'Cambridge', 'Mathematics']);
    }

    const ws2 = XLSX.utils.aoa_to_sheet(priRows);
    ws2['!cols'] = [{ wch: 22 }, { wch: 26 }, { wch: 6 }, { wch: 14 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, ws2, '1-on-1 Students');

    XLSX.writeFile(wb, 'students_import_template.xlsx');
  };

  const resolveSubjects = (raw: string): { ids: number[]; warnings: string[] } => {
    if (!raw.trim() || !lookup) return { ids: [], warnings: [] };
    const ids: number[] = [], warnings: string[] = [];
    for (const part of raw.split(',').map(s => s.trim()).filter(Boolean)) {
      const match = lookup.subjects.find((s: any) => s.name.toLowerCase() === part.toLowerCase());
      if (match) ids.push(match.id);
      else warnings.push(part);
    }
    return { ids, warnings };
  };

  const parseFile = (file: File) => {
    if (!lookup) return;
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      alert('Please upload an Excel (.xlsx, .xls) or CSV file.');
      return;
    }
    setFileName(file.name);
    setResult(null);

    const reader = new FileReader();
    reader.onload = e => {
      const wb = XLSX.read(e.target?.result, { type: 'binary' });
      const allRows: ImportRow[] = [];

      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json<any>(ws, { defval: '' });
        if (rawRows.length === 0) continue;

        // Detect sheet type by checking which key columns are present in first row
        const firstKeys = Object.keys(rawRows[0]).map(k => k.trim().toLowerCase());
        const hasGroupClass = firstKeys.some(k => k.includes('group'));
        const hasSyllabus   = firstKeys.some(k => k.includes('syllabus'));
        const isGroupSheet  = hasGroupClass && !hasSyllabus;
        const is1on1Sheet   = hasSyllabus;

        if (!isGroupSheet && !is1on1Sheet) continue; // skip unrecognised sheets

        const get = (row: any, ...keys: string[]) => {
          for (const k of keys) {
            const found = Object.keys(row).find(rk => rk.trim().toLowerCase() === k.toLowerCase());
            if (found !== undefined) return String(row[found]).trim();
          }
          return '';
        };

        rawRows.forEach((row: any, i: number) => {
          const name = get(row, 'Student Name', 'Name');
          if (!name) return; // skip blank / instruction rows

          const age = get(row, 'Age');
          const subject_names_raw = get(row, 'Subjects', 'Subject');
          const { ids: subject_ids, warnings: subject_warnings } = resolveSubjects(subject_names_raw);
          const errors: string[] = [];

          const ageNum = Number(age);
          if (!age || isNaN(ageNum) || ageNum < 7 || ageNum > 17)
            errors.push('Age must be 7–17');

          let teacher_id: number | undefined;
          let group_id: number | undefined;
          let syllabus = '';

          if (isGroupSheet) {
            const group_name = get(row, 'Group Class', 'Group');
            if (!group_name) { errors.push('Group Class is required'); }
            else {
              const grp = lookup.groups.find((g: any) => g.name.trim().toLowerCase() === group_name.toLowerCase());
              if (grp) { group_id = grp.id; teacher_id = grp.teacher_id; syllabus = grp.syllabus; }
              else errors.push(`Group "${group_name}" not found`);
            }

            const isDuplicate = !!name && lookup.existing.includes(name.toLowerCase());
            allRows.push({
              rowNum: i + 2, sheet: 'group', name, age, syllabus,
              teacher_name: '', group_name: get(row, 'Group Class', 'Group'),
              subject_names_raw, teacher_id, group_id, subject_ids, subject_warnings,
              status: errors.length > 0 ? 'error' : isDuplicate ? 'duplicate' : 'valid', errors
            });
          } else {
            syllabus = get(row, 'Syllabus');
            const teacher_name = get(row, 'Teacher', 'Teacher Name');

            if (!['kssr', 'kssm', 'cambridge'].includes(syllabus.toLowerCase()))
              errors.push('Syllabus must be KSSR, KSSM, or Cambridge');

            if (!teacher_name) { errors.push('Teacher is required'); }
            else {
              const t = lookup.teachers.find((t: any) => t.name.trim().toLowerCase() === teacher_name.toLowerCase());
              if (t) teacher_id = t.id;
              else errors.push(`Teacher "${teacher_name}" not found`);
            }

            const isDuplicate = !!name && lookup.existing.includes(name.toLowerCase());
            allRows.push({
              rowNum: i + 2, sheet: '1on1', name, age, syllabus,
              teacher_name: get(row, 'Teacher', 'Teacher Name'), group_name: '',
              subject_names_raw, teacher_id, group_id, subject_ids, subject_warnings,
              status: errors.length > 0 ? 'error' : isDuplicate ? 'duplicate' : 'valid', errors
            });
          }
        });
      }
      setRows(allRows);
    };
    reader.readAsBinaryString(file);
  };

  const validRows   = rows.filter(r => r.status === 'valid');
  const dupRows     = rows.filter(r => r.status === 'duplicate');
  const errRows     = rows.filter(r => r.status === 'error');
  const groupRows   = rows.filter(r => r.sheet === 'group');
  const privateRows = rows.filter(r => r.sheet === '1on1');

  const doImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    try {
      const res = await api.students.bulkImport(validRows.map(r => ({
        name: r.name, age: Number(r.age), syllabus: r.syllabus,
        class_type: r.sheet, teacher_id: r.teacher_id, group_id: r.group_id || null,
        subject_ids: r.subject_ids
      })));
      setResult(res);
      onDone();
    } catch (e: any) { alert(e.message); }
    finally { setImporting(false); }
  };

  const statusBadge = (s: ImportRow['status']) =>
    s === 'valid'     ? <span className="badge badge-green">Valid</span>
    : s === 'duplicate' ? <span className="badge badge-yellow">Duplicate</span>
    : <span className="badge badge-red">Error</span>;

  const renderPreviewTable = (title: string, tableRows: ImportRow[]) => {
    if (tableRows.length === 0) return null;
    const isGroup = tableRows[0].sheet === 'group';
    return (
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`badge ${isGroup ? 'badge-blue' : 'badge-green'}`}>{isGroup ? 'Group Students' : '1-on-1 Students'}</span>
          <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{tableRows.length} rows</span>
        </div>
        <div className="table-wrap" style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6 }}>
          <table>
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr>
                <th>Row</th><th>Status</th><th>Name</th><th>Age</th>
                {isGroup ? <th>Group</th> : <><th>Teacher</th><th>Syllabus</th></>}
                <th>Subjects</th><th>Issue</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map(r => (
                <tr key={`${r.sheet}-${r.rowNum}`} style={{
                  background: r.status === 'valid' ? '#f0fdf4' : r.status === 'duplicate' ? '#fefce8' : '#fff7f7'
                }}>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{r.rowNum}</td>
                  <td>{statusBadge(r.status)}</td>
                  <td><strong>{r.name}</strong></td>
                  <td>{r.age}</td>
                  {isGroup
                    ? <td>{r.group_name}</td>
                    : <><td>{r.teacher_name}</td><td>{r.syllabus}</td></>}
                  <td style={{ fontSize: 12 }}>
                    {r.subject_ids.length > 0 && (
                      <span style={{ color: 'var(--success)' }}>{r.subject_names_raw.split(',').filter((_, i) => r.subject_ids[i] !== undefined).join(', ')}</span>
                    )}
                    {r.subject_warnings.length > 0 && (
                      <span style={{ color: 'var(--warning)', marginLeft: r.subject_ids.length ? 4 : 0 }}>
                        {r.subject_ids.length > 0 ? '+ ' : ''}⚠ unknown: {r.subject_warnings.join(', ')}
                      </span>
                    )}
                    {r.subject_ids.length === 0 && r.subject_warnings.length === 0 && <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td style={{ fontSize: 12, color: r.status === 'duplicate' ? 'var(--warning)' : 'var(--danger)' }}>
                    {r.status === 'duplicate' ? 'Already exists' : r.errors.join('; ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 960 }}>
        <div className="modal-header">
          <h3>Import Students from Excel</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              The template has <strong>two sheets</strong>: one for group class students, one for 1-on-1 students.
              Group and teacher names must match the system exactly. Subjects are optional, comma-separated.
              Duplicates (same student name already active) are flagged and skipped automatically.
            </div>
            <button className="btn btn-outline btn-sm" style={{ whiteSpace: 'nowrap' }}
              onClick={downloadTemplate} disabled={!lookup}>
              ⬇ Download Template
            </button>
          </div>

          <div
            className={`import-dropzone${dragOver ? ' drag-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) parseFile(f); }}
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f); }} />
            {fileName
              ? <><div style={{ fontSize: 24 }}>📄</div><div><strong>{fileName}</strong></div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Click or drop to replace</div></>
              : <><div style={{ fontSize: 32 }}>📂</div><div><strong>Click to browse or drag & drop</strong></div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>.xlsx or .xls</div></>}
          </div>

          {result && (
            <div className="alert alert-success">
              Imported {result.imported} student{result.imported !== 1 ? 's' : ''} successfully.
              {result.duplicates > 0 && ` ${result.duplicates} duplicate(s) skipped.`}
              {result.errors.length > 0 && ` ${result.errors.length} error(s).`}
            </div>
          )}

          {rows.length > 0 && (
            <>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="badge badge-green">{validRows.length} valid</span>
                <span className="badge badge-yellow">{dupRows.length} duplicate{dupRows.length !== 1 ? 's' : ''} — skipped</span>
                <span className="badge badge-red">{errRows.length} error{errRows.length !== 1 ? 's' : ''} — skipped</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  {groupRows.length} group &bull; {privateRows.length} 1-on-1
                </span>
              </div>
              {renderPreviewTable('Group Students', groupRows)}
              {renderPreviewTable('1-on-1 Students', privateRows)}
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Close</button>
          {validRows.length > 0 && (
            <button className="btn btn-primary" onClick={doImport} disabled={importing}>
              {importing ? 'Importing...' : `Import ${validRows.length} valid student${validRows.length !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Students page ────────────────────────────────────────────────────────────

const SUBJECT_COLORS = ['badge-blue', 'badge-green', 'badge-purple', 'badge-yellow', 'badge-red'];
const subjectColor = (id: number) => SUBJECT_COLORS[id % SUBJECT_COLORS.length];

export default function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [allTags, setAllTags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'add' | 'import' | Student | null>(null);
  const [filterTeacher, setFilterTeacher] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const load = async () => {
    const [s, t, sub, tags] = await Promise.all([api.students.list(), api.teachers.list(), api.subjects.list(), api.tags.list()]);
    setStudents(s); setTeachers(t); setAllSubjects(sub); setAllTags(tags);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleDeactivate = async (s: Student) => {
    if (!confirm(`Deactivate ${s.name}?`)) return;
    await api.students.deactivate(s.id);
    setStudents(ss => ss.map(x => x.id === s.id ? { ...x, active: 0 } : x));
  };

  const handleSave = (saved: Student) => {
    setStudents(ss => ss.some(s => s.id === saved.id) ? ss.map(s => s.id === saved.id ? { ...s, ...saved } : s) : [...ss, saved]);
    setModal(null);
    load();
  };

  const syllabusBadge = (s: string) => s === 'Cambridge' ? 'badge-purple' : s === 'KSSM' ? 'badge-yellow' : 'badge-blue';

  const filtered = students.filter(s =>
    (showInactive ? true : s.active === 1) &&
    (filterTeacher ? s.teacher_id === Number(filterTeacher) : true) &&
    (filterType ? s.class_type === filterType : true) &&
    (filterSubject ? s.subjects?.some(sub => sub.id === Number(filterSubject)) : true) &&
    (filterBranch ? (s as any).tags?.some((tag: any) => tag.id === Number(filterBranch)) : true)
  );
  const branchTags = allTags.filter(t => t.category === 'branch');

  return (
    <div>
      <div className="page-header">
        <div><h2>Students</h2><p>Manage enrolled students</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => setModal('import')}>⬆ Import Excel</button>
          <button className="btn btn-primary" onClick={() => setModal('add')}>+ Add Student</button>
        </div>
      </div>
      <div className="filters">
        <select className="form-control" value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)}>
          <option value="">All Teachers</option>
          {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select className="form-control" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          <option value="1on1">1-on-1</option>
          <option value="group">Group</option>
        </select>
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
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          Show Inactive
        </label>
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{filtered.length} students</span>
      </div>
      {loading ? <div className="loading">Loading...</div> : (
        <div className="card">
          <div className="table-wrap">
            {filtered.length === 0 ? (
              <div className="empty"><div className="icon">🎒</div><p>No students found.</p></div>
            ) : (
              <table>
                <thead><tr><th>Name</th><th>Branch</th><th>Age</th><th>Syllabus</th><th>Type</th><th>Teacher</th><th>Group</th><th>Subjects</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {filtered.map(s => (
                    <tr key={s.id}>
                      <td><strong>{s.name}</strong></td>
                      <td>
                        {(s as any).tags?.filter((tag: any) => tag.category === 'branch').length > 0
                          ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {(s as any).tags.filter((tag: any) => tag.category === 'branch').map((tag: any) => (
                                <span key={tag.id} style={{ background: tag.color + '22', border: `1px solid ${tag.color}`, color: tag.color, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{tag.name}</span>
                              ))}
                            </div>
                          : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td>{s.age}</td>
                      <td><span className={`badge ${syllabusBadge(s.syllabus)}`}>{s.syllabus}</span></td>
                      <td><span className={`badge ${s.class_type === '1on1' ? 'badge-green' : 'badge-blue'}`}>{s.class_type === '1on1' ? '1-on-1' : 'Group'}</span></td>
                      <td>{s.teacher_name}</td>
                      <td>{s.group_name || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                      <td>
                        {s.subjects && s.subjects.length > 0
                          ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{s.subjects.map(sub => <span key={sub.id} className={`badge ${subjectColor(sub.id)}`}>{sub.name}</span>)}</div>
                          : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td><span className={`badge ${s.active ? 'badge-green' : 'badge-gray'}`}>{s.active ? 'Active' : 'Inactive'}</span></td>
                      <td><div className="actions">
                        <button className="btn btn-outline btn-sm" onClick={() => setModal(s)}>Edit</button>
                        {s.active === 1 && <button className="btn btn-danger btn-sm" onClick={() => handleDeactivate(s)}>Deactivate</button>}
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
      {modal === 'add' && <StudentForm teachers={teachers} allTags={allTags} onSave={handleSave} onClose={() => setModal(null)} />}
      {modal === 'import' && <ImportModal onDone={() => { setModal(null); load(); }} onClose={() => setModal(null)} />}
      {modal && modal !== 'add' && modal !== 'import' && (
        <StudentForm initial={modal as Student} teachers={teachers} allTags={allTags} onSave={handleSave} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
