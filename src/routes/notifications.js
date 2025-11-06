import express from 'express';
import { all, run } from '../db.js';
import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { logAuditEvent, AUDIT_ACTIONS } from '../middleware/audit.js';

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

// Initialize email transporter
function createEmailTransporter() {
  if (!process.env.SMTP_HOST) return null;
  
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

// Initialize Twilio client
function createTwilioClient() {
  if (!process.env.TWILIO_SID || !process.env.TWILIO_TOKEN) return null;
  return twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
}

// Notification settings page
router.get('/notifications', requireAuth, async (req, res) => {
  try {
    const teacherId = req.session.user.id;
    
    // Get notification settings
    const settings = await all(`
      SELECT * FROM notification_settings WHERE teacher_id = ?
    `, [teacherId]);
    
    // Get notification templates
    const templates = await all(`
      SELECT * FROM notification_templates WHERE teacher_id = ? OR is_global = 1
      ORDER BY is_global, name
    `, [teacherId]);
    
    // Get recent notifications
    const recentNotifications = await all(`
      SELECT 
        nl.*,
        s.name as student_name,
        c.name as class_name,
        c.section
      FROM notification_log nl
      LEFT JOIN attendance a ON nl.attendance_id = a.id
      LEFT JOIN students s ON a.student_id = s.id
      LEFT JOIN classes c ON a.class_id = c.id
      WHERE c.teacher_id = ?
      ORDER BY nl.sent_at DESC
      LIMIT 50
    `, [teacherId]);
    
    res.render('notifications', {
      pageTitle: 'Notification Settings',
      settings: settings[0] || {},
      templates,
      recentNotifications
    });
    
  } catch (error) {
    console.error('Notifications page error:', error);
    req.session.flash = { message: 'Error loading notifications page' };
    res.redirect('/dashboard');
  }
});

// Update notification settings
router.post('/notifications/settings', requireAuth, async (req, res) => {
  const teacherId = req.session.user.id;
  const {
    email_enabled,
    sms_enabled,
    absence_alerts,
    low_attendance_alerts,
    weekly_reports,
    monthly_reports,
    low_attendance_threshold,
    report_day,
    report_time
  } = req.body;
  
  try {
    // Insert or update settings
    await run(`
      INSERT OR REPLACE INTO notification_settings 
      (teacher_id, email_enabled, sms_enabled, absence_alerts, low_attendance_alerts,
       weekly_reports, monthly_reports, low_attendance_threshold, report_day, report_time,
       updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `, [
      teacherId,
      email_enabled ? 1 : 0,
      sms_enabled ? 1 : 0,
      absence_alerts ? 1 : 0,
      low_attendance_alerts ? 1 : 0,
      weekly_reports ? 1 : 0,
      monthly_reports ? 1 : 0,
      parseInt(low_attendance_threshold) || 75,
      report_day || 'friday',
      report_time || '17:00'
    ]);
    
    // Log audit event
    await logAuditEvent({
      userId: teacherId,
      action: 'update_notification_settings',
      resourceType: 'notification_settings',
      resourceId: teacherId,
      newValues: req.body,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    req.session.flash = { message: 'Notification settings updated successfully!' };
    res.redirect('/notifications');
    
  } catch (error) {
    console.error('Update notification settings error:', error);
    req.session.flash = { message: 'Error updating notification settings' };
    res.redirect('/notifications');
  }
});

// Send immediate absence notifications
router.post('/notifications/send-absence', requireAuth, async (req, res) => {
  const { classId, date } = req.body;
  const teacherId = req.session.user.id;
  
  try {
    // Verify teacher owns this class
    const classCheck = await all(`
      SELECT * FROM classes WHERE id = ? AND teacher_id = ?
    `, [classId, teacherId]);
    
    if (classCheck.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const result = await sendAbsenceNotifications(classId, date, teacherId);
    res.json(result);
    
  } catch (error) {
    console.error('Send absence notifications error:', error);
    res.status(500).json({ error: 'Failed to send notifications' });
  }
});

// Send low attendance alerts
router.post('/notifications/send-low-attendance', requireAuth, async (req, res) => {
  const teacherId = req.session.user.id;
  
  try {
    const result = await sendLowAttendanceAlerts(teacherId);
    res.json(result);
    
  } catch (error) {
    console.error('Send low attendance alerts error:', error);
    res.status(500).json({ error: 'Failed to send low attendance alerts' });
  }
});

// Send weekly/monthly reports
router.post('/notifications/send-reports', requireAuth, async (req, res) => {
  const { reportType } = req.body; // 'weekly' or 'monthly'
  const teacherId = req.session.user.id;
  
  try {
    const result = await sendAttendanceReports(teacherId, reportType);
    res.json(result);
    
  } catch (error) {
    console.error('Send reports error:', error);
    res.status(500).json({ error: 'Failed to send reports' });
  }
});

// Function to send absence notifications
async function sendAbsenceNotifications(classId, date, teacherId) {
  const transporter = createEmailTransporter();
  const twilioClient = createTwilioClient();
  
  // Get absent students with guardian contact info
  const absentStudents = await all(`
    SELECT 
      s.id, s.name as student_name, s.roll_number,
      g.name as guardian_name, g.email, g.phone, g.preferred_channel,
      c.name as class_name, c.section, c.subject,
      a.id as attendance_id
    FROM attendance a
    JOIN students s ON a.student_id = s.id
    JOIN classes c ON a.class_id = c.id
    LEFT JOIN guardians g ON s.id = g.student_id
    WHERE a.class_id = ? AND a.date = ? AND a.status = 'absent'
  `, [classId, date]);
  
  let emailsSent = 0;
  let smsSent = 0;
  let errors = [];
  
  for (const student of absentStudents) {
    try {
      // Send email notification
      if (transporter && student.email && (student.preferred_channel === 'email' || student.preferred_channel === 'both')) {
        const emailTemplate = await getNotificationTemplate('absence_email', teacherId);
        const emailContent = renderTemplate(emailTemplate, {
          student_name: student.student_name,
          guardian_name: student.guardian_name,
          class_name: student.class_name,
          section: student.section,
          date: new Date(date).toLocaleDateString(),
          roll_number: student.roll_number
        });
        
        await transporter.sendMail({
          from: process.env.SMTP_FROM || 'no-reply@school.com',
          to: student.email,
          subject: `Absence Alert: ${student.student_name} - ${new Date(date).toLocaleDateString()}`,
          html: emailContent
        });
        
        await logNotification(student.attendance_id, 'email', 'sent', null, null);
        emailsSent++;
      }
      
      // Send SMS notification
      if (twilioClient && student.phone && (student.preferred_channel === 'sms' || student.preferred_channel === 'both')) {
        const smsTemplate = await getNotificationTemplate('absence_sms', teacherId);
        const smsContent = renderTemplate(smsTemplate, {
          student_name: student.student_name,
          guardian_name: student.guardian_name,
          class_name: student.class_name,
          section: student.section,
          date: new Date(date).toLocaleDateString(),
          roll_number: student.roll_number
        });
        
        const message = await twilioClient.messages.create({
          from: process.env.TWILIO_FROM,
          to: student.phone,
          body: smsContent
        });
        
        await logNotification(student.attendance_id, 'sms', 'sent', message.sid, null);
        smsSent++;
      }
      
    } catch (error) {
      console.error(`Notification error for student ${student.student_name}:`, error);
      await logNotification(student.attendance_id, 'email', 'failed', null, error.message);
      errors.push(`${student.student_name}: ${error.message}`);
    }
  }
  
  return {
    success: true,
    emailsSent,
    smsSent,
    totalStudents: absentStudents.length,
    errors
  };
}

// Function to send low attendance alerts
async function sendLowAttendanceAlerts(teacherId) {
  const transporter = createEmailTransporter();
  const twilioClient = createTwilioClient();
  
  // Get notification settings
  const settings = await all(`
    SELECT * FROM notification_settings WHERE teacher_id = ?
  `, [teacherId]);
  
  if (settings.length === 0 || !settings[0].low_attendance_alerts) {
    return { success: false, message: 'Low attendance alerts not enabled' };
  }
  
  const threshold = settings[0].low_attendance_threshold || 75;
  
  // Get students with low attendance (last 30 days)
  const lowAttendanceStudents = await all(`
    SELECT 
      s.id, s.name as student_name, s.roll_number,
      g.name as guardian_name, g.email, g.phone, g.preferred_channel,
      c.name as class_name, c.section,
      COUNT(a.id) as total_days,
      COUNT(CASE WHEN a.status IN ('present', 'late') THEN 1 END) as present_days,
      ROUND(COUNT(CASE WHEN a.status IN ('present', 'late') THEN 1 END) * 100.0 / COUNT(a.id), 2) as attendance_rate
    FROM students s
    JOIN classes c ON s.class_id = c.id
    LEFT JOIN guardians g ON s.id = g.student_id
    LEFT JOIN attendance a ON s.id = a.student_id 
      AND a.date >= date('now', '-30 days')
      AND a.class_id = c.id
    WHERE c.teacher_id = ?
    GROUP BY s.id, s.name, s.roll_number, g.name, g.email, g.phone, g.preferred_channel, c.name, c.section
    HAVING attendance_rate < ? AND total_days >= 10
  `, [teacherId, threshold]);
  
  let emailsSent = 0;
  let smsSent = 0;
  let errors = [];
  
  for (const student of lowAttendanceStudents) {
    try {
      // Send email notification
      if (transporter && student.email && (student.preferred_channel === 'email' || student.preferred_channel === 'both')) {
        const emailTemplate = await getNotificationTemplate('low_attendance_email', teacherId);
        const emailContent = renderTemplate(emailTemplate, {
          student_name: student.student_name,
          guardian_name: student.guardian_name,
          class_name: student.class_name,
          section: student.section,
          attendance_rate: student.attendance_rate,
          threshold: threshold,
          present_days: student.present_days,
          total_days: student.total_days,
          roll_number: student.roll_number
        });
        
        await transporter.sendMail({
          from: process.env.SMTP_FROM || 'no-reply@school.com',
          to: student.email,
          subject: `Low Attendance Alert: ${student.student_name} (${student.attendance_rate}%)`,
          html: emailContent
        });
        
        await logNotification(null, 'email', 'sent', null, null, 'low_attendance', student.id);
        emailsSent++;
      }
      
      // Send SMS notification
      if (twilioClient && student.phone && (student.preferred_channel === 'sms' || student.preferred_channel === 'both')) {
        const smsTemplate = await getNotificationTemplate('low_attendance_sms', teacherId);
        const smsContent = renderTemplate(smsTemplate, {
          student_name: student.student_name,
          guardian_name: student.guardian_name,
          class_name: student.class_name,
          section: student.section,
          attendance_rate: student.attendance_rate,
          threshold: threshold,
          present_days: student.present_days,
          total_days: student.total_days,
          roll_number: student.roll_number
        });
        
        const message = await twilioClient.messages.create({
          from: process.env.TWILIO_FROM,
          to: student.phone,
          body: smsContent
        });
        
        await logNotification(null, 'sms', 'sent', message.sid, null, 'low_attendance', student.id);
        smsSent++;
      }
      
    } catch (error) {
      console.error(`Low attendance notification error for student ${student.student_name}:`, error);
      await logNotification(null, 'email', 'failed', null, error.message, 'low_attendance', student.id);
      errors.push(`${student.student_name}: ${error.message}`);
    }
  }
  
  return {
    success: true,
    emailsSent,
    smsSent,
    totalStudents: lowAttendanceStudents.length,
    errors
  };
}

// Function to send attendance reports
async function sendAttendanceReports(teacherId, reportType) {
  const transporter = createEmailTransporter();
  const twilioClient = createTwilioClient();
  
  // Get notification settings
  const settings = await all(`
    SELECT * FROM notification_settings WHERE teacher_id = ?
  `, [teacherId]);
  
  if (settings.length === 0) {
    return { success: false, message: 'Notification settings not configured' };
  }
  
  const setting = settings[0];
  if ((reportType === 'weekly' && !setting.weekly_reports) || 
      (reportType === 'monthly' && !setting.monthly_reports)) {
    return { success: false, message: `${reportType} reports not enabled` };
  }
  
  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  
  if (reportType === 'weekly') {
    startDate.setDate(endDate.getDate() - 7);
  } else {
    startDate.setMonth(endDate.getMonth() - 1);
  }
  
  // Get students with attendance data
  const studentsWithAttendance = await all(`
    SELECT 
      s.id, s.name as student_name, s.roll_number,
      g.name as guardian_name, g.email, g.phone, g.preferred_channel,
      c.name as class_name, c.section,
      COUNT(a.id) as total_days,
      COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_days,
      COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_days,
      COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_days,
      ROUND(COUNT(CASE WHEN a.status IN ('present', 'late') THEN 1 END) * 100.0 / COUNT(a.id), 2) as attendance_rate
    FROM students s
    JOIN classes c ON s.class_id = c.id
    LEFT JOIN guardians g ON s.id = g.student_id
    LEFT JOIN attendance a ON s.id = a.student_id 
      AND a.date BETWEEN ? AND ?
      AND a.class_id = c.id
    WHERE c.teacher_id = ?
    GROUP BY s.id, s.name, s.roll_number, g.name, g.email, g.phone, g.preferred_channel, c.name, c.section
    HAVING total_days > 0
  `, [startDate.toISOString().slice(0, 10), endDate.toISOString().slice(0, 10), teacherId]);
  
  let emailsSent = 0;
  let smsSent = 0;
  let errors = [];
  
  for (const student of studentsWithAttendance) {
    try {
      // Send email report
      if (transporter && student.email && (student.preferred_channel === 'email' || student.preferred_channel === 'both')) {
        const emailTemplate = await getNotificationTemplate(`${reportType}_report_email`, teacherId);
        const emailContent = renderTemplate(emailTemplate, {
          student_name: student.student_name,
          guardian_name: student.guardian_name,
          class_name: student.class_name,
          section: student.section,
          attendance_rate: student.attendance_rate,
          present_days: student.present_days,
          absent_days: student.absent_days,
          late_days: student.late_days,
          total_days: student.total_days,
          roll_number: student.roll_number,
          start_date: startDate.toLocaleDateString(),
          end_date: endDate.toLocaleDateString(),
          report_type: reportType
        });
        
        await transporter.sendMail({
          from: process.env.SMTP_FROM || 'no-reply@school.com',
          to: student.email,
          subject: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Attendance Report: ${student.student_name}`,
          html: emailContent
        });
        
        await logNotification(null, 'email', 'sent', null, null, `${reportType}_report`, student.id);
        emailsSent++;
      }
      
      // Send SMS summary (shorter version)
      if (twilioClient && student.phone && (student.preferred_channel === 'sms' || student.preferred_channel === 'both')) {
        const smsTemplate = await getNotificationTemplate(`${reportType}_report_sms`, teacherId);
        const smsContent = renderTemplate(smsTemplate, {
          student_name: student.student_name,
          guardian_name: student.guardian_name,
          attendance_rate: student.attendance_rate,
          present_days: student.present_days,
          total_days: student.total_days,
          report_type: reportType
        });
        
        const message = await twilioClient.messages.create({
          from: process.env.TWILIO_FROM,
          to: student.phone,
          body: smsContent
        });
        
        await logNotification(null, 'sms', 'sent', message.sid, null, `${reportType}_report`, student.id);
        smsSent++;
      }
      
    } catch (error) {
      console.error(`Report notification error for student ${student.student_name}:`, error);
      await logNotification(null, 'email', 'failed', null, error.message, `${reportType}_report`, student.id);
      errors.push(`${student.student_name}: ${error.message}`);
    }
  }
  
  return {
    success: true,
    emailsSent,
    smsSent,
    totalStudents: studentsWithAttendance.length,
    errors
  };
}

// Helper function to get notification template
async function getNotificationTemplate(templateType, teacherId) {
  const templates = await all(`
    SELECT content FROM notification_templates 
    WHERE type = ? AND (teacher_id = ? OR is_global = 1)
    ORDER BY teacher_id DESC
    LIMIT 1
  `, [templateType, teacherId]);
  
  if (templates.length > 0) {
    return templates[0].content;
  }
  
  // Default templates
  const defaultTemplates = {
    absence_email: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #e74c3c;">Absence Notification</h2>
        <p>Dear {{guardian_name}},</p>
        <p>This is to inform you that <strong>{{student_name}}</strong> (Roll No: {{roll_number}}) was marked absent in <strong>{{class_name}} - {{section}}</strong> on <strong>{{date}}</strong>.</p>
        <p>If this is an error or if there was a valid reason for the absence, please contact the class teacher immediately.</p>
        <p>Thank you for your attention to your child's attendance.</p>
        <p>Best regards,<br>School Administration</p>
      </div>
    `,
    absence_sms: `ABSENCE ALERT: {{student_name}} ({{roll_number}}) was absent from {{class_name}}-{{section}} on {{date}}. Please contact school if this is an error.`,
    
    low_attendance_email: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f39c12;">Low Attendance Alert</h2>
        <p>Dear {{guardian_name}},</p>
        <p>We are writing to inform you about <strong>{{student_name}}</strong>'s attendance in <strong>{{class_name}} - {{section}}</strong>.</p>
        <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3>Attendance Summary (Last 30 Days)</h3>
          <ul>
            <li>Current Attendance Rate: <strong>{{attendance_rate}}%</strong></li>
            <li>Days Present: {{present_days}} out of {{total_days}}</li>
            <li>Required Minimum: {{threshold}}%</li>
          </ul>
        </div>
        <p>Your child's attendance is below the required minimum of {{threshold}}%. Regular attendance is crucial for academic success.</p>
        <p>Please ensure regular attendance going forward. If there are any concerns, please contact us.</p>
        <p>Best regards,<br>School Administration</p>
      </div>
    `,
    low_attendance_sms: `LOW ATTENDANCE: {{student_name}} has {{attendance_rate}}% attendance ({{present_days}}/{{total_days}} days). Minimum required: {{threshold}}%. Please ensure regular attendance.`,
    
    weekly_report_email: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3498db;">Weekly Attendance Report</h2>
        <p>Dear {{guardian_name}},</p>
        <p>Here is <strong>{{student_name}}</strong>'s attendance summary for the week ({{start_date}} to {{end_date}}):</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Attendance Summary</h3>
          <ul>
            <li>Total School Days: {{total_days}}</li>
            <li>Days Present: {{present_days}}</li>
            <li>Days Absent: {{absent_days}}</li>
            <li>Days Late: {{late_days}}</li>
            <li>Attendance Rate: <strong>{{attendance_rate}}%</strong></li>
          </ul>
        </div>
        <p>Thank you for supporting your child's education.</p>
        <p>Best regards,<br>{{class_name}} - {{section}}</p>
      </div>
    `,
    weekly_report_sms: `WEEKLY REPORT: {{student_name}} - {{attendance_rate}}% attendance ({{present_days}}/{{total_days}} days present). Keep up the good work!`,
    
    monthly_report_email: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #27ae60;">Monthly Attendance Report</h2>
        <p>Dear {{guardian_name}},</p>
        <p>Here is <strong>{{student_name}}</strong>'s attendance summary for the month ({{start_date}} to {{end_date}}):</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Monthly Attendance Summary</h3>
          <ul>
            <li>Total School Days: {{total_days}}</li>
            <li>Days Present: {{present_days}}</li>
            <li>Days Absent: {{absent_days}}</li>
            <li>Days Late: {{late_days}}</li>
            <li>Attendance Rate: <strong>{{attendance_rate}}%</strong></li>
          </ul>
        </div>
        <p>We appreciate your continued support in ensuring regular attendance.</p>
        <p>Best regards,<br>{{class_name}} - {{section}}</p>
      </div>
    `,
    monthly_report_sms: `MONTHLY REPORT: {{student_name}} - {{attendance_rate}}% attendance this month ({{present_days}}/{{total_days}} days). Thank you for your support!`
  };
  
  return defaultTemplates[templateType] || 'Template not found';
}

// Helper function to render template with variables
function renderTemplate(template, variables) {
  let rendered = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    rendered = rendered.replace(regex, value || '');
  }
  return rendered;
}

// Helper function to log notifications
async function logNotification(attendanceId, channel, status, providerId, error, notificationType = null, studentId = null) {
  await run(`
    INSERT INTO notification_log 
    (attendance_id, student_id, channel, status, provider_id, error, notification_type, sent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `, [attendanceId, studentId, channel, status, providerId, error, notificationType]);
}

export default router;