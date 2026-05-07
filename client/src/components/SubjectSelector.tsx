import { useEffect, useState } from 'react';
import { api } from '../api';
import { Subject } from '../types';

interface Props {
  selected: number[];
  onChange: (ids: number[]) => void;
}

export default function SubjectSelector({ selected, onChange }: Props) {
  const [subjects, setSubjects] = useState<Subject[]>([]);

  useEffect(() => { api.subjects.list().then(setSubjects); }, []);

  if (subjects.length === 0)
    return <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No subjects yet. Add subjects on the Subjects page first.</p>;

  const toggle = (id: number) =>
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {subjects.map(s => {
        const on = selected.includes(s.id);
        return (
          <label key={s.id} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
            border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
            borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: on ? 600 : 400,
            background: on ? '#eff6ff' : '#fff', color: on ? 'var(--primary)' : 'var(--text)',
            userSelect: 'none', transition: 'all 0.12s'
          }}>
            <input type="checkbox" checked={on} onChange={() => toggle(s.id)} style={{ display: 'none' }} />
            {on && <span style={{ fontSize: 11 }}>✓</span>}
            {s.name}
          </label>
        );
      })}
    </div>
  );
}
