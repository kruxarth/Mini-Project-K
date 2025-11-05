# 📚 Attendance Management System

A comprehensive web-based attendance management system built with Node.js for educational institutions. This system allows teachers to efficiently manage student attendance, generate reports, and notify parents via email and SMS.

## 🌟 Features

### 👨‍🏫 Teacher Dashboard
- **Real-time Attendance Marking**: Quick and intuitive interface for marking student attendance
- **Class Management**: Create and manage multiple classes and subjects
- **Student Management**: Add, edit, and organize student information
- **Period-wise Attendance**: Track attendance for different periods/subjects
- **Bulk Operations**: Import students via CSV, bulk attendance marking

### 📊 Reports & Analytics
- **Attendance Reports**: Generate detailed attendance reports by date range
- **Student Performance**: Individual student attendance analytics
- **Class Statistics**: Overall class attendance trends and insights
- **Export Options**: Download reports in PDF and Excel formats
- **Visual Charts**: Interactive charts and graphs for better data visualization

### 📱 Communication
- **Email Notifications**: Automated email alerts to parents for absences
- **SMS Integration**: Send SMS notifications via Twilio
- **Parent Portal**: Dedicated portal for parents to view attendance
- **Customizable Templates**: Personalized notification templates

### 🔐 Security & Access Control
- **Secure Authentication**: Teacher login with session management
- **Role-based Access**: Different access levels for administrators and teachers
- **Data Protection**: Encrypted passwords and secure data handling
- **Session Management**: Automatic logout and session timeout

## 🛠️ Technology Stack

- **Backend**: Node.js + Express.js
- **Database**: SQLite (Portable file-based database)
- **Frontend**: EJS Templates + Bootstrap 5
- **Authentication**: Express-session with bcrypt
- **File Upload**: Multer for CSV imports
- **Email**: Nodemailer with SMTP support
- **SMS**: Twilio API integration
- **Charts**: Chart.js for data visualization

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- Git installed

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Mayuri2428/Mini-Project.git
   cd Mini-Project
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Initialize database**
   ```bash
   npm run db:init
   npm run db:seed
   ```

4. **Configure environment**
   ```bash
   # Windows
   copy .env.example .env
   
   # Linux/Mac
   cp .env.example .env
   ```

5. **Edit .env file with your credentials**
   ```env
   SESSION_SECRET=your_secret_key
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=your_app_password
   TWILIO_SID=your_twilio_sid
   TWILIO_TOKEN=your_twilio_token
   ```

6. **Start the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

7. **Access the application**
   - Open http://localhost:3000
   - Login with default credentials:
     - **Email**: mjsfutane21@gmail.com
     - **Password**: abc@1234

## 📱 Deployment Options

### 🟢 Free Deployment Platforms

#### GitHub Codespaces (Recommended)
```bash
# Go to: https://github.com/Mayuri2428/Mini-Project
# Click "Code" → "Codespaces" → "Create codespace"
# Run: npm start
# Make port 3000 public for sharing
```

#### Gitpod
```bash
# Direct link: https://gitpod.io/#https://github.com/Mayuri2428/Mini-Project
```

#### Railway
```bash
# Connect GitHub repo at: https://railway.app
# Auto-deploys with railway.json config
```

#### Render
```bash
# Connect GitHub repo at: https://render.com
# Uses render.yaml configuration
```

## 📖 Usage Guide

### 🎯 For Teachers

1. **Login** to your teacher account
2. **Create Classes** and add subjects
3. **Import Students** via CSV or add manually
4. **Mark Attendance** for each period/class
5. **Generate Reports** for analysis
6. **Configure Notifications** for parent alerts

### 👥 For Administrators

1. **Manage Teachers** and their access
2. **Monitor System Usage** and statistics
3. **Configure Global Settings**
4. **Backup and Restore** data

### 👨‍👩‍👧‍👦 For Parents

1. **Receive Notifications** via email/SMS
2. **View Student Attendance** history
3. **Download Reports** for records

## 🔧 Configuration

### Email Setup (Gmail)
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password  # Generate from Google Account settings
```

### SMS Setup (Twilio)
```env
TWILIO_SID=your_account_sid
TWILIO_TOKEN=your_auth_token
TWILIO_FROM=+1234567890  # Your Twilio phone number
```

## 📊 Database Schema

### Tables
- **teachers**: Teacher accounts and profiles
- **classes**: Class/subject information
- **students**: Student details and enrollment
- **attendance**: Daily attendance records
- **periods**: Time periods and schedules

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the `/docs` folder for detailed guides
- **Issues**: Report bugs on [GitHub Issues](https://github.com/Mayuri2428/Mini-Project/issues)
- **Email**: mjsfutane21@gmail.com

## 🎯 Roadmap

- [ ] Mobile app for teachers
- [ ] Advanced analytics dashboard
- [ ] Integration with school management systems
- [ ] Multi-language support
- [ ] Biometric attendance integration
- [ ] Parent mobile app

## 📸 Screenshots

### Teacher Dashboard
![Dashboard](docs/screenshots/dashboard.png)

### Attendance Marking
![Attendance](docs/screenshots/attendance.png)

### Reports
![Reports](docs/screenshots/reports.png)

---

**Made with ❤️ for educational institutions**

**⭐ Star this repository if you find it helpful!**
