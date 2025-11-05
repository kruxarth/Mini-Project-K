import express from 'express';
import { all } from '../db.js';

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'unauthorized' });
  next();
}

// Class summary: counts per status in range
router.get('/api/class/:id/summary', requireAuth, async (req, res) => {
  const classId = parseInt(req.params.id, 10);
  const { from, to } = req.query;
  const rows = await all(`
    SELECT status, COUNT(*) as c
    FROM attendance
    WHERE class_id = ?
      AND (? IS NULL OR date >= ?)
      AND (? IS NULL OR date <= ?)
    GROUP BY status
  `, [classId, from || null, from || null, to || null, to || null]);
  const out = { present: 0, absent: 0, late: 0, excused: 0 };
  for (const r of rows) out[r.status] = r.c;
  res.json(out);
});

// Class trend: last N days present rate
router.get('/api/class/:id/trend', requireAuth, async (req, res) => {
  const classId = parseInt(req.params.id, 10);
  const days = Math.min(parseInt(req.query.days || '30', 10), 120);
  // Build dates array
  const dates = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  // Query totals and presents by date
  const totals = await all(`
    SELECT date, COUNT(*) as total
    FROM attendance
    WHERE class_id = ? AND date >= ?
    GROUP BY date
  `, [classId, dates[0]]);
  const presents = await all(`
    SELECT date, COUNT(*) as present
    FROM attendance
    WHERE class_id = ? AND date >= ? AND status = 'present'
    GROUP BY date
  `, [classId, dates[0]]);
  const tMap = new Map(totals.map(r => [r.date, r.total]));
  const pMap = new Map(presents.map(r => [r.date, r.present]));
  const series = dates.map(d => {
    const t = tMap.get(d) || 0;
    const p = pMap.get(d) || 0;
    return { date: d, rate: t ? Math.round((p / t) * 100) : null };
  });
  res.json(series);
});

// Class student percentages (range)
router.get('/api/class/:id/student-percentages', requireAuth, async (req, res) => {
  const classId = parseInt(req.params.id, 10);
  const { from, to } = req.query;
  const rows = await all(`
    SELECT s.id, s.name, s.roll_no,
      SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) as present_count,
      COUNT(a.id) as total_count
    FROM students s
    LEFT JOIN attendance a ON a.student_id = s.id
      AND (? IS NULL OR a.date >= ?)
      AND (? IS NULL OR a.date <= ?)
    WHERE s.class_id = ?
    GROUP BY s.id
    ORDER BY CAST(s.roll_no AS INT)
  `, [from || null, from || null, to || null, to || null, classId]);
  const data = rows.map(r => ({
    id: r.id,
    name: r.name,
    roll_no: r.roll_no,
    pct: r.total_count ? Math.round((r.present_count / r.total_count) * 100) : 0
  }));
  res.json(data);
});

// Teacher-level totals for dashboard (classes and students counts)
router.get('/api/teacher/totals', requireAuth, async (req, res) => {
  const teacherId = req.session.user.id;
  const classes = await all(`SELECT COUNT(*) as c FROM classes WHERE teacher_id = ?`, [teacherId]);
  const students = await all(`SELECT COUNT(*) as c FROM students WHERE class_id IN (SELECT id FROM classes WHERE teacher_id = ?)`, [teacherId]);
  res.json({ classes: classes[0]?.c || 0, students: students[0]?.c || 0 });
});

// Student heatmap for a month (YYYY-MM) -> 1 present, 0 otherwise
router.get('/api/student/:id/heatmap', requireAuth, async (req, res) => {
  const studentId = parseInt(req.params.id, 10);
  const month = req.query.month; // 'YYYY-MM'
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'month required as YYYY-MM' });
  const start = `${month}-01`;
  const end = `${month}-31`;
  const rows = await all(`SELECT date, status FROM attendance WHERE student_id = ? AND date >= ? AND date <= ?`, [studentId, start, end]);
  const data = rows.map(r => ({ date: r.date, value: r.status==='present'?1:0 }));
  res.json(data);
});

