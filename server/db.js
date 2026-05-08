const { createClient } = require('@libsql/client');
const bcrypt = require('bcrypt');

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:punch_tracker.db',
  authToken: process.env.TURSO_AUTH_TOKEN || undefined
});

function toObj(row) {
  if (!row) return null;
  const plain = { ...row };
  for (const key of Object.keys(plain)) {
    if (typeof plain[key] === 'bigint') plain[key] = Number(plain[key]);
  }
  return plain;
}

const db = {
  async all(sql, args = []) {
    const rs = await client.execute({ sql, args });
    return rs.rows.map(toObj);
  },
  async get(sql, args = []) {
    const rs = await client.execute({ sql, args });
    return toObj(rs.rows[0] || null);
  },
  async run(sql, args = []) {
    const rs = await client.execute({ sql, args });
    return {
      lastInsertRowid: rs.lastInsertRowid !== undefined ? Number(rs.lastInsertRowid) : null,
      changes: rs.rowsAffected
    };
  },
  async batch(statements) {
    const rs = await client.batch(statements, 'write');
    return rs.map(r => ({
      lastInsertRowid: r.lastInsertRowid !== undefined ? Number(r.lastInsertRowid) : null,
      changes: r.rowsAffected
    }));
  }
};

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS class_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    teacher_id INTEGER NOT NULL,
    syllabus TEXT NOT NULL,
    subject_id INTEGER,
    standard TEXT DEFAULT '',
    duration_hours REAL NOT NULL DEFAULT 1.5,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id),
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
  );

  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    parent_name TEXT DEFAULT '',
    age INTEGER NOT NULL,
    syllabus TEXT NOT NULL,
    class_type TEXT NOT NULL,
    teacher_id INTEGER NOT NULL,
    group_id INTEGER,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id),
    FOREIGN KEY (group_id) REFERENCES class_groups(id)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    student_id INTEGER,
    group_id INTEGER,
    session_date TEXT NOT NULL,
    duration_hours REAL NOT NULL,
    class_type TEXT NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id),
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (group_id) REFERENCES class_groups(id)
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    attended INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id),
    UNIQUE(session_id, student_id)
  );

  CREATE TABLE IF NOT EXISTS student_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    classes_count INTEGER NOT NULL DEFAULT 0,
    duration_hours REAL NOT NULL DEFAULT 0,
    hourly_rate REAL NOT NULL DEFAULT 0,
    tuition_fee REAL NOT NULL DEFAULT 0,
    material_fee REAL NOT NULL DEFAULT 6,
    total_due REAL NOT NULL DEFAULT 0,
    paid INTEGER NOT NULL DEFAULT 0,
    paid_date TEXT,
    notes TEXT DEFAULT '',
    UNIQUE(student_id, month, year),
    FOREIGN KEY (student_id) REFERENCES students(id)
  );

  CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS student_subjects (
    student_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    PRIMARY KEY (student_id, subject_id),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS teacher_subjects (
    teacher_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    PRIMARY KEY (teacher_id, subject_id),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS teacher_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    total_tuition_fee REAL NOT NULL DEFAULT 0,
    collaboration_fee REAL NOT NULL DEFAULT 0,
    material_fee REAL NOT NULL DEFAULT 0,
    net_pay REAL NOT NULL DEFAULT 0,
    paid INTEGER NOT NULL DEFAULT 0,
    paid_date TEXT,
    notes TEXT DEFAULT '',
    UNIQUE(teacher_id, month, year),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id)
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'teacher',
    teacher_id INTEGER,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id)
  );

  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#6366f1',
    category TEXT NOT NULL DEFAULT 'general',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS teacher_tags (
    teacher_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (teacher_id, tag_id),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS student_tags (
    student_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (student_id, tag_id),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS session_tags (
    session_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (session_id, tag_id),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS payment_tags (
    payment_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    payment_type TEXT NOT NULL,
    PRIMARY KEY (payment_id, tag_id, payment_type),
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS recurring_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    frequency TEXT NOT NULL DEFAULT 'monthly',
    day_of_month INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1,
    last_generated TEXT,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (student_id) REFERENCES students(id)
  );

  CREATE TABLE IF NOT EXISTS einvoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    payment_id INTEGER,
    invoice_number TEXT NOT NULL UNIQUE,
    invoice_date TEXT NOT NULL,
    description TEXT DEFAULT '',
    amount REAL NOT NULL,
    tax_amount REAL NOT NULL DEFAULT 0,
    total_amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    myinvois_uuid TEXT,
    myinvois_submission_uid TEXT,
    submitted_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (payment_id) REFERENCES student_payments(id)
  );
`;

let _initPromise = null;

const MIGRATIONS = [
  `ALTER TABLE students ADD COLUMN parent_name TEXT DEFAULT ''`,
  `ALTER TABLE class_groups ADD COLUMN subject_id INTEGER`,
  `ALTER TABLE class_groups ADD COLUMN standard TEXT DEFAULT ''`,
];

db.ensureInit = function () {
  if (!_initPromise) {
    _initPromise = (async () => {
      await client.executeMultiple(SCHEMA);
      for (const sql of MIGRATIONS) {
        try { await client.execute(sql); } catch (_) { /* column already exists */ }
      }
      const row = await db.get('SELECT COUNT(*) as count FROM users');
      if (!row || row.count === 0) {
        const hash = await bcrypt.hash('admin123', 10);
        await db.run(
          "INSERT INTO users (username, password_hash, role) VALUES ('admin', ?, 'admin')",
          [hash]
        );
        console.log('Default admin created: username=admin password=admin123');
      }
    })().catch(e => {
      _initPromise = null; // allow retry on next request if init failed
      throw e;
    });
  }
  return _initPromise;
};

module.exports = db;
