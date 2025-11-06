import express from 'express';
import { getDB } from '../db.js';
import multer from 'multer';
import csv from 'csv-parser';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

// Student Management Dashboard
router.get('/manage/students', requireAuth, async (req, res) => {
  try {
    const db = getDB();
    const teacherId = req.session.user.id;
    const { class_id, status, search } = req.query;

    // Get all classes for filter
    const classes = await db.all(`
      SELECT * FROM classes WHERE teacher_id = ? ORDER BY name
    `, [teacherId]);

    // Build query for students
    let query = `
      SELECT s.*, c.name as class_name, c.section,
             COUNT(a.id) as total_attendance,
             COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count,
             ROUND(
               (COUNT(CASE WHEN a.status = 'present' THEN 1 END) * 100.0 / 
                NULLIF(COUNT(a.id), 0)), 2
             ) as attendance_percentage
      FROM students s
      JOIN classes c ON s.class_id = c.id
      LEFT JOIN attendance a ON s.id = a.student_id
      WHERE c.teacher_id = ?
    `;
    let params = [teacherId];

    if (class_id) {
      query += ' AND s.class_id = ?';
      params.push(class_id);
    }

    if (status) {
      query += ' AND s.enrollment_status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (s.name LIKE ? OR s.roll_number LIKE ? OR s.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' GROUP BY s.id ORDER BY c.name, s.roll_number, s.name';

    const students = await db.all(query, params);

    res.render('student-management/dashboard', {
      title: 'Student Management',
      students,
      classes,
      filters: { class_id, status, search },
      currentPage: 'manage'
    });
  } catch (error) {
    console.error('Error loading student management:', error);
    req.session.flash = { message: 'Error loading student management' };
    res.redirect('/dashboard');
  }
});

// Add New Student Form
router.get('/manage/students/new', requireAuth, async (req, res) => {
  try {
    const db = getDB();
    const teacherId = req.session.user.id;

    const classes = await db.all(`
      SELECT * FROM classes WHERE teacher_id = ? ORDER BY name
    `, [teacherId]);

    res.render('student-management/form', {
      title: 'Add New Student',
      student: null,
      classes,
      isEdit: false,
      currentPage: 'manage'
    });
  } catch (error) {
    console.error('Error loading add student form:', error);
    req.session.flash = { message: 'Error loading form' };
    res.redirect('/manage/students');
  }
});

// Edit Student Form
router.get('/manage/students/:id/edit', requireAuth, async (req, res) => {
  try {
    const db = getDB();
    const studentId = req.params.id;
    const teacherId = req.session.user.id;

    const student = await db.get(`
      SELECT s.*, c.teacher_id
      FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE s.id = ? AND c.teacher_id = ?
    `, [studentId, teacherId]);

    if (!student) {
      req.session.flash = { message: 'Student not found' };
      return res.redirect('/manage/students');
    }

    const classes = await db.all(`
      SELECT * FROM classes WHERE teacher_id = ? ORDER BY name
    `, [teacherId]);

    res.render('student-management/form', {
      title: 'Edit Student',
      student,
      classes,
      isEdit: true,
      currentPage: 'manage'
    });
  } catch (error) {
    console.error('Error loading edit student form:', error);
    req.session.flash = { message: 'Error loading student data' };
    res.redirect('/manage/students');
  }
});

// Save Student (Create/Update)
router.post('/manage/students/save', requireAuth, async (req, res) => {
  try {
    const db = getDB();
    const teacherId = req.session.user.id;
    const {
      id,
      name,
      roll_number,
      email,
      phone,
      parent_email,
      parent_phone,
      class_id,
      enrollment_status,
      notes
    } = req.body;

    // Validate class belongs to teacher
    const classInfo = await db.get(`
      SELECT * FROM classes WHERE id = ? AND teacher_id = ?
    `, [class_id, teacherId]);

    if (!classInfo) {
      req.session.flash = { message: 'Invalid class selection' };
      return res.redirect('/manage/students');
    }

    // Check for duplicate roll number in the same class
    let duplicateQuery = `
      SELECT id FROM students WHERE class_id = ? AND roll_number = ?
    `;
    let duplicateParams = [class_id, roll_number];

    if (id) {
      duplicateQuery += ' AND id != ?';
      duplicateParams.push(id);
    }

    const duplicate = await db.get(duplicateQuery, duplicateParams);
    if (duplicate) {
      req.session.flash = { message: 'Roll number already exists in this class' };
      return res.redirect(id ? `/manage/students/${id}/edit` : '/manage/students/new');
    }

    if (id) {
      // Update existing student
      await db.run(`
        UPDATE students 
        SET name = ?, roll_number = ?, email = ?, phone = ?, 
            parent_email = ?, parent_phone = ?, class_id = ?, 
            enrollment_status = ?, notes = ?, updated_at = datetime('now')
        WHERE id = ?
      `, [name, roll_number, email || null, phone || null, 
          parent_email || null, parent_phone || null, class_id, 
          enrollment_status, notes || null, id]);

      req.session.flash = { message: 'Student updated successfully' };
    } else {
      // Create new student
      await db.run(`
        INSERT INTO students (name, roll_number, email, phone, parent_email, 
                            parent_phone, class_id, enrollment_status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [name, roll_number, email || null, phone || null, 
          parent_email || null, parent_phone || null, class_id, 
          enrollment_status, notes || null]);

      req.session.flash = { message: 'Student added successfully' };
    }

    res.redirect('/manage/students');
  } catch (error) {
    console.error('Error saving student:', error);
    req.session.flash = { message: 'Error saving student data' };
    res.redirect('/manage/students');
  }
});

// Delete Student
router.post('/manage/students/:id/delete', requireAuth, async (req, res) => {
  try {
    const db = getDB();
    const studentId = req.params.id;
    const teacherId = req.session.user.id;

    // Verify student belongs to teacher's class
    const student = await db.get(`
      SELECT s.*, c.teacher_id
      FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE s.id = ? AND c.teacher_id = ?
    `, [studentId, teacherId]);

    if (!student) {
      req.session.flash = { message: 'Student not found' };
      return res.redirect('/manage/students');
    }

    await db.run('DELETE FROM students WHERE id = ?', [studentId]);
    req.session.flash = { message: 'Student deleted successfully' };
    res.redirect('/manage/students');
  } catch (error) {
    console.error('Error deleting student:', error);
    req.session.flash = { message: 'Error deleting student' };
    res.redirect('/manage/students');
  }
});

// Bulk Import Students
router.post('/manage/students/import', requireAuth, upload.single('csvFile'), async (req, res) => {
  try {
    const db = getDB();
    const teacherId = req.session.user.id;
    const { class_id } = req.body;

    if (!req.file) {
      req.session.flash = { message: 'Please select a CSV file' };
      return res.redirect('/manage/students');
    }

    // Verify class belongs to teacher
    const classInfo = await db.get(`
      SELECT * FROM classes WHERE id = ? AND teacher_id = ?
    `, [class_id, teacherId]);

    if (!classInfo) {
      req.session.flash = { message: 'Invalid class selection' };
      return res.redirect('/manage/students');
    }

    const students = [];
    const csvData = req.file.buffer.toString();
    
    // Parse CSV
    const rows = csvData.split('\n').map(row => row.split(','));
    const headers = rows[0].map(h => h.trim().toLowerCase());
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < 2 || !row[0].trim()) continue;

      const student = {
        name: row[0]?.trim(),
        roll_number: row[1]?.trim(),
        email: row[2]?.trim() || null,
        phone: row[3]?.trim() || null,
        parent_email: row[4]?.trim() || null,
        parent_phone: row[5]?.trim() || null,
        enrollment_status: row[6]?.trim() || 'active',
        notes: row[7]?.trim() || null
      };

      if (student.name && student.roll_number) {
        students.push(student);
      }
    }

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const student of students) {
      try {
        // Check for duplicate roll number
        const duplicate = await db.get(`
          SELECT id FROM students WHERE class_id = ? AND roll_number = ?
        `, [class_id, student.roll_number]);

        if (duplicate) {
          errors.push(`Roll number ${student.roll_number} already exists`);
          errorCount++;
          continue;
        }

        await db.run(`
          INSERT INTO students (name, roll_number, email, phone, parent_email, 
                              parent_phone, class_id, enrollment_status, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [student.name, student.roll_number, student.email, student.phone,
            student.parent_email, student.parent_phone, class_id,
            student.enrollment_status, student.notes]);

        successCount++;
      } catch (error) {
        errors.push(`Error importing ${student.name}: ${error.message}`);
        errorCount++;
      }
    }

    req.session.flash = { 
      message: `Import completed: ${successCount} successful, ${errorCount} failed` 
    };
    res.redirect('/manage/students');
  } catch (error) {
    console.error('Error importing students:', error);
    req.session.flash = { message: 'Error importing students' };
    res.redirect('/manage/students');
  }
});

// Export Students
router.get('/manage/students/export', requireAuth, async (req, res) => {
  try {
    const db = getDB();
    const teacherId = req.session.user.id;
    const { class_id, format = 'csv' } = req.query;

    let query = `
      SELECT s.*, c.name as class_name, c.section
      FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE c.teacher_id = ?
    `;
    let params = [teacherId];

    if (class_id) {
      query += ' AND s.class_id = ?';
      params.push(class_id);
    }

    query += ' ORDER BY c.name, s.roll_number, s.name';

    const students = await db.all(query, params);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="students.csv"');
      
      const headers = ['Name', 'Roll Number', 'Email', 'Phone', 'Parent Email', 'Parent Phone', 'Class', 'Section', 'Status', 'Notes'];
      res.write(headers.join(',') + '\n');
      
      students.forEach(student => {
        const row = [
          student.name,
          student.roll_number,
          student.email || '',
          student.phone || '',
          student.parent_email || '',
          student.parent_phone || '',
          student.class_name,
          student.section || '',
          student.enrollment_status,
          student.notes || ''
        ].map(field => `"${String(field).replace(/"/g, '""')}"`);
        
        res.write(row.join(',') + '\n');
      });
      
      res.end();
    } else {
      res.json(students);
    }
  } catch (error) {
    console.error('Error exporting students:', error);
    res.status(500).json({ error: 'Error exporting students' });
  }
});

// Quick Attendance for Student Management
router.post('/manage/students/quick-attendance', requireAuth, async (req, res) => {
  try {
    const db = getDB();
    const teacherId = req.session.user.id;
    const { class_id, date, attendance } = req.body;

    // Verify class belongs to teacher
    const classInfo = await db.get(`
      SELECT * FROM classes WHERE id = ? AND teacher_id = ?
    `, [class_id, teacherId]);

    if (!classInfo) {
      return res.status(403).json({ error: 'Unauthorized access to class' });
    }

    // Save attendance records
    for (const record of attendance) {
      await db.run(`
        INSERT OR REPLACE INTO attendance 
        (student_id, class_id, date, status, session_time, marked_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [record.student_id, class_id, date, record.status, '09:00', teacherId]);
    }

    res.json({ success: true, message: 'Quick attendance saved' });
  } catch (error) {
    console.error('Error saving quick attendance:', error);
    res.status(500).json({ error: 'Error saving attendance' });
  }
});

export default router;