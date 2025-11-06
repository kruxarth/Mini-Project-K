import { run } from './db.js';

// Create notification-related tables
export async function createNotificationTables() {
  try {
    // Notification settings table
    await run(`
      CREATE TABLE IF NOT EXISTS notification_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        teacher_id INTEGER NOT NULL,
        email_enabled BOOLEAN DEFAULT 1,
        sms_enabled BOOLEAN DEFAULT 0,
        absence_alerts BOOLEAN DEFAULT 1,
        low_attendance_alerts BOOLEAN DEFAULT 1,
        weekly_reports BOOLEAN DEFAULT 1,
        monthly_reports BOOLEAN DEFAULT 0,
        low_attendance_threshold INTEGER DEFAULT 75,
        report_day TEXT DEFAULT 'friday',
        report_time TEXT DEFAULT '17:00',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (teacher_id) REFERENCES teachers (id) ON DELETE CASCADE,
        UNIQUE(teacher_id)
      )
    `);

    // Notification templates table
    await run(`
      CREATE TABLE IF NOT EXISTS notification_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        teacher_id INTEGER,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        is_global BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (teacher_id) REFERENCES teachers (id) ON DELETE CASCADE
      )
    `);

    // Update notification_log table to include more fields
    await run(`
      CREATE TABLE IF NOT EXISTS notification_log_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        attendance_id INTEGER,
        student_id INTEGER,
        channel TEXT NOT NULL,
        status TEXT NOT NULL,
        provider_id TEXT,
        error TEXT,
        notification_type TEXT,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (attendance_id) REFERENCES attendance (id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE
      )
    `);

    // Copy existing data if notification_log exists
    const existingTables = await run(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='notification_log'
    `);

    if (existingTables) {
      await run(`
        INSERT INTO notification_log_new (attendance_id, channel, status, provider_id, error, sent_at)
        SELECT attendance_id, channel, status, provider_id, error, sent_at
        FROM notification_log
      `);
      
      await run(`DROP TABLE IF EXISTS notification_log`);
    }

    await run(`ALTER TABLE notification_log_new RENAME TO notification_log`);

    // Scheduled notifications table
    await run(`
      CREATE TABLE IF NOT EXISTS scheduled_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        teacher_id INTEGER NOT NULL,
        notification_type TEXT NOT NULL,
        schedule_type TEXT NOT NULL, -- 'weekly', 'monthly', 'daily'
        schedule_day TEXT, -- 'monday', 'tuesday', etc. or day of month
        schedule_time TEXT NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        last_run DATETIME,
        next_run DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (teacher_id) REFERENCES teachers (id) ON DELETE CASCADE
      )
    `);

    // Notification preferences per guardian
    await run(`
      CREATE TABLE IF NOT EXISTS guardian_notification_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guardian_id INTEGER NOT NULL,
        absence_alerts BOOLEAN DEFAULT 1,
        low_attendance_alerts BOOLEAN DEFAULT 1,
        weekly_reports BOOLEAN DEFAULT 1,
        monthly_reports BOOLEAN DEFAULT 0,
        preferred_time TEXT DEFAULT '08:00',
        timezone TEXT DEFAULT 'UTC',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (guardian_id) REFERENCES guardians (id) ON DELETE CASCADE,
        UNIQUE(guardian_id)
      )
    `);

    // Insert default notification templates
    await insertDefaultTemplates();

    console.log('Notification tables created successfully');
    
  } catch (error) {
    console.error('Error creating notification tables:', error);
    throw error;
  }
}

// Insert default notification templates
async function insertDefaultTemplates() {
  const defaultTemplates = [
    {
      name: 'Absence Email Alert',
      type: 'absence_email',
      content: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
          <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #e74c3c; margin: 0; font-size: 28px;">🚨 Absence Alert</h1>
            </div>
            
            <p style="font-size: 16px; color: #333;">Dear <strong>{{guardian_name}}</strong>,</p>
            
            <div style="background: #fff5f5; border-left: 4px solid #e74c3c; padding: 20px; margin: 20px 0; border-radius: 5px;">
              <p style="margin: 0; font-size: 16px; color: #333;">
                We want to inform you that <strong>{{student_name}}</strong> (Roll No: <strong>{{roll_number}}</strong>) 
                was marked <strong style="color: #e74c3c;">ABSENT</strong> in <strong>{{class_name}} - {{section}}</strong> 
                on <strong>{{date}}</strong>.
              </p>
            </div>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3 style="color: #495057; margin-top: 0;">What to do next:</h3>
              <ul style="color: #666; line-height: 1.6;">
                <li>If this absence was planned, please ignore this message</li>
                <li>If this is an error, please contact the class teacher immediately</li>
                <li>If your child was sick, please provide a medical certificate</li>
                <li>For any questions, contact the school office</li>
              </ul>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              Regular attendance is crucial for your child's academic success. Thank you for your attention to this matter.
            </p>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                This is an automated message from the School Attendance Management System
              </p>
            </div>
          </div>
        </div>
      `,
      is_global: 1
    },
    {
      name: 'Absence SMS Alert',
      type: 'absence_sms',
      content: '🚨 ABSENCE ALERT: {{student_name}} ({{roll_number}}) was absent from {{class_name}}-{{section}} on {{date}}. If this is an error, please contact the school immediately.',
      is_global: 1
    },
    {
      name: 'Low Attendance Email Alert',
      type: 'low_attendance_email',
      content: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
          <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #f39c12; margin: 0; font-size: 28px;">⚠️ Low Attendance Alert</h1>
            </div>
            
            <p style="font-size: 16px; color: #333;">Dear <strong>{{guardian_name}}</strong>,</p>
            
            <p style="color: #666; line-height: 1.6;">
              We are writing to bring to your attention <strong>{{student_name}}</strong>'s attendance 
              in <strong>{{class_name}} - {{section}}</strong>.
            </p>
            
            <div style="background: #fff8e1; border-left: 4px solid #f39c12; padding: 25px; margin: 25px 0; border-radius: 5px;">
              <h3 style="color: #f39c12; margin-top: 0; font-size: 20px;">📊 Attendance Summary (Last 30 Days)</h3>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px;">
                <div style="text-align: center; padding: 15px; background: white; border-radius: 5px;">
                  <div style="font-size: 24px; font-weight: bold; color: #f39c12;">{{attendance_rate}}%</div>
                  <div style="color: #666; font-size: 14px;">Current Rate</div>
                </div>
                <div style="text-align: center; padding: 15px; background: white; border-radius: 5px;">
                  <div style="font-size: 24px; font-weight: bold; color: #27ae60;">{{threshold}}%</div>
                  <div style="color: #666; font-size: 14px;">Required Minimum</div>
                </div>
              </div>
              <div style="margin-top: 15px; text-align: center;">
                <strong>{{present_days}}</strong> days present out of <strong>{{total_days}}</strong> total days
              </div>
            </div>
            
            <div style="background: #e8f5e8; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3 style="color: #27ae60; margin-top: 0;">📚 Why Regular Attendance Matters:</h3>
              <ul style="color: #666; line-height: 1.6; margin: 0;">
                <li>Consistent learning and academic progress</li>
                <li>Better understanding of concepts and lessons</li>
                <li>Improved social interaction with peers</li>
                <li>Meeting school attendance requirements</li>
              </ul>
            </div>
            
            <p style="color: #666; line-height: 1.6;">
              We kindly request you to ensure <strong>{{student_name}}</strong> attends school regularly going forward. 
              If there are any concerns or challenges affecting attendance, please don't hesitate to contact us.
            </p>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                This is an automated message from the School Attendance Management System
              </p>
            </div>
          </div>
        </div>
      `,
      is_global: 1
    },
    {
      name: 'Low Attendance SMS Alert',
      type: 'low_attendance_sms',
      content: '⚠️ LOW ATTENDANCE: {{student_name}} has {{attendance_rate}}% attendance ({{present_days}}/{{total_days}} days). Minimum required: {{threshold}}%. Please ensure regular attendance.',
      is_global: 1
    },
    {
      name: 'Weekly Report Email',
      type: 'weekly_report_email',
      content: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
          <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #3498db; margin: 0; font-size: 28px;">📅 Weekly Attendance Report</h1>
              <p style="color: #666; margin: 5px 0 0 0;">{{start_date}} to {{end_date}}</p>
            </div>
            
            <p style="font-size: 16px; color: #333;">Dear <strong>{{guardian_name}}</strong>,</p>
            
            <p style="color: #666; line-height: 1.6;">
              Here is <strong>{{student_name}}</strong>'s attendance summary for this week in 
              <strong>{{class_name}} - {{section}}</strong>:
            </p>
            
            <div style="background: #f8f9fa; padding: 25px; border-radius: 10px; margin: 25px 0;">
              <h3 style="color: #3498db; margin-top: 0; text-align: center;">📊 This Week's Summary</h3>
              
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0;">
                <div style="text-align: center; padding: 20px; background: white; border-radius: 8px; border: 2px solid #27ae60;">
                  <div style="font-size: 28px; font-weight: bold; color: #27ae60;">{{present_days}}</div>
                  <div style="color: #666; font-size: 14px;">Days Present</div>
                </div>
                <div style="text-align: center; padding: 20px; background: white; border-radius: 8px; border: 2px solid #e74c3c;">
                  <div style="font-size: 28px; font-weight: bold; color: #e74c3c;">{{absent_days}}</div>
                  <div style="color: #666; font-size: 14px;">Days Absent</div>
                </div>
                <div style="text-align: center; padding: 20px; background: white; border-radius: 8px; border: 2px solid #f39c12;">
                  <div style="font-size: 28px; font-weight: bold; color: #f39c12;">{{late_days}}</div>
                  <div style="color: #666; font-size: 14px;">Days Late</div>
                </div>
                <div style="text-align: center; padding: 20px; background: white; border-radius: 8px; border: 2px solid #3498db;">
                  <div style="font-size: 28px; font-weight: bold; color: #3498db;">{{attendance_rate}}%</div>
                  <div style="color: #666; font-size: 14px;">Attendance Rate</div>
                </div>
              </div>
              
              <div style="text-align: center; margin-top: 20px; padding: 15px; background: #e8f4fd; border-radius: 5px;">
                <strong style="color: #3498db;">Total School Days This Week: {{total_days}}</strong>
              </div>
            </div>
            
            <div style="background: #e8f5e8; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center;">
              <p style="margin: 0; color: #27ae60; font-weight: bold;">
                {{#if (gte attendance_rate 90)}}
                  🌟 Excellent attendance! Keep up the great work!
                {{else if (gte attendance_rate 75)}}
                  👍 Good attendance! Let's aim for even better next week!
                {{else}}
                  📈 Let's work together to improve attendance next week!
                {{/if}}
              </p>
            </div>
            
            <p style="color: #666; line-height: 1.6; text-align: center;">
              Thank you for supporting <strong>{{student_name}}</strong>'s education. 
              Regular attendance is key to academic success!
            </p>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                Weekly Report • {{class_name}} - {{section}} • School Attendance Management System
              </p>
            </div>
          </div>
        </div>
      `,
      is_global: 1
    },
    {
      name: 'Weekly Report SMS',
      type: 'weekly_report_sms',
      content: '📅 WEEKLY REPORT: {{student_name}} - {{attendance_rate}}% attendance this week ({{present_days}}/{{total_days}} days present). Keep up the great work! 🌟',
      is_global: 1
    },
    {
      name: 'Monthly Report Email',
      type: 'monthly_report_email',
      content: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
          <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #27ae60; margin: 0; font-size: 28px;">📊 Monthly Attendance Report</h1>
              <p style="color: #666; margin: 5px 0 0 0;">{{start_date}} to {{end_date}}</p>
            </div>
            
            <p style="font-size: 16px; color: #333;">Dear <strong>{{guardian_name}}</strong>,</p>
            
            <p style="color: #666; line-height: 1.6;">
              Here is <strong>{{student_name}}</strong>'s comprehensive attendance summary for this month in 
              <strong>{{class_name}} - {{section}}</strong>:
            </p>
            
            <div style="background: #f8f9fa; padding: 25px; border-radius: 10px; margin: 25px 0;">
              <h3 style="color: #27ae60; margin-top: 0; text-align: center;">📈 Monthly Performance Overview</h3>
              
              <div style="text-align: center; margin: 20px 0;">
                <div style="display: inline-block; padding: 25px; background: linear-gradient(135deg, #27ae60, #2ecc71); color: white; border-radius: 15px; margin: 10px;">
                  <div style="font-size: 36px; font-weight: bold;">{{attendance_rate}}%</div>
                  <div style="font-size: 16px; opacity: 0.9;">Overall Attendance</div>
                </div>
              </div>
              
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0;">
                <div style="text-align: center; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                  <div style="font-size: 24px; font-weight: bold; color: #27ae60;">{{present_days}}</div>
                  <div style="color: #666; font-size: 14px;">Days Present</div>
                </div>
                <div style="text-align: center; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                  <div style="font-size: 24px; font-weight: bold; color: #e74c3c;">{{absent_days}}</div>
                  <div style="color: #666; font-size: 14px;">Days Absent</div>
                </div>
                <div style="text-align: center; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                  <div style="font-size: 24px; font-weight: bold; color: #f39c12;">{{late_days}}</div>
                  <div style="color: #666; font-size: 14px;">Days Late</div>
                </div>
                <div style="text-align: center; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                  <div style="font-size: 24px; font-weight: bold; color: #3498db;">{{total_days}}</div>
                  <div style="color: #666; font-size: 14px;">Total School Days</div>
                </div>
              </div>
            </div>
            
            <div style="background: linear-gradient(135deg, #e8f5e8, #d4edda); padding: 25px; border-radius: 10px; margin: 25px 0; text-align: center;">
              <h3 style="color: #27ae60; margin-top: 0;">🎯 Monthly Achievement</h3>
              <p style="margin: 0; color: #155724; font-size: 16px; line-height: 1.6;">
                {{#if (gte attendance_rate 95)}}
                  🏆 Outstanding! {{student_name}} has excellent attendance this month!
                {{else if (gte attendance_rate 85)}}
                  🌟 Great job! {{student_name}} is maintaining good attendance!
                {{else if (gte attendance_rate 75)}}
                  👍 Good progress! Let's aim for even better attendance next month!
                {{else}}
                  📈 There's room for improvement. Let's work together for better attendance!
                {{/if}}
              </p>
            </div>
            
            <div style="background: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h4 style="color: #856404; margin-top: 0;">💡 Did You Know?</h4>
              <p style="color: #856404; margin: 0; line-height: 1.6;">
                Students with 95%+ attendance are 3x more likely to achieve their academic goals. 
                Every day at school counts towards your child's success!
              </p>
            </div>
            
            <p style="color: #666; line-height: 1.6; text-align: center;">
              We appreciate your continued support in ensuring <strong>{{student_name}}</strong>'s regular attendance. 
              Together, we can help them achieve their full potential!
            </p>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                Monthly Report • {{class_name}} - {{section}} • School Attendance Management System
              </p>
            </div>
          </div>
        </div>
      `,
      is_global: 1
    },
    {
      name: 'Monthly Report SMS',
      type: 'monthly_report_sms',
      content: '📊 MONTHLY REPORT: {{student_name}} achieved {{attendance_rate}}% attendance this month ({{present_days}}/{{total_days}} days). Thank you for your continued support! 🙏',
      is_global: 1
    }
  ];

  for (const template of defaultTemplates) {
    try {
      await run(`
        INSERT OR IGNORE INTO notification_templates (name, type, content, is_global)
        VALUES (?, ?, ?, ?)
      `, [template.name, template.type, template.content, template.is_global]);
    } catch (error) {
      console.error(`Error inserting template ${template.name}:`, error);
    }
  }
}

export { insertDefaultTemplates };