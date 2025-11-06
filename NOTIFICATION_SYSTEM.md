# 📧 Automated Notification System

## Overview

The AttendanceMS notification system provides comprehensive automated communication with parents and guardians through email and SMS. The system sends real-time absence alerts, low attendance warnings, and scheduled attendance reports.

## ✨ Key Features

### 🚨 **Immediate Notifications**
- **Absence Alerts**: Instant notifications when students are marked absent
- **Real-time Delivery**: Notifications sent within minutes of attendance marking
- **Multi-channel Support**: Email and SMS delivery options
- **Customizable Templates**: Personalized message templates

### 📊 **Scheduled Reports**
- **Weekly Reports**: Comprehensive weekly attendance summaries
- **Monthly Reports**: Detailed monthly performance analysis
- **Automated Delivery**: Scheduled delivery on specific days and times
- **Visual Analytics**: Charts and statistics in email reports

### ⚠️ **Smart Alerts**
- **Low Attendance Warnings**: Automatic alerts when attendance drops below threshold
- **Configurable Thresholds**: Customizable attendance percentage limits
- **Trend Analysis**: 30-day attendance pattern monitoring
- **Preventive Intervention**: Early warning system for at-risk students

### 🎯 **Advanced Features**
- **Guardian Preferences**: Respect individual communication preferences
- **Template Customization**: School-specific message templates
- **Delivery Tracking**: Complete notification history and status
- **Failure Handling**: Automatic retry and error logging

## 🔧 Configuration

### Environment Variables

```env
# Email Configuration (Required for email notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_school_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM="Your School Name <no-reply@yourschool.com>"

# SMS Configuration (Required for SMS notifications)
TWILIO_SID=your_twilio_account_sid
TWILIO_TOKEN=your_twilio_auth_token
TWILIO_FROM=+1234567890
```

### Gmail Setup for Schools

1. **Create School Gmail Account**
   ```
   Create: attendance@yourschool.edu
   Enable: 2-Factor Authentication
   ```

2. **Generate App Password**
   ```
   Google Account → Security → App Passwords
   Select: Mail → Generate Password
   Use: Generated password in SMTP_PASS
   ```

3. **Configure School Domain**
   ```
   Set SMTP_FROM: "Your School <attendance@yourschool.edu>"
   ```

### Twilio Setup for SMS

1. **Create Twilio Account**
   ```
   Sign up: https://www.twilio.com/
   Verify: Phone number for account
   ```

2. **Get Credentials**
   ```
   Account SID: Found in Twilio Console
   Auth Token: Found in Twilio Console
   Phone Number: Purchase or use trial number
   ```

3. **Configure Webhook (Optional)**
   ```
   Delivery Status: Track SMS delivery status
   Webhook URL: https://yourapp.com/twilio/webhook
   ```

## 📱 Notification Types

### 1. **Absence Alerts**

**Trigger**: Student marked absent
**Timing**: Immediate (within 5 minutes)
**Channels**: Email + SMS
**Template Variables**:
- `{{student_name}}` - Student's full name
- `{{guardian_name}}` - Guardian's name
- `{{class_name}}` - Class name
- `{{section}}` - Class section
- `{{date}}` - Absence date
- `{{roll_number}}` - Student's roll number

**Email Template**:
```html
<h2>🚨 Absence Alert</h2>
<p>Dear {{guardian_name}},</p>
<p>{{student_name}} (Roll: {{roll_number}}) was marked absent 
in {{class_name}}-{{section}} on {{date}}.</p>
<p>If this is an error, please contact the school immediately.</p>
```

**SMS Template**:
```
🚨 ABSENCE: {{student_name}} ({{roll_number}}) absent from 
{{class_name}}-{{section}} on {{date}}. Contact school if error.
```

### 2. **Low Attendance Alerts**

**Trigger**: Attendance below threshold (default 75%)
**Timing**: Weekly (Mondays at 9 AM)
**Channels**: Email + SMS
**Analysis Period**: Last 30 days
**Minimum Days**: 10 days of data required

**Template Variables**:
- `{{attendance_rate}}` - Current attendance percentage
- `{{threshold}}` - Required minimum percentage
- `{{present_days}}` - Days present
- `{{total_days}}` - Total school days
- `{{student_name}}` - Student's name
- `{{guardian_name}}` - Guardian's name
- `{{class_name}}` - Class name
- `{{section}}` - Class section

### 3. **Weekly Reports**

