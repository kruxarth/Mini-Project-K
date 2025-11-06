import express from 'express';
import { all, getDB } from '../db.js';

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

// Enhanced insights with comprehensive analytics
router.get('/insights', requireAuth, async (req, res) => {
  try {
    const db = getDB();
    const teacherId = req.session.user.id;

    // Get all classes with analytics
    const classes = await db.all(`
      SELECT c.*, 
             COUNT(DISTINCT s.id) as total_students,
             COUNT(DISTINCT a.date) as total_days,
             COUNT(CASE WHEN a.status = 'present' THEN 1 END) as total_present,
             ROUND(AVG(CASE WHEN a.status = 'present' THEN 100.0 ELSE 0 END), 2) as avg_attendance
      FROM classes c
      LEFT JOIN students s ON c.id = s.class_id
      LEFT JOIN attendance a ON s.id = a.student_id
      WHERE c.teacher_id = ?
      GROUP BY c.id
      ORDER BY c.name
    `, [teacherId]);

    res.render('insights/dashboard', {
      title: 'Insights & Analytics',
      classes,
      currentPage: 'insights'
    });
  } catch (error) {
    console.error('Error loading insights:', error);
    req.session.flash = { message: 'Error loading insights' };
    res.redirect('/dashboard');
  }
});

router.get('/class/:id/insights', requireAuth, async (req, res) => {
  const classId = parseInt(req.params.id, 10);
  const klass = (await all(`SELECT * FROM classes WHERE id = ? AND teacher_id = ?`, [classId, req.session.user.id]))[0];
  if (!klass) return res.status(404).send('Not found');
  const from = req.query.from || '';
  const to = req.query.to || '';
  res.render('insights_class', { klass, from, to });
});

export default router;
