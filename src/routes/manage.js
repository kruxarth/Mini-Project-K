import express from 'express';
import { all, run } from '../db.js';

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

// Add Class
router.get('/manage/class/new', requireAuth, (req, res) => {
  res.render('manage_class_new', { error: null });
});

router.post('/manage/class/new', requireAuth, async (req, res) => {
  const { 
    name, section, department, semester, academic_year, teacher_id, subject, description,
    num_students, attendance_type, min_attendance, auto_notifications, 
    notification_email, notification_sms 
  } = req.body;
  
  try {
    // Validation
    if (!name) return res.render('manage_class_new', { error: 'Class name is required' });
    if (!department) return res.render('manage_class_new', { error: 'Department is required' });
    if (!semester) return res.render('manage_class_new', { error: 'Semester/Year is required' });
    if (!academic_year) return res.render('manage_class_new', { error: 'Academic year is required' });
    if (!attendance_type) return res.render('manage_class_new', { error: 'Attendance type is required' });
    
    // Check for duplicate class name in the same academic year
    const existing = await all(`SELECT id FROM classes WHERE name = ? AND academic_year = ?`, [name, academic_year]);
    if (existing.length > 0) {
      return res.render('manage_class_new', { 
        error: 'A class with this name already exists in the selected academic year' 
      });
    }
    
    // Create class with all fields
    await run(`
      INSERT INTO classes (
        name, section, teacher_id, department, semester, academic_year, subject, description,
        num_students, attendance_type, min_attendance, auto_notifications, 
        notification_email, notification_sms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name, 
      section || null, 
      teacher_id || req.session.user.id, 
      department, 
      semester, 
      academic_year, 
      subject || null, 
      description || null,
      num_students ? parseInt(num_students) : null,
      attendance_type || 'period-wise',
      min_attendance ? parseInt(min_attendance) : 75,
      auto_notifications ? 1 : 0,
      notification_email ? 1 : 0,
      notification_sms ? 1 : 0
    ]);
    
    req.session.flash = { type: 'success', message: 'Class created successfully with all configurations' };
    res.redirect('/dashboard');
    
  } catch (error) {
    console.error('Class creation error:', error);
    res.render('manage_class_new', { error: 'Failed to create class. Please try again.' });
  }
});

// Add Student to class
router.get('/class/:id/student/new', requireAuth, async (req, res) => {
  const classId = parseInt(req.params.id, 10);
  const klass = (await all(`SELECT * FROM classes WHERE id = ? AND teacher_id = ?`, [classId, req.session.user.id]))[0];
  if (!klass) return res.status(404).send('Not found');
  res.render('manage_student_new', { klass, error: null });
});

router.post('/class/:id/student/new', requireAuth, async (req, res) => {
  const classId = parseInt(req.params.id, 10);
  const klass = (await all(`SELECT * FROM classes WHERE id = ? AND teacher_id = ?`, [classId, req.session.user.id]))[0];
  if (!klass) return res.status(404).send('Not found');
  const { name, roll_no, guardian_name, guardian_email, guardian_phone } = req.body;
  if (!name) return res.render('manage_student_new', { klass, error: 'Student name is required' });
  await run(`INSERT INTO students (name, roll_no, class_id) VALUES (?,?,?)`, [name, roll_no || null, classId]);
  const s = (await all(`SELECT * FROM students WHERE class_id = ? ORDER BY id DESC LIMIT 1`, [classId]))[0];
  await run(`INSERT INTO guardians (name, email, phone, preferred_channel, student_id) VALUES (?,?,?,?,?)`, [
    guardian_name || null, guardian_email || null, guardian_phone || null, 'email', s.id
  ]);
  req.session.flash = { type: 'success', message: 'Student added' };
  res.redirect('/dashboard');
});

// Manage periods (list/add/edit)
router.get('/class/:id/periods/manage', requireAuth, async (req, res) => {
  const classId = parseInt(req.params.id, 10);
  const klass = (await all(`SELECT * FROM classes WHERE id = ? AND teacher_id = ?`, [classId, req.session.user.id]))[0];
  if (!klass) return res.status(404).send('Not found');
  const periods = await all(`SELECT * FROM periods WHERE class_id = ? ORDER BY id ASC`, [classId]);
  res.render('manage_periods', { klass, periods, error: null });
});

router.post('/class/:id/periods/add', requireAuth, async (req, res) => {
  const classId = parseInt(req.params.id, 10);
  const klass = (await all(`SELECT * FROM classes WHERE id = ? AND teacher_id = ?`, [classId, req.session.user.id]))[0];
  if (!klass) return res.status(404).send('Not found');
  const { name, start_time, end_time } = req.body;
  if (!name) {
    const periods = await all(`SELECT * FROM periods WHERE class_id = ? ORDER BY id ASC`, [classId]);
    return res.render('manage_periods', { klass, periods, error: 'Period name is required' });
  }
  await run(`INSERT OR IGNORE INTO periods (class_id, name, start_time, end_time) VALUES (?,?,?,?)`, [classId, name, start_time || null, end_time || null]);
  req.session.flash = { type: 'success', message: 'Period added' };
  res.redirect(`/class/${classId}/periods/manage`);
});

router.post('/class/:id/periods/:pid/edit', requireAuth, async (req, res) => {
  const classId = parseInt(req.params.id, 10);
  const pid = parseInt(req.params.pid, 10);
  const klass = (await all(`SELECT * FROM classes WHERE id = ? AND teacher_id = ?`, [classId, req.session.user.id]))[0];
  if (!klass) return res.status(404).send('Not found');
  const { name, start_time, end_time } = req.body;
  await run(`UPDATE periods SET name = ?, start_time = ?, end_time = ? WHERE id = ? AND class_id = ?`, [name || null, start_time || null, end_time || null, pid, classId]);
  req.session.flash = { type: 'success', message: 'Period updated' };
  res.redirect(`/class/${classId}/periods/manage`);
});

export default router;
 
// Enhanced Student Management
router.get('/class/:id/students/manage', requireAuth, async (req, res) => {
  const classId = parseInt(req.params.id, 10);
  const klass = (await all(`SELECT * FROM classes WHERE id = ? AND teacher_id = ?`, [classId, req.session.user.id]))[0];
  if (!klass) return res.status(404).send('Not found');
  
  const students = await all(`
    SELECT s.*, 
           g.id as guardian_id, 
           g.name as guardian_name, 
           g.email as guardian_email, 
           g.phone as guardian_phone,
           COUNT(a.id) as total_days,
           SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_days,
           ROUND(
             (SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) * 100.0 / 
              NULLIF(COUNT(a.id), 0)), 1
           ) as attendance_percentage
    FROM students s
    LEFT JOIN guardians g ON g.student_id = s.id
    LEFT JOIN attendance a ON a.student_id = s.id
    WHERE s.class_id = ?
    GROUP BY s.id
    ORDER BY CAST(s.roll_no AS INT)
  `, [classId]);
  
  res.render('student-management', { klass, students });
});

// API endpoint for student data (for AJAX operations)
router.get('/api/class/:id/students/:sid', requireAuth, async (req, res) => {
  const classId = parseInt(req.params.id, 10);
  const studentId = parseInt(req.params.sid, 10);
  
  const klass = (await all(`SELECT * FROM classes WHERE id = ? AND teacher_id = ?`, [classId, req.session.user.id]))[0];
  if (!klass) return res.status(404).json({ error: 'Class not found' });
  
  const student = (await all(`
    SELECT s.*, g.name as guardian_name, g.email as guardian_email, g.phone as guardian_phone
    FROM students s
    LEFT JOIN guardians g ON g.student_id = s.id
    WHERE s.id = ? AND s.class_id = ?
  `, [studentId, classId]))[0];
  
  if (!student) return res.status(404).json({ error: 'Student not found' });
  
  res.json(student);
});

// Add/Update student with comprehensive fields
router.post('/class/:id/students/save', requireAuth, async (req, res) => {
  const classId = parseInt(req.params.id, 10);
  const klass = (await all(`SELECT * FROM classes WHERE id = ? AND teacher_id = ?`, [classId, req.session.user.id]))[0];
  if (!klass) return res.status(404).json({ error: 'Class not found' });
  
  const {
    student_id, name, roll_no, email, phone, date_of_birth, enrollment_status,
    academic_year, branch, address, emergency_contact, emergency_phone, notes,
    guardian_name, guardian_email, guardian_phone
  } = req.body;
  
  try {
    let studentId;
    
    if (student_id) {
      // Update existing student
      await run(`
        UPDATE students SET 
          name = ?, roll_no = ?, email = ?, phone = ?, date_of_birth = ?,
          enrollment_status = ?, academic_year = ?, branch = ?, address = ?, 
          emergency_contact = ?, emergency_phone = ?, notes = ?, updated_at = datetime('now')
        WHERE id = ? AND class_id = ?
      `, [
        name, roll_no || null, email || null, phone || null, date_of_birth || null,
        enrollment_status || 'active', academic_year || null, branch || null, 
        address || null, emergency_contact || null, emergency_phone || null, 
        notes || null, student_id, classId
      ]);
      studentId = student_id;
    } else {
      // Create new student
      const result = await run(`
        INSERT INTO students (
          name, roll_no, email, phone, date_of_birth, enrollment_status,
          academic_year, branch, address, emergency_contact, emergency_phone, notes, class_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        name, roll_no || null, email || null, phone || null, date_of_birth || null,
        enrollment_status || 'active', academic_year || null, branch || null,
        address || null, emergency_contact || null, emergency_phone || null, 
        notes || null, classId
      ]);
      studentId = result.lastID;
    }
    
    // Handle guardian information
    const existingGuardian = await all(`SELECT * FROM guardians WHERE student_id = ?`, [studentId]);
    
    if (guardian_name || guardian_email || guardian_phone) {
      if (existingGuardian.length > 0) {
        await run(`
          UPDATE guardians SET name = ?, email = ?, phone = ? WHERE student_id = ?
        `, [guardian_name || null, guardian_email || null, guardian_phone || null, studentId]);
      } else {
        await run(`
          INSERT INTO guardians (name, email, phone, preferred_channel, student_id)
          VALUES (?, ?, ?, 'email', ?)
        `, [guardian_name || null, guardian_email || null, guardian_phone || null, studentId]);
      }
    }
    
    res.json({ success: true, message: student_id ? 'Student updated successfully' : 'Student added successfully' });
    
  } catch (error) {
    console.error('Student save error:', error);
    res.status(500).json({ error: 'Failed to save student' });
  }
});

