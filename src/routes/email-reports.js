import express from 'express';
import nodemailer from 'nodemailer';
import { all, run } from '../db.js';

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

// Configure email transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// Parent reports dashboard - restructured from weekly reports
router.get('/parent-reports', requireAuth, async (req, res) => {
  const teacherId = req.session.user.id;
  
  // Get all classes for this teacher
  const classes = await all(`
    SELECT c.*, COUNT(s.id) as student_count
    FROM classes c 
    LEFT JOIN students s ON c.id = s.class_id 
    WHERE c.teacher_id = ? 
    GROUP BY c.id
    ORDER BY c.name
  `, [teacherId]);

  // Get recent email reports
  const recentReports = await all(`
    SELECT 
      er.*,
      c.name as class_name,
      s.name as student_name,
      s.roll_no
    FROM email_reports er
    JOIN classes c ON er.class_id = c.id
    JOIN students s ON er.student_id = s.id
    WHERE c.teacher_id = ?
    ORDER BY er.sent_at DESC
    LIMIT 20
  `, [teacherId]);

  res.render('parent-reports', {
    classes,
    recentReports,
    pageTitle: 'Parent Reports'
  });
});

// Individual student report view
router.get('/parent-reports/student/:id', requireAuth, async (req, res) => {
  const studentId = parseInt(req.params.id);
  const teacherId = req.session.user.id;

  try {
    // Get student details with parent info
    const student = await all(`
      SELECT 
        s.*,
        c.name as class_name,
        c.section,
        g.name as parent_name,
        g.email as parent_email,
        g.phone as parent_phone
      FROM students s
      JOIN classes c ON s.class_id = c.id
      LEFT JOIN guardians g ON s.id = g.student_id
      WHERE s.id = ? AND c.teacher_id = ?
    `, [studentId, teacherId]);

    if (student.length === 0) {
      return res.status(404).render('error', { 
        message: 'Student not found or access denied',
        pageTitle: 'Error'
      });
    }

    // Get attendance history for last 30 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);

    const attendanceHistory = await all(`
      SELECT date, status, note
      FROM attendance
      WHERE student_id = ? AND date >= ? AND date <= ?
      ORDER BY date DESC
    `, [studentId, startDate.toISOString().slice(0, 10), endDate.toISOString().slice(0, 10)]);

    // Get attendance statistics
    const stats = await all(`
      SELECT 
        COUNT(*) as total_days,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_days,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_days,
        SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_days,
        SUM(CASE WHEN status = 'excused' THEN 1 ELSE 0 END) as excused_days
      FROM attendance
      WHERE student_id = ? AND date >= ? AND date <= ?
    `, [studentId, startDate.toISOString().slice(0, 10), endDate.toISOString().slice(0, 10)]);

    // Get email report history for this student
    const emailHistory = await all(`
      SELECT *
      FROM email_reports
      WHERE student_id = ?
      ORDER BY sent_at DESC
      LIMIT 10
    `, [studentId]);

    res.render('student-report', {
      student: student[0],
      attendanceHistory,
      stats: stats[0],
      emailHistory,
      pageTitle: `${student[0].name} - Individual Report`
    });

  } catch (error) {
    console.error('Error fetching student report:', error);
    res.status(500).render('error', { 
      message: 'Error loading student report',
      pageTitle: 'Error'
    });
  }
});