// Class leaderboard: top attendance pct and longest present streak in a month
router.get('/api/class/:id/leaderboard', requireAuth, async (req, res) => {
  const classId = parseInt(req.params.id, 10);
  const month = req.query.month; // YYYY-MM
  const now = new Date();
  const ym = month && /^\d{4}-\d{2}$/.test(month) ? month : `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const start = `${ym}-01`;
  const end = `${ym}-31`;
  const students = await all(`SELECT id, name, roll_no FROM students WHERE class_id = ?`, [classId]);
  const att = await all(`SELECT student_id, date, status FROM attendance WHERE class_id = ? AND date >= ? AND date <= ?`, [classId, start, end]);
  const byStu = new Map();
  for (const s of students) byStu.set(s.id, { ...s, total:0, present:0, dates:new Map() });
  for (const a of att) {
    const rec = byStu.get(a.student_id); if (!rec) continue; rec.total++; if (a.status==='present') rec.present++; rec.dates.set(a.date, a.status);
  }
  const pctBoard = students.map(s => {
    const r = byStu.get(s.id); const pct = r.total ? Math.round((r.present/r.total)*100) : 0; return { id:s.id, name:s.name, roll_no:s.roll_no, pct };
  }).sort((a,b)=>b.pct-a.pct).slice(0,10);

  // Longest present streak in month
  function longestStreak(rec) {
    let cur=0, best=0;
    const d0 = new Date(start); const d1 = new Date(end);
    for (let d = new Date(d0); d <= d1; d.setDate(d.getDate()+1)) {
      const key = d.toISOString().slice(0,10);
      if (rec.dates.get(key)==='present') { cur++; best=Math.max(best,cur);} else { cur=0; }
    }
    return best;
  }
  const streakBoard = students.map(s => { const r = byStu.get(s.id); return { id:s.id, name:s.name, roll_no:s.roll_no, streak: longestStreak(r) }; })
    .sort((a,b)=>b.streak-a.streak).slice(0,10);

  res.json({ month: ym, topAttendance: pctBoard, longestStreak: streakBoard });
});

// Teacher-level totals for dashboard (classes and students counts)
router.get('/api/teacher/totals', requireAuth, async (req, res) => {
  const teacherId = req.session.user.id;
  const classes = await all(`SELECT COUNT(*) as c FROM classes WHERE teacher_id = ?`, [teacherId]);
  const students = await all(`SELECT COUNT(*) as c FROM students WHERE class_id IN (SELECT id FROM classes WHERE teacher_id = ?)`, [teacherId]);
  res.json({ classes: classes[0]?.c || 0, students: students[0]?.c || 0 });
});

// Teacher-level today summary across all classes
router.get('/api/teacher/today', requireAuth, async (req, res) => {
  const teacherId = req.session.user.id;
  const today = new Date();
  const date = today.toISOString().slice(0, 10);
  const rows = await all(
    `SELECT status, COUNT(*) as c
     FROM attendance
     WHERE class_id IN (SELECT id FROM classes WHERE teacher_id = ?)
       AND date = ?
     GROUP BY status`,
    [teacherId, date]
  );
  const out = { date, present: 0, absent: 0, late: 0, excused: 0 };
  for (const r of rows) out[r.status] = r.c;
  res.json(out);
});

// Teacher-level trend: last N days present rate across all classes
router.get('/api/teacher/trend', requireAuth, async (req, res) => {
  const teacherId = req.session.user.id;
  const days = Math.min(parseInt(req.query.days || '30', 10), 120);
  const dates = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  const since = dates[0];
  const totals = await all(
    `SELECT date, COUNT(*) as total
     FROM attendance
     WHERE class_id IN (SELECT id FROM classes WHERE teacher_id = ?)
       AND date >= ?
     GROUP BY date`,
    [teacherId, since]
  );
  const presents = await all(
    `SELECT date, COUNT(*) as present
     FROM attendance
     WHERE class_id IN (SELECT id FROM classes WHERE teacher_id = ?)
       AND date >= ? AND status = 'present'
     GROUP BY date`,
    [teacherId, since]
  );
  const tMap = new Map(totals.map(r => [r.date, r.total]));
  const pMap = new Map(presents.map(r => [r.date, r.present]));
  const series = dates.map(d => {
    const t = tMap.get(d) || 0;
    const p = pMap.get(d) || 0;
    return { date: d, rate: t ? Math.round((p / t) * 100) : null };
  });
  res.json(series);
});

// Performance metrics for dashboard
router.get('/api/teacher/performance', requireAuth, async (req, res) => {
  const teacherId = req.session.user.id;
  
  // Weekly performance
  const weeklyStats = await all(`
    SELECT 
      strftime('%W', date) as week,
      COUNT(*) as total_records,
      SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_count
    FROM attendance a
    JOIN students s ON a.student_id = s.id
    JOIN classes c ON s.class_id = c.id
    WHERE c.teacher_id = ? 
    AND date >= date('now', '-4 weeks')
    GROUP BY week
    ORDER BY week
  `, [teacherId]);

  // Class performance comparison
  const classPerformance = await all(`
    SELECT 
      c.name as class_name,
      COUNT(a.id) as total_records,
      SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
      ROUND(
        (SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) * 100.0 / COUNT(a.id)), 2
      ) as attendance_rate
    FROM classes c
    LEFT JOIN students s ON c.id = s.class_id
    LEFT JOIN attendance a ON s.id = a.student_id
    WHERE c.teacher_id = ?
    AND (a.date IS NULL OR a.date >= date('now', '-30 days'))
    GROUP BY c.id, c.name
    ORDER BY attendance_rate DESC
  `, [teacherId]);

  res.json({
    weekly: weeklyStats,
    classes: classPerformance
  });
});

// Recent activities
router.get('/api/teacher/activities', requireAuth, async (req, res) => {
  const teacherId = req.session.user.id;
  
  const activities = await all(`
    SELECT 
      'attendance' as type,
      c.name as class_name,
      COUNT(*) as count,
      date as activity_date,
      'Attendance marked for ' || c.name as description
    FROM attendance a
    JOIN students s ON a.student_id = s.id
    JOIN classes c ON s.class_id = c.id
    WHERE c.teacher_id = ?
    AND date >= date('now', '-7 days')
    GROUP BY date, c.id
    ORDER BY date DESC, c.name
    LIMIT 10
  `, [teacherId]);

  res.json(activities);
});expo
rt default router;