// Export students data
router.get('/class/:id/students/export', requireAuth, async (req, res) => {
  const classId = parseInt(req.params.id, 10);
  const klass = (await all(`SELECT * FROM classes WHERE id = ? AND teacher_id = ?`, [classId, req.session.user.id]))[0];
  if (!klass) return res.status(404).send('Class not found');
  
  const students = await all(`
    SELECT s.*, g.name as guardian_name, g.email as guardian_email, g.phone as guardian_phone
    FROM students s
    LEFT JOIN guardians g ON g.student_id = s.id
    WHERE s.class_id = ?
    ORDER BY CAST(s.roll_no AS INT)
  `, [classId]);
  
  // Generate CSV
  const csvHeader = 'Name,Roll No,Email,Phone,Date of Birth,Status,Address,Emergency Contact,Emergency Phone,Guardian Name,Guardian Email,Guardian Phone,Notes\n';
  const csvRows = students.map(s => [
    s.name || '',
    s.roll_no || '',
    s.email || '',
    s.phone || '',
    s.date_of_birth || '',
    s.enrollment_status || 'active',
    s.address || '',
    s.emergency_contact || '',
    s.emergency_phone || '',
    s.guardian_name || '',
    s.guardian_email || '',
    s.guardian_phone || '',
    s.notes || ''
  ].map(field => `"${field}"`).join(',')).join('\n');
  
  const csv = csvHeader + csvRows;
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${klass.name}_students.csv"`);
  res.send(csv);
});