// Send individual student report to parent
router.post('/parent-reports/student/:id/send', requireAuth, async (req, res) => {
  const studentId = parseInt(req.params.id);
  const teacherId = req.session.user.id;

  try {
    // Verify teacher has access to this student
    const student = await all(`
      SELECT s.*, c.id as class_id
      FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE s.id = ? AND c.teacher_id = ?
    `, [studentId, teacherId]);

    if (student.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Generate individual report
    const result = await generateIndividualReport(studentId, student[0].class_id);
    
    res.json({
      success: true,
      message: result.sent > 0 ? 'Report sent successfully' : 'No parent email found',
      details: result
    });

  } catch (error) {
    console.error('Error sending individual report:', error);
    res.status(500).json({ 
      error: 'Failed to send report',
      message: error.message 
    });
  }
});

// Weekly reports page (backward compatibility)
router.get('/weekly-reports', requireAuth, async (req, res) => {
  const teacherId = req.session.user.id;
  
  try {
    // Get all classes for this teacher
    const classes = await all(`
      SELECT c.*, COUNT(s.id) as student_count
      FROM classes c 
      LEFT JOIN students s ON c.id = s.class_id 
      WHERE c.teacher_id = ? 
      GROUP BY c.id
      ORDER BY c.name
    `, [teacherId]);

    // Get recent email reports
    const recentReports = await all(`
      SELECT 
        er.*,
        c.name as class_name,
        s.name as student_name,
        s.roll_no
      FROM email_reports er
      JOIN classes c ON er.class_id = c.id
      JOIN students s ON er.student_id = s.id
      WHERE c.teacher_id = ?
      ORDER BY er.sent_at DESC
      LIMIT 20
    `, [teacherId]);

    res.render('weekly-reports', {
      classes,
      recentReports,
      pageTitle: 'Weekly Reports'
    });
  } catch (error) {
    console.error('Error loading weekly reports:', error);
    req.session.flash = { message: 'Error loading weekly reports' };
    res.redirect('/dashboard');
  }
});

// Enhanced weekly report view
router.get('/enhanced-weekly-report/:id', requireAuth, async (req, res) => {
  const classId = parseInt(req.params.id);
  const teacherId = req.session.user.id;
  
  try {
    // Get class information
    const classInfo = await all(`
      SELECT c.*, t.name as teacher_name 
      FROM classes c 
      JOIN teachers t ON c.teacher_id = t.id 
      WHERE c.id = ? AND c.teacher_id = ?
    `, [classId, teacherId]);
    
    if (classInfo.length === 0) {
      return res.status(404).send('Class not found');
    }
    
    // Get week dates
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7);
    
    // Get student attendance data for the week
    const students = await all(`
      SELECT 
        s.id, s.name, s.roll_no,
        COUNT(DISTINCT a.date) as total_classes,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count,
        COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_count,
        ROUND(
          (COUNT(CASE WHEN a.status = 'present' THEN 1 END) * 100.0) / 
          NULLIF(COUNT(DISTINCT a.date), 0), 1
        ) as attendance_percentage,
        g.email as parent_email, g.phone as parent_phone
      FROM students s
      LEFT JOIN attendance a ON s.id = a.student_id 
        AND a.date BETWEEN ? AND ?
      LEFT JOIN guardians g ON s.id = g.student_id
      WHERE s.class_id = ?
      GROUP BY s.id, s.name, s.roll_no
      ORDER BY s.roll_no
    `, [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0], classId]);
    
    res.render('enhanced-weekly-report', {
      classInfo: classInfo[0],
      students,
      weekStart: startDate.toLocaleDateString(),
      weekEnd: endDate.toLocaleDateString(),
      pageTitle: 'Enhanced Weekly Report'
    });
    
  } catch (error) {
    console.error('Enhanced weekly report error:', error);
    res.status(500).send('Error generating report');
  }
});

// Generate and send weekly reports for a class
router.post('/class/:id/send-weekly-reports', requireAuth, async (req, res) => {
  const classId = parseInt(req.params.id);
  const teacherId = req.session.user.id;

  try {
    // Verify teacher owns this class
    const classInfo = await all(`
      SELECT * FROM classes WHERE id = ? AND teacher_id = ?
    `, [classId, teacherId]);
    
    if (classInfo.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Generate weekly reports
    const result = await generateWeeklyReports(classId);
    
    res.json({
      success: true,
      message: `Weekly reports sent to ${result.sent} parents`,
      details: result
    });

  } catch (error) {
    console.error('Error sending weekly reports:', error);
    res.status(500).json({ 
      error: 'Failed to send weekly reports',
      message: error.message 
    });
  }
});

// Send weekly reports for all classes
router.post('/send-all-weekly-reports', requireAuth, async (req, res) => {
  const teacherId = req.session.user.id;

  try {
    const classes = await all(`
      SELECT id FROM classes WHERE teacher_id = ?
    `, [teacherId]);

    let totalSent = 0;
    let totalErrors = 0;

    for (const cls of classes) {
      try {
        const result = await generateWeeklyReports(cls.id);
        totalSent += result.sent;
        totalErrors += result.errors;
      } catch (error) {
        console.error(`Error sending reports for class ${cls.id}:`, error);
        totalErrors++;
      }
    }

    res.json({
      success: true,
      message: `Weekly reports sent to ${totalSent} parents across ${classes.length} classes`,
      sent: totalSent,
      errors: totalErrors
    });

  } catch (error) {
    console.error('Error sending all weekly reports:', error);
    res.status(500).json({ 
      error: 'Failed to send weekly reports',
      message: error.message 
    });
  }
});

// Generate individual report for a specific student
async function generateIndividualReport(studentId, classId) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 7); // Last 7 days

  const startDateStr = startDate.toISOString().slice(0, 10);
  const endDateStr = endDate.toISOString().slice(0, 10);

  // Get class information
  const classInfo = await all(`
    SELECT * FROM classes WHERE id = ?
  `, [classId]);

  if (classInfo.length === 0) {
    throw new Error('Class not found');
  }

  // Get student with parent information
  const studentData = await all(`
    SELECT 
      s.id,
      s.name,
      s.roll_no,
      g.name as parent_name,
      g.email as parent_email,
      COUNT(a.id) as total_days,
      SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_days,
      SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_days,
      SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late_days,
      SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END) as excused_days
    FROM students s
    LEFT JOIN guardians g ON s.id = g.student_id
    LEFT JOIN attendance a ON s.id = a.student_id 
      AND a.date >= ? AND a.date <= ?
    WHERE s.id = ?
    GROUP BY s.id, s.name, s.roll_no, g.name, g.email
  `, [startDateStr, endDateStr, studentId]);

  if (studentData.length === 0 || !studentData[0].parent_email) {
    return { sent: 0, errors: 1, total: 1, message: 'No parent email found' };
  }

  const student = studentData[0];

  try {
    // Get daily attendance details
    const dailyAttendance = await all(`
      SELECT date, status, note
      FROM attendance
      WHERE student_id = ? AND date >= ? AND date <= ?
      ORDER BY date
    `, [studentId, startDateStr, endDateStr]);

    // Calculate attendance percentage
    const attendanceRate = student.total_days > 0 ? 
      Math.round((student.present_days / student.total_days) * 100) : 0;

    // Generate email content
    const emailContent = generateEmailContent(
      student, 
      classInfo[0], 
      dailyAttendance, 
      attendanceRate,
      startDateStr,
      endDateStr
    );

    // Send email
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      const transporter = createTransporter();
      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'AttendanceMS <no-reply@school.com>',
        to: student.parent_email,
        subject: `Individual Attendance Report - ${student.name} (${classInfo[0].name})`,
        html: emailContent
      });

      // Log successful email
      await logEmailReport(classId, studentId, 'sent', null);
      return { sent: 1, errors: 0, total: 1 };
    } else {
      console.log(`Email would be sent to ${student.parent_email} for ${student.name}`);
      await logEmailReport(classId, studentId, 'simulated', 'SMTP not configured');
      return { sent: 1, errors: 0, total: 1 };
    }

  } catch (error) {
    console.error(`Error sending email to ${student.parent_email}:`, error);
    await logEmailReport(classId, studentId, 'failed', error.message);
    return { sent: 0, errors: 1, total: 1 };
  }
}

