import cron from 'node-cron';
import { all, run } from '../db.js';
import nodemailer from 'nodemailer';
import twilio from 'twilio';

class NotificationScheduler {
  constructor() {
    this.jobs = new Map();
    this.isInitialized = false;
  }

  // Initialize the scheduler
  async initialize() {
    if (this.isInitialized) return;
    
    console.log('Initializing notification scheduler...');
    
    // Schedule daily absence notifications (runs every hour during school hours)
    cron.schedule('0 8-17 * * 1-5', async () => {
      await this.sendDailyAbsenceNotifications();
    });

    // Schedule weekly reports (runs every Friday at 5 PM)
    cron.schedule('0 17 * * 5', async () => {
      await this.sendWeeklyReports();
    });

    // Schedule monthly reports (runs on the 1st of every month at 6 PM)
    cron.schedule('0 18 1 * *', async () => {
      await this.sendMonthlyReports();
    });

    // Schedule low attendance alerts (runs every Monday at 9 AM)
    cron.schedule('0 9 * * 1', async () => {
      await this.sendLowAttendanceAlerts();
    });

    // Check for custom scheduled notifications every hour
    cron.schedule('0 * * * *', async () => {
      await this.processCustomSchedules();
    });

    this.isInitialized = true;
    console.log('Notification scheduler initialized successfully');
  }

  // Send daily absence notifications
  async sendDailyAbsenceNotifications() {
    try {
      console.log('Processing daily absence notifications...');
      
      const today = new Date().toISOString().slice(0, 10);
      
      // Get all teachers with absence alerts enabled
      const teachers = await all(`
        SELECT DISTINCT t.id, t.name, ns.email_enabled, ns.sms_enabled
        FROM teachers t
        JOIN notification_settings ns ON t.id = ns.teacher_id
        WHERE ns.absence_alerts = 1 AND (ns.email_enabled = 1 OR ns.sms_enabled = 1)
      `);

      for (const teacher of teachers) {
        // Get classes for this teacher
        const classes = await all(`
          SELECT id FROM classes WHERE teacher_id = ?
        `, [teacher.id]);

        for (const classInfo of classes) {
          await this.sendAbsenceNotificationsForClass(classInfo.id, today, teacher.id);
        }
      }
      
      console.log('Daily absence notifications processed');
    } catch (error) {
      console.error('Error processing daily absence notifications:', error);
    }
  }

  // Send weekly reports
  async sendWeeklyReports() {
    try {
      console.log('Processing weekly reports...');
      
      // Get all teachers with weekly reports enabled
      const teachers = await all(`
        SELECT t.id, t.name, ns.report_day, ns.report_time
        FROM teachers t
        JOIN notification_settings ns ON t.id = ns.teacher_id
        WHERE ns.weekly_reports = 1 AND (ns.email_enabled = 1 OR ns.sms_enabled = 1)
      `);

      for (const teacher of teachers) {
        await this.sendAttendanceReports(teacher.id, 'weekly');
      }
      
      console.log('Weekly reports processed');
    } catch (error) {
      console.error('Error processing weekly reports:', error);
    }
  }

  // Send monthly reports
  async sendMonthlyReports() {
    try {
      console.log('Processing monthly reports...');
      
      // Get all teachers with monthly reports enabled
      const teachers = await all(`
        SELECT t.id, t.name
        FROM teachers t
        JOIN notification_settings ns ON t.id = ns.teacher_id
        WHERE ns.monthly_reports = 1 AND (ns.email_enabled = 1 OR ns.sms_enabled = 1)
      `);

      for (const teacher of teachers) {
        await this.sendAttendanceReports(teacher.id, 'monthly');
      }
      
      console.log('Monthly reports processed');
    } catch (error) {
      console.error('Error processing monthly reports:', error);
    }
  }

  // Send low attendance alerts
  async sendLowAttendanceAlerts() {
    try {
      console.log('Processing low attendance alerts...');
      
      // Get all teachers with low attendance alerts enabled
      const teachers = await all(`
        SELECT t.id, t.name, ns.low_attendance_threshold
        FROM teachers t
        JOIN notification_settings ns ON t.id = ns.teacher_id
        WHERE ns.low_attendance_alerts = 1 AND (ns.email_enabled = 1 OR ns.sms_enabled = 1)
      `);

      for (const teacher of teachers) {
        await this.sendLowAttendanceAlertsForTeacher(teacher.id, teacher.low_attendance_threshold || 75);
      }
      
      console.log('Low attendance alerts processed');
    } catch (error) {
      console.error('Error processing low attendance alerts:', error);
    }
  }

