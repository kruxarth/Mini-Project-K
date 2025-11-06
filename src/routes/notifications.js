import express from 'express';
import { getDB } from '../db.js';
import NotificationService from '../services/notification-service.js';

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

// Notifications dashboard
router.get('/notifications', requireAuth, async (req, res) => {
  try {
    const db = getDB();
    const teacherId = req.session.user.id;

    // Get notification settings
    let settings = await db.get(`
      SELECT * FROM notification_settings WHERE teacher_id = ?
    `, [teacherId]);

    // Create default settings if none exist
    if (!settings) {
      await db.run(`
        INSERT INTO notification_settings (teacher_id) VALUES (?)
      `, [teacherId]);
      settings = await db.get(`
        SELECT * FROM notification_settings WHERE teacher_id = ?
      `, [teacherId]);
    }

    // Get recent notifications
    const recentNotifications = await db.all(`
      SELECT * FROM notifications_log 
      ORDER BY created_at DESC 
      LIMIT 50
    `);

    // Get notification stats
    const stats = await db.get(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        COUNT(CASE WHEN type = 'sms' THEN 1 END) as sms_count,
        COUNT(CASE WHEN type = 'email' THEN 1 END) as email_count
      FROM notifications_log
      WHERE created_at >= date('now', '-30 days')
    `);

    res.render('notifications/dashboard', {
      title: 'Notifications Dashboard',
      settings,
      recentNotifications,
      stats: stats || { total: 0, sent: 0, failed: 0, sms_count: 0, email_count: 0 },
      currentPage: 'notifications'
    });
  } catch (error) {
    console.error('Error loading notifications dashboard:', error);
    req.session.flash = { message: 'Error loading notifications dashboard' };
    res.redirect('/dashboard');
  }
});

// Update notification settings
router.post('/notifications/settings', requireAuth, async (req, res) => {
  try {
    const db = getDB();
    const teacherId = req.session.user.id;
    const {
      absence_notifications,
      low_attendance_alerts,
      weekly_reports,
      monthly_reports,
      low_attendance_threshold
    } = req.body;

    await db.run(`
      UPDATE notification_settings 
      SET absence_notifications = ?, 
          low_attendance_alerts = ?, 
          weekly_reports = ?, 
          monthly_reports = ?,
          low_attendance_threshold = ?,
          updated_at = datetime('now')
      WHERE teacher_id = ?
    `, [
      absence_notifications ? 1 : 0,
      low_attendance_alerts ? 1 : 0,
      weekly_reports ? 1 : 0,
      monthly_reports ? 1 : 0,
      parseInt(low_attendance_threshold) || 75,
      teacherId
    ]);

    req.session.flash = { message: 'Notification settings updated successfully' };
    res.redirect('/notifications');
  } catch (error) {
    console.error('Error updating notification settings:', error);
    req.session.flash = { message: 'Error updating notification settings' };
    res.redirect('/notifications');
  }
});

// Send custom message
router.get('/notifications/send-message', requireAuth, async (req, res) => {
  try {
    const db = getDB();
    const teacherId = req.session.user.id;

    // Get all classes and students
    const classes = await db.all(`
      SELECT c.*, COUNT(s.id) as student_count
      FROM classes c 
      LEFT JOIN students s ON c.id = s.class_id 
      WHERE c.teacher_id = ? 
      GROUP BY c.id
      ORDER BY c.name
    `, [teacherId]);

    res.render('notifications/send-message', {
      title: 'Send Custom Message',
      classes,
      currentPage: 'notifications'
    });
  } catch (error) {
    console.error('Error loading send message page:', error);
    req.session.flash = { message: 'Error loading send message page' };
    res.redirect('/notifications');
  }
});

// Process custom message sending
router.post('/notifications/send-message', requireAuth, async (req, res) => {
  try {
    const db = getDB();
    const teacherId = req.session.user.id;
    const { subject, message, recipients_type, class_id, message_type } = req.body;

    let recipients = [];

    if (recipients_type === 'class' && class_id) {
      // Get students from specific class
      const students = await db.all(`
        SELECT s.*, c.name as class_name
        FROM students s
        JOIN classes c ON s.class_id = c.id
        WHERE c.id = ? AND c.teacher_id = ?
      `, [class_id, teacherId]);

      recipients = students.map(student => ({
        email: student.parent_email,
        phone: student.parent_phone,
        studentName: student.name
      })).filter(r => r.email || r.phone);
    } else if (recipients_type === 'all') {
      // Get all students from all classes
      const students = await db.all(`
        SELECT s.*, c.name as class_name
        FROM students s
        JOIN classes c ON s.class_id = c.id
        WHERE c.teacher_id = ?
      `, [teacherId]);

      recipients = students.map(student => ({
        email: student.parent_email,
        phone: student.parent_phone,
        studentName: student.name
      })).filter(r => r.email || r.phone);
    }

    if (recipients.length === 0) {
      req.session.flash = { message: 'No recipients found with contact information' };
      return res.redirect('/notifications/send-message');
    }

    // Send messages
    const results = await NotificationService.sendCustomMessage(recipients, subject, message, message_type);
    
    const totalSent = results.reduce((sum, result) => 
      sum + result.messages.filter(m => m.success).length, 0
    );
    const totalFailed = results.reduce((sum, result) => 
      sum + result.messages.filter(m => !m.success).length, 0
    );

    req.session.flash = { 
      message: `Message sent! ${totalSent} successful, ${totalFailed} failed` 
    };
    res.redirect('/notifications');
  } catch (error) {
    console.error('Error sending custom message:', error);
    req.session.flash = { message: 'Error sending message' };
    res.redirect('/notifications/send-message');
  }
});

// Get students for a class (AJAX endpoint)
router.get('/api/class/:classId/students', requireAuth, async (req, res) => {
  try {
    const db = getDB();
    const classId = req.params.classId;
    const teacherId = req.session.user.id;

    const students = await db.all(`
      SELECT s.id, s.name, s.parent_email, s.parent_phone
      FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE c.id = ? AND c.teacher_id = ?
      ORDER BY s.name
    `, [classId, teacherId]);

    res.json(students);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: 'Error fetching students' });
  }
});

// Test notification endpoint
router.post('/notifications/test', requireAuth, async (req, res) => {
  try {
    const { type, recipient } = req.body;
    
    if (type === 'sms') {
      const result = await NotificationService.sendSMS(
        recipient, 
        'This is a test SMS from your attendance management system.',
        'Test'
      );
      res.json(result);
    } else if (type === 'email') {
      const result = await NotificationService.sendEmail(
        recipient,
        'Test Email from Attendance System',
        '<h2>Test Email</h2><p>This is a test email from your attendance management system.</p>',
        'Test'
      );
      res.json(result);
    } else {
      res.status(400).json({ error: 'Invalid notification type' });
    }
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ error: 'Error sending test notification' });
  }
});

// Automated notification triggers (called by attendance system)
router.post('/api/notifications/absence', requireAuth, async (req, res) => {
  try {
    const { studentId, date } = req.body;
    const db = getDB();

    // Get student info
    const student = await db.get(`
      SELECT s.*, c.name as class_name, c.teacher_id
      FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE s.id = ? AND c.teacher_id = ?
    `, [studentId, req.session.user.id]);

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Check if absence notifications are enabled
    const settings = await db.get(`
      SELECT absence_notifications FROM notification_settings 
      WHERE teacher_id = ?
    `, [student.teacher_id]);

    if (!settings || !settings.absence_notifications) {
      return res.json({ message: 'Absence notifications disabled' });
    }

    // Send absence notification
    const results = await NotificationService.sendAbsenceNotification(student, date);
    res.json({ success: true, results });
  } catch (error) {
    console.error('Error sending absence notification:', error);
    res.status(500).json({ error: 'Error sending absence notification' });
  }
});

router.post('/api/notifications/low-attendance', requireAuth, async (req, res) => {
  try {
    const { studentId, attendancePercentage } = req.body;
    const db = getDB();

    // Get student info
    const student = await db.get(`
      SELECT s.*, c.name as class_name, c.teacher_id
      FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE s.id = ? AND c.teacher_id = ?
    `, [studentId, req.session.user.id]);

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Check if low attendance alerts are enabled
    const settings = await db.get(`
      SELECT low_attendance_alerts, low_attendance_threshold 
      FROM notification_settings 
      WHERE teacher_id = ?
    `, [student.teacher_id]);

    if (!settings || !settings.low_attendance_alerts) {
      return res.json({ message: 'Low attendance alerts disabled' });
    }

    if (attendancePercentage >= settings.low_attendance_threshold) {
      return res.json({ message: 'Attendance above threshold' });
    }

    // Send low attendance alert
    const results = await NotificationService.sendLowAttendanceAlert(student, attendancePercentage);
    res.json({ success: true, results });
  } catch (error) {
    console.error('Error sending low attendance alert:', error);
    res.status(500).json({ error: 'Error sending low attendance alert' });
  }
});

export default router;