// Generate weekly reports for a specific class
async function generateWeeklyReports(classId) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 7); // Last 7 days

  const startDateStr = startDate.toISOString().slice(0, 10);
  const endDateStr = endDate.toISOString().slice(0, 10);

  // Get class information
  const classInfo = await all(`
    SELECT * FROM classes WHERE id = ?
  `, [classId]);

  if (classInfo.length === 0) {
    throw new Error('Class not found');
  }

  // Get students with their attendance data for the week
  const studentsData = await all(`
    SELECT 
      s.id,
      s.name,
      s.roll_no,
      g.name as parent_name,
      g.email as parent_email,
      COUNT(a.id) as total_days,
      SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_days,
      SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_days,
      SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late_days,
      SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END) as excused_days
    FROM students s
    LEFT JOIN guardians g ON s.id = g.student_id
    LEFT JOIN attendance a ON s.id = a.student_id 
      AND a.date >= ? AND a.date <= ?
    WHERE s.class_id = ?
    GROUP BY s.id, s.name, s.roll_no, g.name, g.email
    HAVING g.email IS NOT NULL
  `, [startDateStr, endDateStr, classId]);

  let sent = 0;
  let errors = 0;

  // Create email transporter
  const transporter = createTransporter();

  for (const student of studentsData) {
    try {
      // Get daily attendance details
      const dailyAttendance = await all(`
        SELECT date, status, note
        FROM attendance
        WHERE student_id = ? AND date >= ? AND date <= ?
        ORDER BY date
      `, [student.id, startDateStr, endDateStr]);

      // Calculate attendance percentage
      const attendanceRate = student.total_days > 0 ? 
        Math.round((student.present_days / student.total_days) * 100) : 0;

      // Generate email content
      const emailContent = generateEmailContent(
        student, 
        classInfo[0], 
        dailyAttendance, 
        attendanceRate,
        startDateStr,
        endDateStr
      );

      // Send email
      if (process.env.SMTP_HOST && process.env.SMTP_USER) {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || 'AttendanceMS <no-reply@school.com>',
          to: student.parent_email,
          subject: `Weekly Attendance Report - ${student.name} (${classInfo[0].name})`,
          html: emailContent
        });

        // Log successful email
        await logEmailReport(classId, student.id, 'sent', null);
        sent++;
      } else {
        console.log(`Email would be sent to ${student.parent_email} for ${student.name}`);
        await logEmailReport(classId, student.id, 'simulated', 'SMTP not configured');
        sent++;
      }

    } catch (error) {
      console.error(`Error sending email to ${student.parent_email}:`, error);
      await logEmailReport(classId, student.id, 'failed', error.message);
      errors++;
    }
  }

  return { sent, errors, total: studentsData.length };
}

