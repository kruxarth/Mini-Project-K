import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'app.db');

import fs from 'fs';
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function migrate() {
  await run(`PRAGMA foreign_keys = ON;`);
  
  // Add new columns to existing teachers table if they don't exist
  const columnsToAdd = [
    { name: 'phone', type: 'TEXT' },
    { name: 'address', type: 'TEXT' },
    { name: 'profile_photo', type: 'TEXT' },
    { name: 'bio', type: 'TEXT' },
    { name: 'department', type: 'TEXT' },
    { name: 'designation', type: 'TEXT' },
    { name: 'date_of_birth', type: 'DATE' },
    { name: 'date_joined', type: 'DATE DEFAULT (date(\'now\'))' },
    { name: 'updated_at', type: 'TEXT DEFAULT (datetime(\'now\'))' },
    { name: 'email_verified', type: 'INTEGER DEFAULT 1' },
    { name: 'verification_token', type: 'TEXT' },
    { name: 'token_expiry', type: 'TEXT' },
    { name: 'created_at', type: 'TEXT DEFAULT (datetime(\'now\'))' }
  ];

  for (const column of columnsToAdd) {
    try {
      await run(`ALTER TABLE teachers ADD COLUMN ${column.name} ${column.type}`);
      console.log(`Added column: ${column.name}`);
    } catch (e) { 
      // Column already exists, which is fine
    }
  }

  // Add new columns to classes table
  const classColumnsToAdd = [
    { name: 'department', type: 'TEXT' },
    { name: 'semester', type: 'TEXT' },
    { name: 'subject', type: 'TEXT' },
    { name: 'num_students', type: 'INTEGER' },
    { name: 'attendance_type', type: 'TEXT DEFAULT "period-wise"' },
    { name: 'min_attendance', type: 'INTEGER DEFAULT 75' },
    { name: 'auto_notifications', type: 'INTEGER DEFAULT 1' },
    { name: 'notification_email', type: 'INTEGER DEFAULT 1' },
    { name: 'notification_sms', type: 'INTEGER DEFAULT 0' }
  ];

  for (const column of classColumnsToAdd) {
    try {
      await run(`ALTER TABLE classes ADD COLUMN ${column.name} ${column.type}`);
      console.log(`Added class column: ${column.name}`);
    } catch (e) { 
      // Column already exists, which is fine
    }
  }

  // Add new columns to students table
  const studentColumnsToAdd = [
    { name: 'email', type: 'TEXT' },
    { name: 'phone', type: 'TEXT' },
    { name: 'enrollment_status', type: 'TEXT DEFAULT "active"' },
    { name: 'notes', type: 'TEXT' },
    { name: 'date_of_birth', type: 'DATE' },
    { name: 'address', type: 'TEXT' },
    { name: 'emergency_contact', type: 'TEXT' },
    { name: 'emergency_phone', type: 'TEXT' },
    { name: 'academic_year', type: 'TEXT' },
    { name: 'branch', type: 'TEXT' },
    { name: 'created_at', type: 'TEXT DEFAULT (datetime(\'now\'))' },
    { name: 'updated_at', type: 'TEXT DEFAULT (datetime(\'now\'))' }
  ];

  for (const column of studentColumnsToAdd) {
    try {
      await run(`ALTER TABLE students ADD COLUMN ${column.name} ${column.type}`);
      console.log(`Added student column: ${column.name}`);
    } catch (e) { 
      // Column already exists, which is fine
    }
  }

  // Add new columns to attendance table
  const attendanceColumnsToAdd = [
    { name: 'session_time', type: 'TEXT' },
    { name: 'marked_at', type: 'TEXT DEFAULT (datetime(\'now\'))' },
    { name: 'marked_by', type: 'INTEGER' }
  ];

  for (const column of attendanceColumnsToAdd) {
    try {
      await run(`ALTER TABLE attendance ADD COLUMN ${column.name} ${column.type}`);
      console.log(`Added attendance column: ${column.name}`);
    } catch (e) { 
      // Column already exists, which is fine
    }
  }

  await run(`CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    profile_photo TEXT,
    bio TEXT,
    department TEXT,
    designation TEXT,
    date_of_birth DATE,
    date_joined DATE DEFAULT (date('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    email_verified INTEGER DEFAULT 1,
    verification_token TEXT,
    token_expiry TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );`);


  await run(`CREATE TABLE IF NOT EXISTS periods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    UNIQUE(class_id, name),
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
  );`);

  await run(`CREATE TABLE IF NOT EXISTS attendance_period (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    period_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    present INTEGER NOT NULL CHECK (present IN (0,1)),
    note TEXT,
    UNIQUE(date, period_id, student_id),
    FOREIGN KEY (period_id) REFERENCES periods(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
  );`);

  await run(`CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    section TEXT,
    teacher_id INTEGER NOT NULL,
    department TEXT,
    semester TEXT,
    academic_year TEXT,
    subject TEXT,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(name, academic_year),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
  );`);

  await run(`CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,
    class_id INTEGER NOT NULL,
    teacher_id INTEGER NOT NULL,
    credits INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
  );`);

  // Insert default subjects if none exist
  const subjectCount = await get(`SELECT COUNT(*) as count FROM subjects`);
  if (subjectCount.count === 0) {
    // Get first teacher and class for default subjects
    const firstTeacher = await get(`SELECT id FROM teachers LIMIT 1`);
    const firstClass = await get(`SELECT id FROM classes LIMIT 1`);
    
    if (firstTeacher && firstClass) {
      const defaultSubjects = [
        { name: 'Mathematics', code: 'MATH' },
        { name: 'English', code: 'ENG' },
        { name: 'Science', code: 'SCI' },
        { name: 'Social Studies', code: 'SS' },
        { name: 'Computer Science', code: 'CS' }
      ];

      for (const subject of defaultSubjects) {
        await run(`INSERT INTO subjects (name, code, class_id, teacher_id) VALUES (?, ?, ?, ?)`, 
          [subject.name, subject.code, firstClass.id, firstTeacher.id]);
      }
    }
  }

  await run(`CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    roll_no TEXT,
    email TEXT,
    phone TEXT,
    enrollment_status TEXT DEFAULT 'active' CHECK (enrollment_status IN ('active','inactive','graduated','transferred')),
    notes TEXT,
    date_of_birth DATE,
    address TEXT,
    emergency_contact TEXT,
    emergency_phone TEXT,
    class_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(roll_no, class_id),
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
  );`);

  await run(`CREATE TABLE IF NOT EXISTS guardians (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT,
    phone TEXT,
    preferred_channel TEXT DEFAULT 'email',
    student_id INTEGER NOT NULL,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
  );`);

  await run(`CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    session_time TEXT,
    class_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('present','absent','late','excused')),
    note TEXT,
    marked_at TEXT DEFAULT (datetime('now')),
    marked_by INTEGER,
    UNIQUE(date, session_time, student_id),
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (marked_by) REFERENCES teachers(id)
  );`);

  await run(`CREATE TABLE IF NOT EXISTS notification_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attendance_id INTEGER NOT NULL,
    channel TEXT NOT NULL,
    status TEXT NOT NULL,
    provider_id TEXT,
    sent_at TEXT,
    error TEXT,
    FOREIGN KEY (attendance_id) REFERENCES attendance(id) ON DELETE CASCADE
  );`);

  // Notifications service log table
  await run(`CREATE TABLE IF NOT EXISTS notifications_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    recipient TEXT NOT NULL,
    content TEXT NOT NULL,
    student_name TEXT,
    status TEXT NOT NULL,
    error_message TEXT,
    created_at TEXT NOT NULL
  );`);

  // Notification settings table
  await run(`CREATE TABLE IF NOT EXISTS notification_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    absence_notifications BOOLEAN DEFAULT 1,
    low_attendance_alerts BOOLEAN DEFAULT 1,
    weekly_reports BOOLEAN DEFAULT 1,
    monthly_reports BOOLEAN DEFAULT 1,
    low_attendance_threshold INTEGER DEFAULT 75,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
  );`);

  // Alerts table for dashboard notifications
  await run(`CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK (type IN ('success', 'info', 'warning', 'error', 'system')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    teacher_id INTEGER,
    student_id INTEGER,
    class_id INTEGER,
    is_read BOOLEAN DEFAULT 0,
    read_at TEXT,
    expires_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
  );`);
}

