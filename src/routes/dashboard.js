import express from 'express';
import { all } from '../db.js';

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

router.get('/dashboard', requireAuth, async (req, res) => {
  const teacherId = req.session.user.id;
  
  // Get classes with student counts
  const classes = await all(`
    SELECT c.*, 
           COUNT(s.id) as student_count,
           (SELECT COUNT(*) FROM attendance a 
            JOIN students st ON a.student_id = st.id 
            WHERE st.class_id = c.id 
            AND a.date = date('now', 'localtime')
            AND a.status = 'present') as today_present,
           (SELECT COUNT(*) FROM attendance a 
            JOIN students st ON a.student_id = st.id 
            WHERE st.class_id = c.id 
            AND a.date = date('now', 'localtime')) as today_total
    FROM classes c 
    LEFT JOIN students s ON c.id = s.class_id 
    WHERE c.teacher_id = ? 
    GROUP BY c.id
    ORDER BY c.name
  `, [teacherId]);

  // Calculate attendance percentages for each class
  classes.forEach(cls => {
    cls.today_percentage = cls.today_total > 0 ? 
      Math.round((cls.today_present / cls.today_total) * 100) : 0;
  });

  res.render('dashboard', { classes });
});

export default router;
