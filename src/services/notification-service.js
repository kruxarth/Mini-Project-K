import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { getDB } from '../db.js';

// Initialize Twilio client
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN 
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

// Initialize Nodemailer transporter
const emailTransporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

class NotificationService {
  constructor() {
    this.db = getDB();
  }

  // Send SMS notification
  async sendSMS(to, message, studentName = '') {
    if (!twilioClient || !process.env.TWILIO_PHONE_NUMBER) {
      console.log('Twilio not configured, SMS not sent:', message);
      return { success: false, error: 'Twilio not configured' };
    }

    try {
      const result = await twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: to
      });

      // Log notification
      await this.logNotification('sms', to, message, studentName, 'sent');
      
      return { success: true, messageId: result.sid };
    } catch (error) {
      console.error('SMS sending failed:', error);
      await this.logNotification('sms', to, message, studentName, 'failed', error.message);
      return { success: false, error: error.message };
    }
  }

  // Send Email notification
  async sendEmail(to, subject, htmlContent, studentName = '') {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('Email not configured, email not sent:', subject);
      return { success: false, error: 'Email not configured' };
    }

    try {
      const mailOptions = {
        from: `"${process.env.SCHOOL_NAME || 'Attendance System'}" <${process.env.EMAIL_USER}>`,
        to: to,
        subject: subject,
        html: htmlContent
      };

      const result = await emailTransporter.sendMail(mailOptions);
      
      // Log notification
      await this.logNotification('email', to, subject, studentName, 'sent');
      
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Email sending failed:', error);
      await this.logNotification('email', to, subject, studentName, 'failed', error.message);
      return { success: false, error: error.message };
    }
  }

  // Log notification to database
  async logNotification(type, recipient, content, studentName, status, errorMessage = null) {
    try {
      await this.db.run(`
        INSERT INTO notifications_log (type, recipient, content, student_name, status, error_message, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `, [type, recipient, content, studentName, status, errorMessage]);
    } catch (error) {
      console.error('Failed to log notification:', error);
    }
  }

  // Send absence notification
  async sendAbsenceNotification(student, date) {
    const messages = [];
    
    // SMS notification
    if (student.parent_phone) {
      const smsMessage = `Dear Parent, ${student.name} was marked absent on ${date}. Please contact the school if this is incorrect. - ${process.env.SCHOOL_NAME || 'School'}`;
      const smsResult = await this.sendSMS(student.parent_phone, smsMessage, student.name);
      messages.push({ type: 'sms', success: smsResult.success, error: smsResult.error });
      
      // Create alert for failed SMS
      if (!smsResult.success) {
        const AlertService = (await import('./alert-service.js')).default;
        await AlertService.alertNotificationFailed(student.teacher_id, student.name, `SMS: ${smsResult.error}`);
      }
    }

    // Email notification
    if (student.parent_email) {
      const subject = `Absence Notification - ${student.name}`;
      const htmlContent = this.generateAbsenceEmailTemplate(student, date);
      const emailResult = await this.sendEmail(student.parent_email, subject, htmlContent, student.name);
      messages.push({ type: 'email', success: emailResult.success, error: emailResult.error });
      
      // Create alert for failed email
      if (!emailResult.success) {
        const AlertService = (await import('./alert-service.js')).default;
        await AlertService.alertNotificationFailed(student.teacher_id, student.name, `Email: ${emailResult.error}`);
      }
    }

    // Create success alert if at least one notification was sent
    const successCount = messages.filter(m => m.success).length;
    if (successCount > 0) {
      const AlertService = (await import('./alert-service.js')).default;
      await AlertService.alertStudentAbsent(student.teacher_id, student.name, date, student.class_id, student.id);
    }

    return messages;
  }

  // Send low attendance alert
  async sendLowAttendanceAlert(student, attendancePercentage) {
    const messages = [];
    
    // SMS notification
    if (student.parent_phone) {
      const smsMessage = `ALERT: ${student.name}'s attendance is ${attendancePercentage}% which is below the required minimum. Please ensure regular attendance. - ${process.env.SCHOOL_NAME || 'School'}`;
      const smsResult = await this.sendSMS(student.parent_phone, smsMessage, student.name);
      messages.push({ type: 'sms', success: smsResult.success, error: smsResult.error });
    }

    // Email notification
    if (student.parent_email) {
      const subject = `Low Attendance Alert - ${student.name}`;
      const htmlContent = this.generateLowAttendanceEmailTemplate(student, attendancePercentage);
      const emailResult = await this.sendEmail(student.parent_email, subject, htmlContent, student.name);
      messages.push({ type: 'email', success: emailResult.success, error: emailResult.error });
    }

    return messages;
  }

  // Send weekly attendance report
  async sendWeeklyReport(student, weeklyData) {
    const messages = [];
    
    // Email notification (weekly reports are better via email)
    if (student.parent_email) {
      const subject = `Weekly Attendance Report - ${student.name}`;
      const htmlContent = this.generateWeeklyReportEmailTemplate(student, weeklyData);
      const emailResult = await this.sendEmail(student.parent_email, subject, htmlContent, student.name);
      messages.push({ type: 'email', success: emailResult.success, error: emailResult.error });
    }

    // Optional SMS summary
    if (student.parent_phone && weeklyData.attendancePercentage < 80) {
      const smsMessage = `Weekly Report: ${student.name} attended ${weeklyData.presentDays}/${weeklyData.totalDays} days this week (${weeklyData.attendancePercentage}%). - ${process.env.SCHOOL_NAME || 'School'}`;
      const smsResult = await this.sendSMS(student.parent_phone, smsMessage, student.name);
      messages.push({ type: 'sms', success: smsResult.success, error: smsResult.error });
    }

    return messages;
  }

  // Send monthly attendance report
  async sendMonthlyReport(student, monthlyData) {
    const messages = [];
    
    // Email notification
    if (student.parent_email) {
      const subject = `Monthly Attendance Report - ${student.name}`;
      const htmlContent = this.generateMonthlyReportEmailTemplate(student, monthlyData);
      const emailResult = await this.sendEmail(student.parent_email, subject, htmlContent, student.name);
      messages.push({ type: 'email', success: emailResult.success, error: emailResult.error });
    }

    return messages;
  }

  // Send custom message
  async sendCustomMessage(recipients, subject, message, type = 'both') {
    const results = [];
    
    for (const recipient of recipients) {
      const messages = [];
      
      if ((type === 'sms' || type === 'both') && recipient.phone) {
        const smsResult = await this.sendSMS(recipient.phone, message, recipient.studentName);
        messages.push({ type: 'sms', success: smsResult.success, error: smsResult.error });
      }
      
      if ((type === 'email' || type === 'both') && recipient.email) {
        const htmlContent = this.generateCustomMessageEmailTemplate(subject, message, recipient.studentName);
        const emailResult = await this.sendEmail(recipient.email, subject, htmlContent, recipient.studentName);
        messages.push({ type: 'email', success: emailResult.success, error: emailResult.error });
      }
      
      results.push({
        recipient: recipient.email || recipient.phone,
        studentName: recipient.studentName,
        messages
      });
    }
    
    return results;
  }

  // Email Templates
  generateAbsenceEmailTemplate(student, date) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc3545; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f8f9fa; }
          .footer { padding: 20px; text-align: center; color: #666; }
          .alert { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Absence Notification</h2>
          </div>
          <div class="content">
            <div class="alert">
              <strong>Student:</strong> ${student.name}<br>
              <strong>Class:</strong> ${student.class_name || 'N/A'}<br>
              <strong>Date:</strong> ${date}<br>
              <strong>Status:</strong> Absent
            </div>
            <p>Dear Parent/Guardian,</p>
            <p>This is to inform you that <strong>${student.name}</strong> was marked absent on <strong>${date}</strong>.</p>
            <p>If this is incorrect or if there was a valid reason for the absence, please contact the school administration immediately.</p>
            <p>Regular attendance is crucial for your child's academic success.</p>
          </div>
          <div class="footer">
            <p>${process.env.SCHOOL_NAME || 'School Name'}<br>
            Contact: ${process.env.SCHOOL_PHONE || 'N/A'} | Email: ${process.env.SCHOOL_EMAIL || process.env.EMAIL_USER}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  generateLowAttendanceEmailTemplate(student, attendancePercentage) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #ffc107; color: #212529; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f8f9fa; }
          .footer { padding: 20px; text-align: center; color: #666; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .stats { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>⚠️ Low Attendance Alert</h2>
          </div>
          <div class="content">
            <div class="warning">
              <strong>Student:</strong> ${student.name}<br>
              <strong>Class:</strong> ${student.class_name || 'N/A'}<br>
              <strong>Current Attendance:</strong> ${attendancePercentage}%
            </div>
            <p>Dear Parent/Guardian,</p>
            <p>We would like to bring to your attention that <strong>${student.name}</strong>'s attendance has fallen below the required minimum.</p>
            <div class="stats">
              <h4>Attendance Summary:</h4>
              <p><strong>Current Attendance Rate:</strong> ${attendancePercentage}%</p>
              <p><strong>Required Minimum:</strong> 75%</p>
              <p style="color: #dc3545;"><strong>Status:</strong> Below Required Level</p>
            </div>
            <p>Regular attendance is essential for academic success. We encourage you to:</p>
            <ul>
              <li>Ensure your child attends school regularly</li>
              <li>Contact us if there are any issues affecting attendance</li>
              <li>Work with us to improve attendance patterns</li>
            </ul>
            <p>Please feel free to contact us to discuss this matter further.</p>
          </div>
          <div class="footer">
            <p>${process.env.SCHOOL_NAME || 'School Name'}<br>
            Contact: ${process.env.SCHOOL_PHONE || 'N/A'} | Email: ${process.env.SCHOOL_EMAIL || process.env.EMAIL_USER}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  generateWeeklyReportEmailTemplate(student, weeklyData) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #007bff; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f8f9fa; }
          .footer { padding: 20px; text-align: center; color: #666; }
          .report-card { background: white; padding: 20px; border-radius: 5px; margin: 15px 0; }
          .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; margin: 20px 0; }
          .stat-item { text-align: center; padding: 15px; background: #e9ecef; border-radius: 5px; }
          .stat-number { font-size: 24px; font-weight: bold; color: #007bff; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>📊 Weekly Attendance Report</h2>
            <p>Week of ${weeklyData.weekStart} to ${weeklyData.weekEnd}</p>
          </div>
          <div class="content">
            <div class="report-card">
              <h3>${student.name} - ${student.class_name || 'N/A'}</h3>
              <div class="stats-grid">
                <div class="stat-item">
                  <div class="stat-number">${weeklyData.presentDays}</div>
                  <div>Present</div>
                </div>
                <div class="stat-item">
                  <div class="stat-number">${weeklyData.absentDays}</div>
                  <div>Absent</div>
                </div>
                <div class="stat-item">
                  <div class="stat-number">${weeklyData.lateDays}</div>
                  <div>Late</div>
                </div>
                <div class="stat-item">
                  <div class="stat-number">${weeklyData.attendancePercentage}%</div>
                  <div>Attendance</div>
                </div>
              </div>
              ${weeklyData.dailyRecords ? `
                <h4>Daily Breakdown:</h4>
                <ul>
                  ${weeklyData.dailyRecords.map(day => `
                    <li><strong>${day.date}:</strong> ${day.status}</li>
                  `).join('')}
                </ul>
              ` : ''}
            </div>
          </div>
          <div class="footer">
            <p>${process.env.SCHOOL_NAME || 'School Name'}<br>
            Contact: ${process.env.SCHOOL_PHONE || 'N/A'} | Email: ${process.env.SCHOOL_EMAIL || process.env.EMAIL_USER}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  generateMonthlyReportEmailTemplate(student, monthlyData) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #28a745; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f8f9fa; }
          .footer { padding: 20px; text-align: center; color: #666; }
          .report-card { background: white; padding: 20px; border-radius: 5px; margin: 15px 0; }
          .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; margin: 20px 0; }
          .stat-item { text-align: center; padding: 15px; background: #e9ecef; border-radius: 5px; }
          .stat-number { font-size: 24px; font-weight: bold; color: #28a745; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>📈 Monthly Attendance Report</h2>
            <p>${monthlyData.monthName} ${monthlyData.year}</p>
          </div>
          <div class="content">
            <div class="report-card">
              <h3>${student.name} - ${student.class_name || 'N/A'}</h3>
              <div class="stats-grid">
                <div class="stat-item">
                  <div class="stat-number">${monthlyData.totalDays}</div>
                  <div>Total Days</div>
                </div>
                <div class="stat-item">
                  <div class="stat-number">${monthlyData.presentDays}</div>
                  <div>Present</div>
                </div>
                <div class="stat-item">
                  <div class="stat-number">${monthlyData.absentDays}</div>
                  <div>Absent</div>
                </div>
                <div class="stat-item">
                  <div class="stat-number">${monthlyData.attendancePercentage}%</div>
                  <div>Attendance</div>
                </div>
              </div>
              <p><strong>Performance:</strong> 
                ${monthlyData.attendancePercentage >= 90 ? '🌟 Excellent' : 
                  monthlyData.attendancePercentage >= 80 ? '👍 Good' : 
                  monthlyData.attendancePercentage >= 70 ? '⚠️ Needs Improvement' : '🚨 Critical'}
              </p>
            </div>
          </div>
          <div class="footer">
            <p>${process.env.SCHOOL_NAME || 'School Name'}<br>
            Contact: ${process.env.SCHOOL_PHONE || 'N/A'} | Email: ${process.env.SCHOOL_EMAIL || process.env.EMAIL_USER}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  generateCustomMessageEmailTemplate(subject, message, studentName) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #6c757d; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f8f9fa; }
          .footer { padding: 20px; text-align: center; color: #666; }
          .message { background: white; padding: 20px; border-radius: 5px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>${subject}</h2>
          </div>
          <div class="content">
            <p>Dear Parent/Guardian,</p>
            ${studentName ? `<p><strong>Regarding:</strong> ${studentName}</p>` : ''}
            <div class="message">
              ${message.replace(/\n/g, '<br>')}
            </div>
          </div>
          <div class="footer">
            <p>${process.env.SCHOOL_NAME || 'School Name'}<br>
            Contact: ${process.env.SCHOOL_PHONE || 'N/A'} | Email: ${process.env.SCHOOL_EMAIL || process.env.EMAIL_USER}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

export default new NotificationService();