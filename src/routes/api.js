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
  const dates = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
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

// Teacher-level totals for dashboard
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

export default router;