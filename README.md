# 🎓 Attendance Management System

A comprehensive web-based attendance management system built for educational institutions. Streamline attendance tracking, generate detailed reports, and maintain seamless communication with parents.

## ✨ Features

### 👥 **Student Management**
- Complete student profile management with contact information
- Bulk import/export via CSV files
- Advanced search and filtering capabilities
- Enrollment status tracking (Active/Inactive)
- Parent contact management for notifications

### 📅 **Attendance System**
- Session-based attendance tracking (Morning/Afternoon/Evening/Custom)
- Multiple status options (Present/Absent/Late/Excused)
- Real-time validation and duplicate prevention
- Bulk attendance operations
- Individual student remarks and notes

### 📊 **Reports & Analytics**
- Advanced report generation with comprehensive filters
- Multiple export formats (HTML/PDF/CSV/Excel)
- Date range options (Weekly/Monthly/Semester/Custom)
- Visual analytics with charts and graphs
- Performance metrics and trend analysis

### 📧 **Parent Communication**
- Automated SMS notifications via Twilio
- Professional email notifications via Nodemailer
- Absence alerts and low attendance warnings
- Weekly/monthly attendance reports
- Custom message broadcasting

### 🔔 **Alert System**
- Real-time dashboard alerts with 5 severity levels
- Automated alert generation for various events
- Priority-based sorting and filtering
- Visual indicators with color coding
- Alert management with read/unread status

### ❓ **Help & Support**
- Comprehensive help center with 10 sections
- Step-by-step guides and tutorials
- FAQ section with common questions
- Troubleshooting guides and solutions
- Contact support with feedback forms

## 🛠️ Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite with optimized schema
- **Frontend**: Bootstrap 5, Chart.js, Font Awesome
- **Authentication**: Session-based with bcryptjs
- **Notifications**: Twilio (SMS), Nodemailer (Email)
- **Scheduling**: Node-cron for automated tasks

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/amruta-rothe/Mini-Project.git
   cd Mini-Project
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your configuration:
   ```env
   SESSION_SECRET=your_session_secret
   SCHOOL_NAME=Your School Name
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password
   TWILIO_ACCOUNT_SID=your_twilio_sid
   TWILIO_AUTH_TOKEN=your_twilio_token
   TWILIO_PHONE_NUMBER=+1234567890
   ```

4. **Initialize database**
   ```bash
   npm run setup
   ```

5. **Start the application**
   ```bash
   npm start
   ```

6. **Access the system**
   Open your browser and navigate to `http://localhost:3000`

## 📱 Default Login

- **Email**: `mjsfutane21@gmail.com`
- **Password**: `abc@1234`

## 🎯 Key Features Overview

### Dashboard
- Real-time statistics and analytics
- Quick action buttons for common tasks
- Visual charts showing attendance trends
- Alert notifications with priority indicators

### Student Management
- Add, edit, and delete student records
- Bulk import from CSV files
- Advanced filtering and search
- Parent contact information management

### Attendance Tracking
- Daily attendance marking with timing
- Session-based tracking (multiple sessions per day)
- Validation to prevent duplicates and errors
- Bulk operations for efficiency

### Reporting System
- Generate comprehensive attendance reports
- Multiple filtering options (class, date range, status)
- Export in various formats (PDF, CSV, Excel)
- Visual analytics and insights

### Communication
- Automated absence notifications
- Low attendance alerts
- Weekly/monthly report delivery
- Custom message broadcasting

## 🔧 Configuration

### Email Setup (Gmail)
1. Enable 2-Factor Authentication
2. Generate an App Password
3. Use the app password in `EMAIL_PASS`

### SMS Setup (Twilio)
1. Create a Twilio account
2. Get your Account SID and Auth Token
3. Purchase a phone number
4. Add credentials to `.env`

## 📊 Database Schema

The system uses SQLite with the following main tables:
- `teachers` - User authentication and profiles
- `classes` - Class organization and management
- `students` - Student information and contacts
- `attendance` - Session-based attendance records
- `notifications_log` - Notification tracking
- `alerts` - System alert management

## 🔒 Security Features

- Secure password hashing with bcryptjs
- Session-based authentication
- SQL injection prevention
- XSS protection with input sanitization
- Role-based access control

## 📈 Performance

- Optimized database queries with proper indexing
- Efficient frontend with minimal JavaScript
- Responsive design for all devices
- Fast loading times with optimized assets

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- **Mayuri Futane** - *Initial work* - [mjsfutane21@gmail.com](mailto:mjsfutane21@gmail.com)

## 🙏 Acknowledgments

- Government College Of Engineering Aurangabad
- Bootstrap team for the excellent UI framework
- Chart.js for beautiful data visualizations
- All contributors and testers

## 📞 Support

For support and questions:
- Email: support@gcoea-attendance.com
- Phone: +91-240-2400000
- Create an issue on GitHub

---

**🎉 The Attendance Management System is production-ready and actively maintained!**