// Generate HTML email content
function generateEmailContent(student, classInfo, dailyAttendance, attendanceRate, startDate, endDate) {
  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'present': return '✅';
      case 'absent': return '❌';
      case 'late': return '⏰';
      case 'excused': return '📝';
      default: return '❓';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'present': return '#28a745';
      case 'absent': return '#dc3545';
      case 'late': return '#ffc107';
      case 'excused': return '#17a2b8';
      default: return '#6c757d';
    }
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Weekly Attendance Report</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 20px; }
        .summary { background: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        .attendance-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin: 15px 0; }
        .day-card { background: white; padding: 10px; border-radius: 6px; text-align: center; border-left: 4px solid #ddd; }
        .footer { background: #343a40; color: white; padding: 15px; border-radius: 0 0 8px 8px; text-align: center; }
        .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 15px 0; }
        .stat-card { background: white; padding: 10px; border-radius: 6px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>📚 Weekly Attendance Report</h2>
          <p><strong>${student.name}</strong> - Roll No: ${student.roll_no}</p>
          <p>${classInfo.name}${classInfo.section ? ` - Section ${classInfo.section}` : ''}</p>
          <p>Week: ${formatDate(startDate)} to ${formatDate(endDate)}</p>
        </div>
        
        <div class="content">
          <div class="summary">
            <h3>📊 Weekly Summary</h3>
            <div class="stats">
              <div class="stat-card">
                <div style="font-size: 24px; font-weight: bold; color: #28a745;">${student.present_days}</div>
                <div>Present</div>
              </div>
              <div class="stat-card">
                <div style="font-size: 24px; font-weight: bold; color: #dc3545;">${student.absent_days}</div>
                <div>Absent</div>
              </div>
              <div class="stat-card">
                <div style="font-size: 24px; font-weight: bold; color: #ffc107;">${student.late_days}</div>
                <div>Late</div>
              </div>
              <div class="stat-card">
                <div style="font-size: 24px; font-weight: bold; color: #17a2b8;">${student.excused_days}</div>
                <div>Excused</div>
              </div>
            </div>
            
            <div style="text-align: center; margin-top: 15px;">
              <div style="font-size: 32px; font-weight: bold; color: ${attendanceRate >= 80 ? '#28a745' : attendanceRate >= 60 ? '#ffc107' : '#dc3545'};">
                ${attendanceRate}%
              </div>
              <div>Overall Attendance Rate</div>
            </div>
          </div>

          ${dailyAttendance.length > 0 ? `
          <div class="summary">
            <h3>📅 Daily Attendance</h3>
            <div class="attendance-grid">
              ${dailyAttendance.map(day => `
                <div class="day-card" style="border-left-color: ${getStatusColor(day.status)};">
                  <div style="font-size: 20px;">${getStatusIcon(day.status)}</div>
                  <div style="font-weight: bold;">${new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}</div>
                  <div style="font-size: 12px;">${new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                  <div style="font-size: 11px; color: #666; text-transform: capitalize;">${day.status}</div>
                  ${day.note ? `<div style="font-size: 10px; color: #888; margin-top: 5px;">${day.note}</div>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}

          ${attendanceRate < 75 ? `
          <div class="summary" style="border-left: 4px solid #dc3545;">
            <h4 style="color: #dc3545;">⚠️ Attendance Alert</h4>
            <p>Your child's attendance is below the recommended 75%. Please ensure regular attendance for better academic performance.</p>
          </div>
          ` : ''}

          ${attendanceRate >= 90 ? `
          <div class="summary" style="border-left: 4px solid #28a745;">
            <h4 style="color: #28a745;">🌟 Excellent Attendance!</h4>
            <p>Congratulations! Your child has maintained excellent attendance this week.</p>
          </div>
          ` : ''}
        </div>
        
        <div class="footer">
          <p><strong>AttendanceMS</strong> - Automated Weekly Report</p>
          <p style="font-size: 12px;">This is an automated email. Please do not reply to this message.</p>
          <p style="font-size: 12px;">For any queries, please contact the school administration.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Log email report attempts
async function logEmailReport(classId, studentId, status, error = null) {
  // First, ensure we have the email_reports table
  await run(`
    CREATE TABLE IF NOT EXISTS email_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      sent_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (student_id) REFERENCES students(id)
    )
  `);

  await run(`
    INSERT INTO email_reports (class_id, student_id, status, error_message)
    VALUES (?, ?, ?, ?)
  `, [classId, studentId, status, error]);
}

export default router;