async function seed() {
  const existing = await all(`SELECT COUNT(*) as c FROM teachers;`);
  if (existing[0].c > 0) return;
  const password_hash = await bcrypt.hash('pass1234', 10);
  await run(`INSERT INTO teachers (name, email, password_hash) VALUES (?,?,?)`, [
    'Demo Teacher',
    'teacher@example.com',
    password_hash
  ]);
  const teacher = (await all(`SELECT * FROM teachers WHERE email = ?`, ['teacher@example.com']))[0];

  await run(`INSERT INTO classes (name, section, teacher_id) VALUES (?,?,?)`, [
    'Class 8', 'A', teacher.id
  ]);
  const klass = (await all(`SELECT * FROM classes WHERE teacher_id = ?`, [teacher.id]))[0];

  const students = [
    ['Aarav Sharma','1'],
    ['Diya Patel','2'],
    ['Kabir Singh','3'],
    ['Ananya Gupta','4']
  ];
  for (const [name, roll] of students) {
    await run(`INSERT INTO students (name, roll_no, class_id) VALUES (?,?,?)`, [name, roll, klass.id]);
  }
  const rows = await all(`SELECT * FROM students WHERE class_id = ?`, [klass.id]);
  for (const s of rows) {
    await run(`INSERT INTO guardians (name, email, phone, preferred_channel, student_id) VALUES (?,?,?,?,?)`, [
      `${s.name} Parent`, `${s.name.split(' ')[0].toLowerCase()}@example.com`, '+911234567890', 'email', s.id
    ]);
  }

  // default 6 periods for the class
  const defaultPeriods = [
    ['Period 1','09:00','09:45'],
    ['Period 2','09:50','10:35'],
    ['Period 3','10:40','11:25'],
    ['Period 4','11:30','12:15'],
    ['Period 5','12:45','13:30'],
    ['Period 6','13:35','14:20']
  ];
  for (const [name, st, et] of defaultPeriods) {
    await run(`INSERT OR IGNORE INTO periods (class_id, name, start_time, end_time) VALUES (?,?,?,?)`, [klass.id, name, st, et]);
  }
}

