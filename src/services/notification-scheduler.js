import cron from 'node-cron';
import { getDB } from '../db.js';
import NotificationService from './notification-service.js';

class NotificationScheduler {
  constructor() {
    this.db = getDB();
    this.jobs = new Map();
  }

  // Initialize all scheduled jobs
  init() {
    console.log('Initializing notification scheduler...');
    
    // Check for low attendance daily at 6 PM
    this.scheduleJob('low-attendance-check', '0 18 * * *', () => {
      this.checkLowAttendance();
    });

    // Send weekly reports every Friday at 5 PM
    this.scheduleJob('weekly-reports', '0 17 * * 5', () => {
      this.sendWeeklyReports();
    });

    // Send monthly reports on the last day of each month at 6 PM
    this.scheduleJob('monthly-reports', '0 18 L * *', () => {
      this.sendMonthlyReports();
    });

    // Daily absence notifications at 4 PM (for today's absences)
    this.scheduleJob('daily-absence-check', '0 16 * * *', () => {
      this.sendDailyAbsenceNotifications();
    });

    console.log('Notification scheduler initialized with', this.jobs.size, 'jobs');
  }

  // Schedule a cron job
  scheduleJob(name, cronExpression, callback) {
    try {
      const job = cron.schedule(cronExpression, callback, {
        scheduled: false,
        timezone: process.env.TIMEZONE || 'Asia/Kolkata'
      });
      
      this.jobs.set(name, job);
      job.start();
      console.log(`Scheduled job: ${name} with expression: ${cronExpression}`);
    } catch (error) {
      console.error(`Failed to schedule job ${name}:`, error);
    }
  }

  // Check for students with low attendance and send alerts
  async checkLowAttendance() {
    console.log('Running low attendance check...');
    
    try {
      // Get all teachers with low attendance alerts enabled
      const teachers = await this.db.all(`
        SELECT t.id, t.name, ns.low_attendance_threshold
        FROM teachers t
        JOIN notification_settings ns ON t.id = ns.teacher_id
        WHERE ns.low_attendance_alerts = 1
      `);

      for (const teacher of teachers) {
        // Get students with low attendance for this teacher
        const studentsWithLowAttendance = await this.db.all(`
          SELECT 
            s.*,
            c.name as class_name,
            COUNT(a.id) as total_days,
            COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_days,
            ROUND(
              (COUNT(CASE WHEN a.status = 'present' THEN 1 END) * 100.0 / 
               NULLIF(COUNT(a.id), 0)), 2
            ) as attendance_percentage
          FROM students s
          JOIN classes c ON s.class_id = c.id
          LEFT JOIN attendance a ON s.id = a.student_id
          WHERE c.teacher_id = ?
            AND (s.parent_email IS NOT NULL OR s.parent_phone IS NOT NULL)
          GROUP BY s.id
          HAVING attendance_percentage < ? AND total_days >= 10
        `, [teacher.id, teacher.low_attendance_threshold]);

        // Send alerts for each student
        for (const student of studentsWithLowAttendance) {
          // Check if we've already sent an alert recently (within 7 days)
          const recentAlert = await this.db.get(`
            SELECT id FROM notifications_log
            WHERE student_name = ? 
              AND content LIKE '%Low Attendance%'
              AND created_at > datetime('now', '-7 days')
          `, [student.name]);

          if (!recentAlert) {
            await NotificationService.sendLowAttendanceAlert(student, student.attendance_percentage);
            console.log(`Sent low attendance alert for ${student.name} (${student.attendance_percentage}%)`);
          }
        }
      }
    } catch (error) {
      console.error('Error in low attendance check:', error);
    }
  }

  // Send weekly attendance reports
  async sendWeeklyReports() {
    console.log('Sending weekly reports...');
    
    try {
      // Get all teachers with weekly reports enabled
      const teachers = await this.db.all(`
        SELECT t.id, t.name
        FROM teachers t
        JOIN notification_settings ns ON t.id = ns.teacher_id
        WHERE ns.weekly_reports = 1
      `);

      for (const teacher of teachers) {
        // Get all students for this teacher
        const students = await this.db.all(`
          SELECT s.*, c.name as class_name
          FROM students s
          JOIN classes c ON s.class_id = c.id
          WHERE c.teacher_id = ?
            AND (s.parent_email IS NOT NULL OR s.parent_phone IS NOT NULL)
        `, [teacher.id]);

        for (const student of students) {
          // Get weekly attendance data (last 7 days)
          const weeklyData = await this.getWeeklyAttendanceData(student.id);
          
          if (weeklyData.totalDays > 0) {
            await NotificationService.sendWeeklyReport(student, weeklyData);
            console.log(`Sent weekly report for ${student.name}`);
          }
        }
      }
    } catch (error) {
      console.error('Error sending weekly reports:', error);
    }
  }

