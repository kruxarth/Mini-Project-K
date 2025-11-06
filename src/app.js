import express from 'express';
import session from 'express-session';
import SQLiteStoreFactory from 'connect-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import authRouter from './routes/auth.js';
import dashboardRouter from './routes/dashboard.js';
import attendanceRouter from './routes/attendance.js';
import { migrate, ensureDefaultTeacher } from './db.js';
import reportsRouter from './routes/reports.js';
import importRouter from './routes/import.js';
import periodsRouter from './routes/periods.js';
import manageRouter from './routes/manage.js';
import apiRouter from './routes/api.js';
import insightsRouter from './routes/insights.js';
import dailyAttendanceRouter from './routes/daily-attendance.js';
import emailReportsRouter from './routes/email-reports.js';
import bulkImportRouter from './routes/bulk-import.js';
import analyticsRouter from './routes/analytics.js';
import profileRouter from './routes/profile.js';
import helpRouter from './routes/help.js';
import parentReportsRouter from './routes/parent-reports.js';
import notificationsRouter from './routes/notifications.js';
import alertsRouter from './routes/alerts.js';
import studentManagementRouter from './routes/student-management.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const SQLiteStore = SQLiteStoreFactory(session);

app.set('trust proxy', 1);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Request logging (only in development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} ${ms}ms`);
    });
    next();
  });
}

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    store: new SQLiteStore({ db: 'sessions.db', dir: path.join(__dirname, '..', 'data') }),
    secret: process.env.SESSION_SECRET || 'dev_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 6 }
  })
);

app.use((req, res, next) => {
  res.locals.brand = 'Government College Of Engineering Aurangabad Chhatrapati Sambhajinagar';
  res.locals.currentUser = req.session.user || null;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

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
app.use('/', helpRouter);
app.use('/', parentReportsRouter);
app.use('/', notificationsRouter);
app.use('/', alertsRouter);
app.use('/', studentManagementRouter);

app.get('/health', (req, res) => {
  res.status(200).json({ ok: true });
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

// Initialize database once on startup
migrate()
  .then(async () => {
    await ensureDefaultTeacher('mjsfutane21@gmail.com', 'abc@1234');
    
    // Initialize audit table
    const { initializeAuditTable } = await import('./middleware/audit.js');
    await initializeAuditTable();
    
    // Initialize notification scheduler
    const NotificationScheduler = await import('./services/notification-scheduler.js');
    NotificationScheduler.default.init();
    
    // Create sample alerts for demonstration (only in development)
    if (process.env.NODE_ENV !== 'production') {
      const { createSampleAlerts } = await import('./services/sample-alerts.js');
      setTimeout(() => createSampleAlerts(), 2000); // Delay to ensure tables are ready
    }
    
    console.log('Database initialized successfully');
  })
  .catch((e) => {
    console.error('Failed to initialize database:', e);
    process.exit(1);
  });

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Attendance portal listening on port ${port}`);
});

export default app;