async function ensureDefaultTeacher(email, password) {
  if (!email || !password) return;
  const existing = await all(`SELECT * FROM teachers WHERE email = ?`, [email]);
  let teacherId;
  if (existing.length === 0) {
    const hash = await bcrypt.hash(password, 10);
    await run(`INSERT INTO teachers (name, email, password_hash) VALUES (?,?,?)`, [
      'Teacher', email, hash
    ]);
    const t = (await all(`SELECT * FROM teachers WHERE email = ?`, [email]))[0];
    teacherId = t.id;
  } else {
    teacherId = existing[0].id;
    const hash = await bcrypt.hash(password, 10);
    await run(`UPDATE teachers SET password_hash = ? WHERE id = ?`, [hash, teacherId]);
  }

  const classCount = await all(`SELECT COUNT(*) as c FROM classes WHERE teacher_id = ?`, [teacherId]);
  if (classCount[0].c === 0) {
    await run(`INSERT INTO classes (name, section, teacher_id) VALUES (?,?,?)`, ['Class 8', 'A', teacherId]);
    const klass = (await all(`SELECT * FROM classes WHERE teacher_id = ?`, [teacherId]))[0];
    await run(`INSERT INTO students (name, roll_no, class_id) VALUES (?,?,?)`, ['Student One','1', klass.id]);
    await run(`INSERT INTO students (name, roll_no, class_id) VALUES (?,?,?)`, ['Student Two','2', klass.id]);
    const defaultPeriods = [
      ['Period 1','09:00','09:45'],
      ['Period 2','09:50','10:35'],
      ['Period 3','10:40','11:25'],
      ['Period 4','11:30','12:15'],
      ['Period 5','12:45','13:30'],
      ['Period 6','13:35','14:20']
    ];
    for (const [name, st, et] of defaultPeriods) {
      await run(`INSERT OR IGNORE INTO periods (class_id, name, start_time, end_time) VALUES (?,?,?,?)`, [klass.id, name, st, et]);
    }
  }
}

const cmd = process.argv[2];
if (cmd === 'init') {
  migrate().then(() => { console.log('DB migrated'); db.close(); }).catch(e => { console.error(e); db.close(); process.exit(1); });
} else if (cmd === 'seed') {
  migrate().then(seed).then(() => { console.log('DB seeded'); db.close(); }).catch(e => { console.error(e); db.close(); process.exit(1); });
}

export { db, migrate, seed, all, run, dbPath, ensureDefaultTeacher };