  // Send monthly attendance reports
  async sendMonthlyReports() {
    console.log('Sending monthly reports...');
    
    try {
      // Get all teachers with monthly reports enabled
      const teachers = await this.db.all(`
        SELECT t.id, t.name
        FROM teachers t
        JOIN notification_settings ns ON t.id = ns.teacher_id
        WHERE ns.monthly_reports = 1
      `);

      for (const teacher of teachers) {
        // Get all students for this teacher
        const students = await this.db.all(`
          SELECT s.*, c.name as class_name
          FROM students s
          JOIN classes c ON s.class_id = c.id
          WHERE c.teacher_id = ?
            AND (s.parent_email IS NOT NULL OR s.parent_phone IS NOT NULL)
        `, [teacher.id]);

        for (const student of students) {
          // Get monthly attendance data
          const monthlyData = await this.getMonthlyAttendanceData(student.id);
          
          if (monthlyData.totalDays > 0) {
            await NotificationService.sendMonthlyReport(student, monthlyData);
            console.log(`Sent monthly report for ${student.name}`);
          }
        }
      }
    } catch (error) {
      console.error('Error sending monthly reports:', error);
    }
  }

  // Send daily absence notifications
  async sendDailyAbsenceNotifications() {
    console.log('Sending daily absence notifications...');
    
    try {
      // Get all teachers with absence notifications enabled
      const teachers = await this.db.all(`
        SELECT t.id, t.name
        FROM teachers t
        JOIN notification_settings ns ON t.id = ns.teacher_id
        WHERE ns.absence_notifications = 1
      `);

      for (const teacher of teachers) {
        // Get today's absent students for this teacher
        const absentStudents = await this.db.all(`
          SELECT s.*, c.name as class_name, a.date
          FROM students s
          JOIN classes c ON s.class_id = c.id
          JOIN attendance a ON s.id = a.student_id
          WHERE c.teacher_id = ?
            AND a.status = 'absent'
            AND DATE(a.date) = DATE('now')
            AND (s.parent_email IS NOT NULL OR s.parent_phone IS NOT NULL)
        `, [teacher.id]);

        for (const student of absentStudents) {
          // Check if we've already sent notification for this absence
          const existingNotification = await this.db.get(`
            SELECT id FROM notifications_log
            WHERE student_name = ? 
              AND content LIKE '%absent%'
              AND DATE(created_at) = DATE('now')
          `, [student.name]);

          if (!existingNotification) {
            const date = new Date(student.date).toLocaleDateString();
            await NotificationService.sendAbsenceNotification(student, date);
            console.log(`Sent absence notification for ${student.name} on ${date}`);
          }
        }
      }
    } catch (error) {
      console.error('Error sending daily absence notifications:', error);
    }
  }

  // Get weekly attendance data for a student
  async getWeeklyAttendanceData(studentId) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const weekEnd = new Date();

    const data = await this.db.get(`
      SELECT 
        COUNT(*) as totalDays,
        COUNT(CASE WHEN status = 'present' THEN 1 END) as presentDays,
        COUNT(CASE WHEN status = 'absent' THEN 1 END) as absentDays,
        COUNT(CASE WHEN status = 'late' THEN 1 END) as lateDays,
        ROUND(
          (COUNT(CASE WHEN status = 'present' THEN 1 END) * 100.0 / 
           NULLIF(COUNT(*), 0)), 2
        ) as attendancePercentage
      FROM attendance
      WHERE student_id = ?
        AND date >= date('now', '-7 days')
        AND date <= date('now')
    `, [studentId]);

    // Get daily records for the week
    const dailyRecords = await this.db.all(`
      SELECT DATE(date) as date, status
      FROM attendance
      WHERE student_id = ?
        AND date >= date('now', '-7 days')
        AND date <= date('now')
      ORDER BY date DESC
    `, [studentId]);

    return {
      ...data,
      weekStart: weekStart.toLocaleDateString(),
      weekEnd: weekEnd.toLocaleDateString(),
      dailyRecords
    };
  }

  // Get monthly attendance data for a student
  async getMonthlyAttendanceData(studentId) {
    const now = new Date();
    const monthName = now.toLocaleDateString('en-US', { month: 'long' });
    const year = now.getFullYear();

    const data = await this.db.get(`
      SELECT 
        COUNT(*) as totalDays,
        COUNT(CASE WHEN status = 'present' THEN 1 END) as presentDays,
        COUNT(CASE WHEN status = 'absent' THEN 1 END) as absentDays,
        COUNT(CASE WHEN status = 'late' THEN 1 END) as lateDays,
        ROUND(
          (COUNT(CASE WHEN status = 'present' THEN 1 END) * 100.0 / 
           NULLIF(COUNT(*), 0)), 2
        ) as attendancePercentage
      FROM attendance
      WHERE student_id = ?
        AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
    `, [studentId]);

    return {
      ...data,
      monthName,
      year
    };
  }

  // Stop a specific job
  stopJob(name) {
    const job = this.jobs.get(name);
    if (job) {
      job.stop();
      this.jobs.delete(name);
      console.log(`Stopped job: ${name}`);
    }
  }

  // Stop all jobs
  stopAll() {
    for (const [name, job] of this.jobs) {
      job.stop();
      console.log(`Stopped job: ${name}`);
    }
    this.jobs.clear();
    console.log('All notification jobs stopped');
  }

  // Get job status
  getJobStatus() {
    const status = {};
    for (const [name, job] of this.jobs) {
      status[name] = {
        running: job.running,
        scheduled: job.scheduled
      };
    }
    return status;
  }
}

export default new NotificationScheduler();