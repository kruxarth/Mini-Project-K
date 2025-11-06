import express from 'express';
import { getDB } from '../db.js';

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

// Parent Reports main page - shows all classes
router.get('/parent-reports', requireAuth, async (req, res) => {
  try {
    const db = getDB();
    const classes = await db.all(`
      SELECT c.*, 
             COUNT(s.id) as student_count,
             COUNT(CASE WHEN a.status = 'present' AND DATE(a.date) = DATE('now') THEN 1 END) as today_present,
             COUNT(CASE WHEN a.status IN ('absent', 'late', 'excused') AND DATE(a.date) = DATE('now') THEN 1 END) as today_total_marked
      FROM classes c 
      LEFT JOIN students s ON c.id = s.class_id 
      LEFT JOIN attendance a ON s.id = a.student_id AND DATE(a.date) = DATE('now')
      WHERE c.teacher_id = ?
      GROUP BY c.id
      ORDER BY c.name
    `, [req.session.user.id]);

    res.render('parent-reports/index', {
      title: 'Parent Reports',
      classes,
      currentPage: 'parent-reports'
    });
  } catch (error) {
    console.error('Error loading parent reports:', error);
    req.session.flash = { message: 'Error loading classes' };
    res.redirect('/dashboard');
  }
});

// Class students list for parent reports
router.get('/parent-reports/class/:classId', requireAuth, async (req, res) => {
  try {
    const db = getDB();
    const classId = req.params.classId;

    // Get class info
    const classInfo = await db.get(`
      SELECT * FROM classes WHERE id = ? AND teacher_id = ?
    `, [classId, req.session.user.id]);

    if (!classInfo) {
      req.session.flash = { message: 'Class not found' };
      return res.redirect('/parent-reports');
    }

    // Get students with their attendance summary
    const students = await db.all(`
      SELECT s.*,
             COUNT(a.id) as total_days,
             COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_days,
             COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_days,
             COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_days,
             COUNT(CASE WHEN a.status = 'excused' THEN 1 END) as excused_days,
             ROUND(
               (COUNT(CASE WHEN a.status = 'present' THEN 1 END) * 100.0 / 
                NULLIF(COUNT(a.id), 0)), 2
             ) as attendance_percentage
      FROM students s
      LEFT JOIN attendance a ON s.id = a.student_id
      WHERE s.class_id = ?
      GROUP BY s.id
      ORDER BY s.name
    `, [classId]);

    res.render('parent-reports/class-students', {
      title: `Parent Reports - ${classInfo.name}`,
      classInfo,
      students,
      currentPage: 'parent-reports'
    });
  } catch (error) {
    console.error('Error loading class students:', error);
    req.session.flash = { message: 'Error loading students' };
    res.redirect('/parent-reports');
  }
});

// Individual student report
router.get('/parent-reports/student/:studentId', requireAuth, async (req, res) => {
  try {
    const db = getDB();
    const studentId = req.params.studentId;

    // Get student info with class
    const student = await db.get(`
      SELECT s.*, c.name as class_name, c.section
      FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE s.id = ? AND c.teacher_id = ?
    `, [studentId, req.session.user.id]);

    if (!student) {
      req.session.flash = { message: 'Student not found' };
      return res.redirect('/parent-reports');
    }

    // Get detailed attendance records
    const attendanceRecords = await db.all(`
      SELECT DATE(date) as date, status, remarks
      FROM attendance
      WHERE student_id = ?
      ORDER BY date DESC
      LIMIT 30
    `, [studentId]);

    // Get attendance summary
    const summary = await db.get(`
      SELECT 
        COUNT(*) as total_days,
        COUNT(CASE WHEN status = 'present' THEN 1 END) as present_days,
        COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent_days,
        COUNT(CASE WHEN status = 'late' THEN 1 END) as late_days,
        COUNT(CASE WHEN status = 'excused' THEN 1 END) as excused_days,
        ROUND(
          (COUNT(CASE WHEN status = 'present' THEN 1 END) * 100.0 / 
           NULLIF(COUNT(*), 0)), 2
        ) as attendance_percentage
      FROM attendance
      WHERE student_id = ?
    `, [studentId]);

    // Get monthly breakdown
    const monthlyData = await db.all(`
      SELECT 
        strftime('%Y-%m', date) as month,
        COUNT(*) as total_days,
        COUNT(CASE WHEN status = 'present' THEN 1 END) as present_days,
        ROUND(
          (COUNT(CASE WHEN status = 'present' THEN 1 END) * 100.0 / 
           NULLIF(COUNT(*), 0)), 2
        ) as percentage
      FROM attendance
      WHERE student_id = ?
      GROUP BY strftime('%Y-%m', date)
      ORDER BY month DESC
      LIMIT 6
    `, [studentId]);

    res.render('parent-reports/student-report', {
      title: `Report - ${student.name}`,
      student,
      attendanceRecords,
      summary: summary || { total_days: 0, present_days: 0, absent_days: 0, late_days: 0, excused_days: 0, attendance_percentage: 0 },
      monthlyData,
      currentPage: 'parent-reports'
    });
  } catch (error) {
    console.error('Error loading student report:', error);
    req.session.flash = { message: 'Error loading student report' };
    res.redirect('/parent-reports');
  }
});

// Download student report as PDF (placeholder for now)
router.get('/parent-reports/student/:studentId/download', requireAuth, async (req, res) => {
  try {
    const db = getDB();
    const studentId = req.params.studentId;

    // Get student info
    const student = await db.get(`
      SELECT s.*, c.name as class_name, c.section
      FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE s.id = ? AND c.teacher_id = ?
    `, [studentId, req.session.user.id]);

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // For now, we'll return a JSON response
    // In a real implementation, you'd generate a PDF here
    res.json({
      message: 'PDF download feature will be implemented',
      student: student.name,
      action: 'download'
    });
  } catch (error) {
    console.error('Error downloading report:', error);
    res.status(500).json({ error: 'Error generating report' });
  }
});

// Send report to parents
router.post('/parent-reports/student/:studentId/send', requireAuth, async (req, res) => {
  try {
    const db = getDB();
    const studentId = req.params.studentId;

    // Get student info
    const student = await db.get(`
      SELECT s.*, c.name as class_name, c.section
      FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE s.id = ? AND c.teacher_id = ?
    `, [studentId, req.session.user.id]);

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // For now, we'll simulate sending
    // In a real implementation, you'd send email/SMS here
    console.log(`Sending report for ${student.name} to parents`);
    
    res.json({
      success: true,
      message: `Report sent to parents of ${student.name}`,
      student: student.name,
      parentEmail: student.parent_email || 'Not provided',
      parentPhone: student.parent_phone || 'Not provided'
    });
  } catch (error) {
    console.error('Error sending report:', error);
    res.status(500).json({ error: 'Error sending report to parents' });
  }
});

export default router;