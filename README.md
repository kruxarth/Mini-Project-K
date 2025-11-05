# AttendanceMS

A web based attendance management system built with Node.js, Express.js, SQLite, and EJS.

## Features

- **Teacher Dashboard**: Overview of classes, students, and attendance statistics
- **Student Management**: Add, edit, and manage student information
- **Attendance Tracking**: Mark daily attendance with multiple status options (Present, Absent, Late, Excused)
- **Period-wise Attendance**: Track attendance for different class periods
- **Reports Generation**: Generate detailed attendance reports with date ranges
- **Data Import/Export**: Import students via CSV files and export reports
- **Email Notifications**: Send automated email alerts to parents for absences
- **SMS Integration**: Send SMS notifications via Twilio (optional)
- **Visual Analytics**: Interactive charts and graphs for attendance insights
- **Responsive Design**: Mobile-friendly interface with Bootstrap

## Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite
- **Frontend**: EJS, Bootstrap 5, Chart.js
- **Authentication**: Express-session, bcrypt
- **File Upload**: Multer
- **Email**: Nodemailer
- **SMS**: Twilio API

## Installation

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Setup

1. Clone the repository
```bash
git clone https://github.com/Mayuri2428/Mini-Project.git
cd Mini-Project
```

2. Install dependencies
```bash
npm install
```

3. Initialize the database
```bash
npm run db:init
npm run db:seed
```

4. Configure environment variables
```bash
cp .env.example .env
```

Edit the `.env` file with your configuration:
```env
SESSION_SECRET=your_session_secret
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM="School Attendance <no-reply@school.com>"
TWILIO_SID=your_twilio_sid
TWILIO_TOKEN=your_twilio_token
TWILIO_FROM=+1234567890
```

5. Start the application
```bash
# Development
npm run dev

# Production
npm start
```

6. Open your browser and navigate to `http://localhost:3000`

## Default Login
- **Email**: mjsfutane21@gmail.com
- **Password**: abc@1234

## Usage

1. **Login** with your teacher credentials
2. **Create Classes** and add students
3. **Mark Attendance** daily for each class
4. **Generate Reports** to track student performance
5. **Import/Export** data as needed

## Deployment

### Railway (Recommended)
1. Connect your GitHub repository to [Railway](https://railway.app)
2. Deploy automatically using the included `railway.json` configuration

### Render
1. Connect your GitHub repository to [Render](https://render.com)
2. Deploy using the included `render.yaml` configuration

## Database Schema

- **teachers**: Teacher accounts and authentication
- **classes**: Class information and subjects
- **students**: Student details and enrollment
- **attendance**: Daily attendance records
- **periods**: Class periods and schedules

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

For issues and questions, please open an issue on GitHub or contact mjsfutane21@gmail.com