router.post('/class/:id/students/:sid/edit', requireAuth, async (req, res) => {
  const classId = parseInt(req.params.id, 10);
  const sid = parseInt(req.params.sid, 10);
  const klass = (await all(`SELECT * FROM classes WHERE id = ? AND teacher_id = ?`, [classId, req.session.user.id]))[0];
  if (!klass) return res.status(404).send('Not found');
  const { name, roll_no, guardian_name, guardian_email, guardian_phone } = req.body;
  await run(`UPDATE students SET name = ?, roll_no = ? WHERE id = ? AND class_id = ?`, [name || null, roll_no || null, sid, classId]);
  const existing = await all(`SELECT * FROM guardians WHERE student_id = ? LIMIT 1`, [sid]);
  if (existing.length === 0) {
    if (guardian_name || guardian_email || guardian_phone) {
      await run(`INSERT INTO guardians (name, email, phone, preferred_channel, student_id) VALUES (?,?,?,?,?)`, [
        guardian_name || null, guardian_email || null, guardian_phone || null, 'email', sid
      ]);
    }
  } else {
    await run(`UPDATE guardians SET name = ?, email = ?, phone = ? WHERE student_id = ?`, [
      guardian_name || null, guardian_email || null, guardian_phone || null, sid
    ]);
  }
  req.session.flash = { type: 'success', message: 'Student updated' };
  res.redirect(`/class/${classId}/students/manage`);
});

router.post('/class/:id/students/:sid/delete', requireAuth, async (req, res) => {
  const classId = parseInt(req.params.id, 10);
  const sid = parseInt(req.params.sid, 10);
  const klass = (await all(`SELECT * FROM classes WHERE id = ? AND teacher_id = ?`, [classId, req.session.user.id]))[0];
  if (!klass) return res.status(404).send('Not found');
  await run(`DELETE FROM students WHERE id = ? AND class_id = ?`, [sid, classId]);
  req.session.flash = { type: 'success', message: 'Student deleted' };
  res.redirect(`/class/${classId}/students/manage`);
});