**Trigger**: Scheduled (Fridays at 5 PM)
**Content**: 7-day attendance summary
**Channels**: Email (detailed) + SMS (summary)
**Format**: HTML email with charts

**Report Includes**:
- Total school days
- Days present/absent/late
- Attendance percentage
- Visual progress chart
- Motivational messages

### 4. **Monthly Reports**

**Trigger**: Scheduled (1st of month at 6 PM)
**Content**: 30-day comprehensive analysis
**Channels**: Email (detailed) + SMS (summary)
**Format**: Professional PDF-style HTML

**Report Includes**:
- Monthly attendance trends
- Comparison with previous month
- Achievement badges
- Improvement suggestions
- School calendar integration

## ⚙️ Settings Configuration

### Teacher Settings

Access: `Dashboard → Notifications`

**Communication Channels**:
- ✅ Email Notifications
- ✅ SMS Notifications

**Alert Types**:
- ✅ Immediate Absence Alerts
- ✅ Low Attendance Alerts
- ✅ Weekly Reports
- ⬜ Monthly Reports

**Thresholds & Timing**:
- Low Attendance Threshold: `75%`
- Weekly Report Day: `Friday`
- Report Time: `17:00`

### Guardian Preferences

**Preferred Channel**:
- `email` - Email only
- `sms` - SMS only
- `both` - Email and SMS
- `none` - No notifications

**Contact Information**:
```sql
-- Guardian table structure
guardians (
  id, student_id, name, email, phone, 
  preferred_channel, timezone, created_at
)
```

## 🔄 Automated Scheduling

### Cron Jobs

```javascript
// Daily absence notifications (school hours)
'0 8-17 * * 1-5' → Every hour, 8 AM to 5 PM, weekdays

// Weekly reports (Friday evening)
'0 17 * * 5' → Every Friday at 5:00 PM

// Monthly reports (1st of month)
'0 18 1 * *' → 1st day of month at 6:00 PM

// Low attendance alerts (Monday morning)
'0 9 * * 1' → Every Monday at 9:00 AM

// Custom schedules check
'0 * * * *' → Every hour (check custom schedules)
```

### Custom Schedules

Teachers can create custom notification schedules:

```sql
-- Scheduled notifications table
scheduled_notifications (
  teacher_id, notification_type, schedule_type,
  schedule_day, schedule_time, is_active,
  last_run, next_run
)
```

**Example Custom Schedules**:
- Daily attendance reminders at 8 AM
- Bi-weekly progress reports
- Holiday attendance notices
- Exam period special alerts

## 📊 Analytics & Tracking

### Delivery Statistics

**Real-time Metrics**:
- Emails sent today: `127`
- SMS sent today: `89`
- Alerts sent this week: `456`
- Delivery success rate: `98.2%`

**Historical Analysis**:
- Monthly delivery trends
- Channel preference analysis
- Error rate monitoring
- Guardian engagement metrics

### Notification Log

```sql
-- Complete notification tracking
notification_log (
  attendance_id, student_id, channel, status,
  provider_id, error, notification_type, sent_at
)
```

**Status Types**:
- `sent` - Successfully delivered
- `failed` - Delivery failed
- `pending` - Queued for delivery
- `bounced` - Email bounced
- `undelivered` - SMS undelivered

## 🛠️ API Endpoints

### Manual Notifications

```javascript
// Send absence notifications for specific class/date
POST /notifications/send-absence
{
  "classId": 1,
  "date": "2024-01-15"
}

// Send low attendance alerts for teacher
POST /notifications/send-low-attendance

// Send reports (weekly/monthly)
POST /notifications/send-reports
{
  "reportType": "weekly"
}
```

### Settings Management

```javascript
// Update notification settings
POST /notifications/settings
{
  "email_enabled": true,
  "sms_enabled": true,
  "absence_alerts": true,
  "low_attendance_threshold": 75,
  "weekly_reports": true,
  "report_day": "friday",
  "report_time": "17:00"
}

// Get notification history
GET /notifications/history?limit=50&type=absence
```

## 🎨 Template Customization

### Email Templates

**HTML Structure**:
```html
<div style="font-family: Arial; max-width: 600px; margin: 0 auto;">
  <div style="background: white; padding: 30px; border-radius: 10px;">
    <!-- Header with school logo -->
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #e74c3c;">🚨 Absence Alert</h1>
    </div>
    
    <!-- Content with variables -->
    <p>Dear <strong>{{guardian_name}}</strong>,</p>
    <div style="background: #fff5f5; padding: 20px; border-radius: 5px;">
      <p>{{student_name}} was marked absent...</p>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; margin-top: 30px;">
      <p style="color: #999; font-size: 12px;">
        Automated message from School Attendance System
      </p>
    </div>
  </div>
</div>
```

