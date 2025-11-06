import { getDB } from '../db.js';
import NotificationService from '../services/notification-service.js';

// Middleware to trigger notifications after attendance is marked
export async function triggerAttendanceNotifications(req, res, next) {
  // Store original res.json to intercept response
  const originalJson = res.json;
  
  res.json = function(data) {
    // Call original json method first
    originalJson.call(this, data);
    
    // Then trigger notifications asynchronously
    if (data.success && req.body.attendance) {
      setImmediate(() => {
        processAttendanceNotifications(req.body.attendance, req.session.user.id);
      });
    }
  };
  
  next();
}

// Process attendance data and send notifications
async function processAttendanceNotifications(attendanceData, teacherId) {
  try {
    const db = getDB();
    
    // Get notification settings for this teacher
    const settings = await db.get(`
      SELECT * FROM notification_settings WHERE teacher_id = ?
    `, [teacherId]);
    
    if (!settings) return;
    
    // Process each attendance record
    for (const record of attendanceData) {
      const { student_id, status, date } = record;
      
      // Get student information
      const student = await db.get(`
        SELECT s.*, c.name as class_name
        FROM students s
        JOIN classes c ON s.class_id = c.id
        WHERE s.id = ? AND c.teacher_id = ?
      `, [student_id, teacherId]);
      
      if (!student) continue;
      
      // Send absence notification if enabled and student is absent
      if (settings.absence_notifications && status === 'absent') {
        await NotificationService.sendAbsenceNotification(
          student, 
          new Date(date).toLocaleDateString()
        );
        console.log(`Sent absence notification for ${student.name}`);
      }
      
      // Check for low attendance if alerts are enabled
      if (settings.low_attendance_alerts) {
        const attendanceStats = await db.get(`
          SELECT 
            COUNT(*) as total_days,
            COUNT(CASE WHEN status = 'present' THEN 1 END) as present_days,
            ROUND(
              (COUNT(CASE WHEN status = 'present' THEN 1 END) * 100.0 / 
               NULLIF(COUNT(*), 0)), 2
            ) as attendance_percentage
          FROM attendance
          WHERE student_id = ?
        `, [student_id]);
        
        if (attendanceStats && 
            attendanceStats.total_days >= 10 && 
            attendanceStats.attendance_percentage < settings.low_attendance_threshold) {
          
          // Check if we've sent an alert recently (within 7 days)
          const recentAlert = await db.get(`
            SELECT id FROM notifications_log
            WHERE student_name = ? 
              AND content LIKE '%Low Attendance%'
              AND created_at > datetime('now', '-7 days')
          `, [student.name]);
          
          if (!recentAlert) {
            await NotificationService.sendLowAttendanceAlert(
              student, 
              attendanceStats.attendance_percentage
            );
            console.log(`Sent low attendance alert for ${student.name} (${attendanceStats.attendance_percentage}%)`);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error processing attendance notifications:', error);
  }
}

// Trigger notification for individual student absence
export async function triggerAbsenceNotification(studentId, date, teacherId) {
  try {
    const db = getDB();
    
    // Get notification settings
    const settings = await db.get(`
      SELECT absence_notifications FROM notification_settings WHERE teacher_id = ?
    `, [teacherId]);
    
    if (!settings || !settings.absence_notifications) return;
    
    // Get student information
    const student = await db.get(`
      SELECT s.*, c.name as class_name
      FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE s.id = ? AND c.teacher_id = ?
    `, [studentId, teacherId]);
    
    if (student) {
      await NotificationService.sendAbsenceNotification(student, date);
      console.log(`Triggered absence notification for ${student.name}`);
    }
  } catch (error) {
    console.error('Error triggering absence notification:', error);
  }
}

// Trigger low attendance alert
export async function triggerLowAttendanceAlert(studentId, attendancePercentage, teacherId) {
  try {
    const db = getDB();
    
    // Get notification settings
    const settings = await db.get(`
      SELECT low_attendance_alerts, low_attendance_threshold 
      FROM notification_settings WHERE teacher_id = ?
    `, [teacherId]);
    
    if (!settings || !settings.low_attendance_alerts) return;
    if (attendancePercentage >= settings.low_attendance_threshold) return;
    
    // Get student information
    const student = await db.get(`
      SELECT s.*, c.name as class_name
      FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE s.id = ? AND c.teacher_id = ?
    `, [studentId, teacherId]);
    
    if (student) {
      // Check if we've sent an alert recently
      const recentAlert = await db.get(`
        SELECT id FROM notifications_log
        WHERE student_name = ? 
          AND content LIKE '%Low Attendance%'
          AND created_at > datetime('now', '-7 days')
      `, [student.name]);
      
      if (!recentAlert) {
        await NotificationService.sendLowAttendanceAlert(student, attendancePercentage);
        console.log(`Triggered low attendance alert for ${student.name} (${attendancePercentage}%)`);
      }
    }
  } catch (error) {
    console.error('Error triggering low attendance alert:', error);
  }
}