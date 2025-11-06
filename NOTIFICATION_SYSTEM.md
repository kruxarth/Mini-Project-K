# Automated Notification System

This attendance management system includes a comprehensive automated notification system that keeps parents informed about their children's attendance through SMS and Email.

## Features

### 🔔 Automated Notifications
- **Absence Alerts**: Instant notifications when a student is marked absent
- **Low Attendance Warnings**: Alerts when attendance drops below threshold
- **Weekly Reports**: Automated weekly attendance summaries
- **Monthly Reports**: Comprehensive monthly attendance reports

### 📱 Multi-Channel Communication
- **SMS Notifications**: Via Twilio integration
- **Email Notifications**: Via Nodemailer with HTML templates
- **Custom Messages**: Send announcements to parents

### ⚙️ Smart Scheduling
- **Daily Absence Check**: 4:00 PM daily
- **Low Attendance Check**: 6:00 PM daily  
- **Weekly Reports**: Every Friday at 5:00 PM
- **Monthly Reports**: Last day of month at 6:00 PM

## Setup Instructions

### 1. Install Dependencies
```bash
npm install nodemailer twilio node-cron
```

### 2. Environment Configuration
Copy `.env.example` to `.env` and configure:

```env
# Email Configuration
EMAIL_SERVICE=gmail
EMAIL_USER=your_school_email@gmail.com
EMAIL_PASS=your_app_password

# Twilio SMS Configuration
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# School Information
SCHOOL_NAME=Your School Name
SCHOOL_PHONE=+91-xxx-xxxxxxx
SCHOOL_EMAIL=info@yourschool.edu
```

### 3. Email Setup (Gmail)
1. Enable 2-Factor Authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account Settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
   - Use this password in `EMAIL_PASS`

### 4. Twilio SMS Setup
1. Create a Twilio account at [twilio.com](https://twilio.com)
2. Get your Account SID and Auth Token from the dashboard
3. Purchase a phone number for sending SMS
4. Add credentials to your `.env` file

## Usage

### Teacher Dashboard
1. Navigate to **Notifications** from the sidebar
2. Configure notification settings:
   - Enable/disable different notification types
   - Set low attendance threshold (default: 75%)
   - Test SMS and Email functionality

### Automated Triggers
- **Absence notifications** are sent automatically when attendance is marked
- **Low attendance alerts** are checked daily and sent when threshold is crossed
- **Weekly/Monthly reports** are sent according to schedule

### Custom Messages
1. Go to Notifications → Send Message
2. Choose recipients (all parents or specific class)
3. Select message type (SMS, Email, or Both)
4. Compose and send message

## Notification Templates

### Absence Notification
**SMS**: "Dear Parent, [Student Name] was marked absent on [Date]. Please contact school if incorrect."

**Email**: Professional HTML template with school branding and contact information.

### Low Attendance Alert
**SMS**: "ALERT: [Student Name]'s attendance is [X]% which is below required minimum."

**Email**: Detailed report with attendance breakdown and improvement suggestions.

### Weekly/Monthly Reports
**Email**: Comprehensive HTML reports with:
- Attendance statistics
- Daily/Monthly breakdown
- Performance indicators
- Parent contact information

## Database Tables

### notification_settings
Stores per-teacher notification preferences:
- `absence_notifications`: Enable/disable absence alerts
- `low_attendance_alerts`: Enable/disable low attendance warnings
- `weekly_reports`: Enable/disable weekly reports
- `monthly_reports`: Enable/disable monthly reports
- `low_attendance_threshold`: Percentage threshold for alerts

### notifications_log
Tracks all sent notifications:
- `type`: 'sms' or 'email'
- `recipient`: Phone number or email address
- `content`: Message content
- `student_name`: Associated student
- `status`: 'sent' or 'failed'
- `error_message`: Error details if failed

## API Endpoints

### Notification Management
- `GET /notifications` - Notification dashboard
- `POST /notifications/settings` - Update notification settings
- `POST /notifications/send-message` - Send custom message
- `POST /notifications/test` - Test SMS/Email functionality

### Automated Triggers
- `POST /api/notifications/absence` - Trigger absence notification
- `POST /api/notifications/low-attendance` - Trigger low attendance alert

## Scheduled Jobs

The system uses `node-cron` for scheduling:

```javascript
// Daily absence check at 4 PM
'0 16 * * *'

// Low attendance check at 6 PM daily
'0 18 * * *'

// Weekly reports every Friday at 5 PM
'0 17 * * 5'

// Monthly reports on last day of month at 6 PM
'0 18 L * *'
```

## Troubleshooting

### Email Issues
- Verify Gmail App Password is correct
- Check if 2FA is enabled on Gmail account
- Ensure EMAIL_SERVICE matches your provider

### SMS Issues
- Verify Twilio credentials are correct
- Check Twilio account balance
- Ensure phone numbers are in correct format (+country_code)

### Scheduling Issues
- Check server timezone configuration
- Verify cron expressions are valid
- Check server logs for scheduler errors

## Security Considerations

1. **Environment Variables**: Never commit `.env` file to version control
2. **API Keys**: Rotate Twilio and email credentials regularly
3. **Rate Limiting**: Twilio has rate limits for SMS sending
4. **Data Privacy**: Ensure parent contact information is handled securely

## Cost Considerations

### Twilio SMS Pricing
- SMS costs vary by country (~$0.0075 per SMS in India)
- Consider setting daily/monthly limits
- Monitor usage through Twilio dashboard

### Email Costs
- Gmail: Free for reasonable usage
- Consider dedicated email service for high volume

## Monitoring and Analytics

The notification dashboard provides:
- Total notifications sent (last 30 days)
- Success/failure rates
- SMS vs Email breakdown
- Recent notification history
- Failed notification details

## Future Enhancements

1. **WhatsApp Integration**: Using WhatsApp Business API
2. **Push Notifications**: Mobile app notifications
3. **Voice Calls**: Automated voice messages for critical alerts
4. **Multi-language Support**: Notifications in local languages
5. **Advanced Scheduling**: Custom schedules per class/teacher
6. **Parent Preferences**: Let parents choose notification methods

## Support

For technical support or feature requests, please contact the development team or create an issue in the project repository.