**CSS Styling**:
- Responsive design for mobile devices
- School branding colors and fonts
- Professional layout with clear hierarchy
- Accessibility-compliant contrast ratios

### SMS Templates

**Character Limits**:
- Standard SMS: 160 characters
- Extended SMS: 1600 characters (multiple parts)
- Unicode SMS: 70 characters (for emojis)

**Best Practices**:
```
✅ Good: "ABSENCE: John (Roll 15) absent from Math-A today. Contact school if error."

❌ Too long: "Dear Parent, We are writing to inform you that your child John Smith with roll number 15 was marked absent in Mathematics class section A today. If this is an error please contact the school administration immediately."

✅ With emoji: "🚨 ABSENCE: John absent from Math-A today. Call school if error."
```

## 🔒 Security & Privacy

### Data Protection

**Encryption**:
- Email content encrypted in transit (TLS)
- SMS content encrypted by Twilio
- Database credentials encrypted at rest
- API keys stored in environment variables

**Privacy Compliance**:
- GDPR-compliant data handling
- Opt-out mechanisms for guardians
- Data retention policies (90 days for logs)
- Consent tracking for communications

**Access Control**:
- Teacher-specific notification settings
- Guardian preference management
- Admin oversight and monitoring
- Audit trails for all notifications

### Error Handling

**Graceful Failures**:
```javascript
try {
  await sendNotification(student);
} catch (error) {
  // Log error for admin review
  await logNotificationError(error);
  
  // Try alternative channel
  if (error.channel === 'email') {
    await sendSMSBackup(student);
  }
  
  // Don't crash the system
  console.error('Notification failed:', error);
}
```

**Retry Logic**:
- Automatic retry for temporary failures
- Exponential backoff for rate limits
- Dead letter queue for persistent failures
- Manual retry interface for admins

## 📈 Performance Optimization

### Batch Processing

**Efficient Delivery**:
```javascript
// Process notifications in batches
const batchSize = 50;
const notifications = await getQueuedNotifications();

for (let i = 0; i < notifications.length; i += batchSize) {
  const batch = notifications.slice(i, i + batchSize);
  await Promise.all(batch.map(sendNotification));
  
  // Rate limiting pause
  await sleep(1000);
}
```

**Database Optimization**:
- Indexed queries for fast lookups
- Connection pooling for concurrent requests
- Cached templates for repeated use
- Async processing for non-blocking operations

### Scalability

**Horizontal Scaling**:
- Queue-based notification processing
- Redis for distributed job management
- Load balancing for multiple servers
- Microservice architecture ready

**Monitoring**:
- Real-time delivery monitoring
- Performance metrics dashboard
- Alert thresholds for system health
- Automated scaling triggers

## 🚀 Future Enhancements

### Planned Features

**Advanced Analytics**:
- Machine learning for optimal send times
- Predictive analytics for attendance patterns
- A/B testing for message effectiveness
- Sentiment analysis for guardian responses

**Enhanced Communication**:
- WhatsApp Business API integration
- Voice call notifications for critical alerts
- Push notifications for mobile app
- Interactive SMS with quick responses

**Smart Automation**:
- AI-powered message personalization
- Automatic language translation
- Behavioral trigger notifications
- Predictive absence alerts

**Integration Capabilities**:
- Google Calendar integration
- Microsoft Teams notifications
- Slack alerts for teachers
- Zapier automation workflows

### Technical Roadmap

**Q1 2024**:
- ✅ Basic email/SMS notifications
- ✅ Template customization
- ✅ Scheduled reports
- ✅ Delivery tracking

**Q2 2024**:
- 🔄 WhatsApp integration
- 🔄 Advanced analytics dashboard
- 🔄 Mobile app push notifications
- 🔄 Multi-language support

**Q3 2024**:
- 📋 AI-powered personalization
- 📋 Voice call notifications
- 📋 Interactive response handling
- 📋 Advanced scheduling options

**Q4 2024**:
- 📋 Machine learning insights
- 📋 Predictive analytics
- 📋 Third-party integrations
- 📋 Enterprise features

---

**🎉 The Automated Notification System ensures no parent is left uninformed about their child's attendance, creating a connected and engaged school community!**