  // Process custom scheduled notifications
  async processCustomSchedules() {
    try {
      const now = new Date();
      const currentHour = now.getHours();
      const currentDay = now.toLocaleDateString('en-US', { weekday: 'lowercase' });
      
      // Get scheduled notifications that should run now
      const scheduledNotifications = await all(`
        SELECT * FROM scheduled_notifications 
        WHERE is_active = 1 
        AND (next_run IS NULL OR next_run <= datetime('now'))
      `);

      for (const schedule of scheduledNotifications) {
        try {
          await this.executeScheduledNotification(schedule);
          
          // Update next run time
          const nextRun = this.calculateNextRun(schedule);
          await run(`
            UPDATE scheduled_notifications 
            SET last_run = datetime('now'), next_run = ?
            WHERE id = ?
          `, [nextRun, schedule.id]);
          
        } catch (error) {
          console.error(`Error executing scheduled notification ${schedule.id}:`, error);
        }
      }
      
    } catch (error) {
      console.error('Error processing custom schedules:', error);
    }
  }

  // Execute a scheduled notification
  async executeScheduledNotification(schedule) {
    switch (schedule.notification_type) {
      case 'weekly_report':
        await this.sendAttendanceReports(schedule.teacher_id, 'weekly');
        break;
      case 'monthly_report':
        await this.sendAttendanceReports(schedule.teacher_id, 'monthly');
        break;
      case 'low_attendance_alert':
        await this.sendLowAttendanceAlertsForTeacher(schedule.teacher_id);
        break;
      case 'absence_alert':
        const today = new Date().toISOString().slice(0, 10);
        const classes = await all(`SELECT id FROM classes WHERE teacher_id = ?`, [schedule.teacher_id]);
        for (const classInfo of classes) {
          await this.sendAbsenceNotificationsForClass(classInfo.id, today, schedule.teacher_id);
        }
        break;
    }
  }

  // Calculate next run time for a schedule
  calculateNextRun(schedule) {
    const now = new Date();
    let nextRun = new Date(now);
    
    switch (schedule.schedule_type) {
      case 'daily':
        nextRun.setDate(nextRun.getDate() + 1);
        break;
      case 'weekly':
        nextRun.setDate(nextRun.getDate() + 7);
        break;
      case 'monthly':
        nextRun.setMonth(nextRun.getMonth() + 1);
        break;
    }
    
    // Set the time
    if (schedule.schedule_time) {
      const [hours, minutes] = schedule.schedule_time.split(':');
      nextRun.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    }
    
    return nextRun.toISOString();
  }

  // Helper method to send absence notifications for a specific class
  async sendAbsenceNotificationsForClass(classId, date, teacherId) {
    const transporter = this.createEmailTransporter();
    const twilioClient = this.createTwilioClient();
    
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
      AND (g.email IS NOT NULL OR g.phone IS NOT NULL)
    `, [classId, date]);

    for (const student of absentStudents) {
      try {
        // Send email notification
        if (transporter && student.email && (student.preferred_channel === 'email' || student.preferred_channel === 'both')) {
          const emailTemplate = await this.getNotificationTemplate('absence_email', teacherId);
          const emailContent = this.renderTemplate(emailTemplate, {
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
          
          await this.logNotification(student.attendance_id, 'email', 'sent', null, null);
        }
        
        // Send SMS notification
        if (twilioClient && student.phone && (student.preferred_channel === 'sms' || student.preferred_channel === 'both')) {
          const smsTemplate = await this.getNotificationTemplate('absence_sms', teacherId);
          const smsContent = this.renderTemplate(smsTemplate, {
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
          
          await this.logNotification(student.attendance_id, 'sms', 'sent', message.sid, null);
        }
        
      } catch (error) {
        console.error(`Notification error for student ${student.student_name}:`, error);
        await this.logNotification(student.attendance_id, 'email', 'failed', null, error.message);
      }
    }
  }

  // Helper method to send low attendance alerts for a teacher
  async sendLowAttendanceAlertsForTeacher(teacherId, threshold = 75) {
    const transporter = this.createEmailTransporter();
    const twilioClient = this.createTwilioClient();
    
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
      WHERE c.teacher_id = ? AND (g.email IS NOT NULL OR g.phone IS NOT NULL)
      GROUP BY s.id, s.name, s.roll_number, g.name, g.email, g.phone, g.preferred_channel, c.name, c.section
      HAVING attendance_rate < ? AND total_days >= 10
    `, [teacherId, threshold]);

