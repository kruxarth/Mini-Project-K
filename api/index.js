// Vercel serverless function entry point
import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import authRouter from '../src/routes/auth.js';
import dashboardRouter from '../src/routes/dashboard.js';
import attendanceRouter from '../src/routes/attendance.js';
import { migrate, ensureDefaultTeacher } from '../src/db.js';
import reportsRouter from '../src/routes/reports.js';
import importRouter from '../src/routes/import.js';
import periodsRouter from '../src/routes/periods.js';
import manageRouter from '../src/routes/manage.js';
import apiRouter from '../src/routes/api.js';
import insightsRouter from '../src/routes/insights.js';
import dailyAttendanceRouter from '../src/routes/daily-attendance.js';
import emailReportsRouter from '../src/routes/email-reports.js';
import bulkImportRouter from '../src/routes/bulk-import.js';
import analyticsRouter from '../src/routes/analytics.js';
import profileRouter from '../src/routes/profile.js';
import realtimeDashboardRouter from '../src/routes/realtime-dashboard.js';
import testRealtimeRouter from '../src/routes/test-realtime.js';
import notificationsRouter from '../src/routes/notifications.js';
import teacherDashboardRouter from '../src/routes/teacher-dashboard.js';
import teacherApiRouter from '../src/routes/teacher-api.js';
import helpRouter from '../src/routes/help.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'src', 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'src', 'public')));

// Simplified session for Vercel (no SQLite store)
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'vercel_secret_key_change_in_production',
    resave: false,
    saveUninitialized: false,
    cookie: { 
      maxAge: 1000 * 60 * 60 * 6,
      secure: process.env.NODE_ENV === 'production'
    }
  })
);

app.use((req, res, next) => {
  res.locals.brand = 'Government College Of Engineering Aurangabad Chhatrapati Sambhajinagar';
  res.locals.currentUser = req.session.user || null;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

// Routes
app.use('/', authRouter);
app.use('/', dashboardRouter);
app.use('/', attendanceRouter);
app.use('/', reportsRouter);
app.use('/', importRouter);
app.use('/', periodsRouter);
app.use('/', manageRouter);
app.use('/', apiRouter);
app.use('/', insightsRouter);
app.use('/', dailyAttendanceRouter);
app.use('/', emailReportsRouter);
app.use('/', bulkImportRouter);
app.use('/', analyticsRouter);
app.use('/', profileRouter);
app.use('/', realtimeDashboardRouter);
app.use('/', testRealtimeRouter);
app.use('/', notificationsRouter);
app.use('/', teacherDashboardRouter);
app.use('/', teacherApiRouter);
app.use('/', helpRouter);

app.get('/health', (req, res) => {
  res.status(200).json({ ok: true, platform: 'vercel' });
});

app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  return res.redirect('/home');
});

app.get('/home', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('home');
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).send('Internal Server Error');
});

// Initialize database for Vercel
let initialized = false;
async function initializeForVercel() {
  if (initialized) return;
  
  try {
    await migrate();
    await ensureDefaultTeacher('mjsfutane21@gmail.com', 'abc@1234');
    
    // Optional notification tables
    try {
      const { createNotificationTables } = await import('../src/db-notifications.js');
      await createNotificationTables();
    } catch (e) {
      console.log('Vercel: Notification tables skipped (optional)');
    }
    
    initialized = true;
    console.log('Vercel: Database initialized');
  } catch (error) {
    console.error('Vercel: Database initialization failed:', error);
  }
}

// Initialize on first request
app.use(async (req, res, next) => {
  if (!initialized) {
    await initializeForVercel();
  }
  next();
});

export default app;