    for (const student of lowAttendanceStudents) {
      try {
        // Send email notification
        if (transporter && student.email && (student.preferred_channel === 'email' || student.preferred_channel === 'both')) {
          const emailTemplate = await this.getNotificationTemplate('low_attendance_email', teacherId);
          const emailContent = this.renderTemplate(emailTemplate, {
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
          
          await this.logNotification(null, 'email', 'sent', null, null, 'low_attendance', student.id);
        }
        
        // Send SMS notification
        if (twilioClient && student.phone && (student.preferred_channel === 'sms' || student.preferred_channel === 'both')) {
          const smsTemplate = await this.getNotificationTemplate('low_attendance_sms', teacherId);
          const smsContent = this.renderTemplate(smsTemplate, {
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
          
          await this.logNotification(null, 'sms', 'sent', message.sid, null, 'low_attendance', student.id);
        }
        
      } catch (error) {
        console.error(`Low attendance notification error for student ${student.student_name}:`, error);
        await this.logNotification(null, 'email', 'failed', null, error.message, 'low_attendance', student.id);
      }
    }
  }

  // Helper method to send attendance reports
  async sendAttendanceReports(teacherId, reportType) {
    const transporter = this.createEmailTransporter();
    const twilioClient = this.createTwilioClient();
    
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
      WHERE c.teacher_id = ? AND (g.email IS NOT NULL OR g.phone IS NOT NULL)
      GROUP BY s.id, s.name, s.roll_number, g.name, g.email, g.phone, g.preferred_channel, c.name, c.section
      HAVING total_days > 0
    `, [startDate.toISOString().slice(0, 10), endDate.toISOString().slice(0, 10), teacherId]);

    for (const student of studentsWithAttendance) {
      try {
        // Send email report
        if (transporter && student.email && (student.preferred_channel === 'email' || student.preferred_channel === 'both')) {
          const emailTemplate = await this.getNotificationTemplate(`${reportType}_report_email`, teacherId);
          const emailContent = this.renderTemplate(emailTemplate, {
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
          
          await this.logNotification(null, 'email', 'sent', null, null, `${reportType}_report`, student.id);
        }
        
        // Send SMS summary (shorter version)
        if (twilioClient && student.phone && (student.preferred_channel === 'sms' || student.preferred_channel === 'both')) {
          const smsTemplate = await this.getNotificationTemplate(`${reportType}_report_sms`, teacherId);
          const smsContent = this.renderTemplate(smsTemplate, {
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
          
          await this.logNotification(null, 'sms', 'sent', message.sid, null, `${reportType}_report`, student.id);
        }
        
      } catch (error) {
        console.error(`Report notification error for student ${student.student_name}:`, error);
        await this.logNotification(null, 'email', 'failed', null, error.message, `${reportType}_report`, student.id);
      }
    }
  }

  // Helper methods
  createEmailTransporter() {
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

  createTwilioClient() {
    if (!process.env.TWILIO_SID || !process.env.TWILIO_TOKEN) return null;
    return twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
  }

  async getNotificationTemplate(templateType, teacherId) {
    const templates = await all(`
      SELECT content FROM notification_templates 
      WHERE type = ? AND (teacher_id = ? OR is_global = 1)
      ORDER BY teacher_id DESC
      LIMIT 1
    `, [templateType, teacherId]);
    
    if (templates.length > 0) {
      return templates[0].content;
    }
    
    // Return a basic template if none found
    return `Hello {{guardian_name}}, this is a notification about {{student_name}}.`;
  }

  renderTemplate(template, variables) {
    let rendered = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      rendered = rendered.replace(regex, value || '');
    }
    return rendered;
  }

  async logNotification(attendanceId, channel, status, providerId, error, notificationType = null, studentId = null) {
    await run(`
      INSERT INTO notification_log 
      (attendance_id, student_id, channel, status, provider_id, error, notification_type, sent_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `, [attendanceId, studentId, channel, status, providerId, error, notificationType]);
  }
}

// Create and export singleton instance
const notificationScheduler = new NotificationScheduler();
export default notificationScheduler;