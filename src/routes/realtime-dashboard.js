import express from 'express';
import { all, run } from '../db.js';

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

// Real-time dashboard page
router.get('/realtime-dashboard', requireAuth, async (req, res) => {
  try {
    const teacherId = req.session.user.id;
    
    // Get teacher's classes
    const classes = await all(`
      SELECT id, name, section, subject 
      FROM classes 
      WHERE teacher_id = ?
      ORDER BY name, section
    `, [teacherId]);
    
    // Get today's attendance summary for all classes
    const attendanceSummary = await all(`
      SELECT 
        c.id as class_id,
        c.name as class_name,
        c.section,
        COUNT(s.id) as total_students,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count,
        COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_count,
        COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_count
      FROM classes c
      LEFT JOIN students s ON c.id = s.class_id
      LEFT JOIN attendance a ON s.id = a.student_id AND a.date = date('now') AND a.class_id = c.id
      WHERE c.teacher_id = ?
      GROUP BY c.id, c.name, c.section
      ORDER BY c.name, c.section
    `, [teacherId]);
    
    res.render('realtime-dashboard', {
      pageTitle: 'Real-time Attendance Dashboard',
      classes,
      attendanceSummary
    });
    
  } catch (error) {
    console.error('Real-time dashboard error:', error);
    req.session.flash = { message: 'Error loading dashboard' };
    res.redirect('/dashboard');
  }
});

// API endpoint to get real-time attendance data for a specific class
router.get('/api/realtime-attendance/:classId', requireAuth, async (req, res) => {
  try {
    const { classId } = req.params;
    const teacherId = req.session.user.id;
    
    // Verify teacher owns this class
    const classCheck = await all(`
      SELECT id FROM classes WHERE id = ? AND teacher_id = ?
    `, [classId, teacherId]);
    
    if (classCheck.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get students with today's attendance status
    const students = await all(`
      SELECT 
        s.id,
        s.name,
        s.roll_number,
        COALESCE(a.status, 'unmarked') as status,
        a.marked_at,
        a.notes
      FROM students s
      LEFT JOIN attendance a ON s.id = a.student_id 
        AND a.date = date('now') 
        AND a.class_id = ?
      WHERE s.class_id = ?
      ORDER BY s.roll_number
    `, [classId, classId]);
    
    // Get class info
    const classInfo = await all(`
      SELECT name, section, subject FROM classes WHERE id = ?
    `, [classId]);
    
    // Calculate statistics
    const stats = {
      total: students.length,
      present: students.filter(s => s.status === 'present').length,
      absent: students.filter(s => s.status === 'absent').length,
      late: students.filter(s => s.status === 'late').length,
      unmarked: students.filter(s => s.status === 'unmarked').length
    };
    
    res.json({
      classInfo: classInfo[0],
      students,
      stats,
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Real-time attendance API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint to get attendance heatmap data
router.get('/api/attendance-heatmap', requireAuth, async (req, res) => {
  try {
    const teacherId = req.session.user.id;
    const { period = '7' } = req.query; // Default to 7 days
    
    // Get attendance data for the specified period
    const heatmapData = await all(`
      SELECT 
        c.id as class_id,
        c.name as class_name,
        c.section,
        a.date,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count,
        COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_count,
        COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_count,
        COUNT(s.id) as total_students
      FROM classes c
      LEFT JOIN students s ON c.id = s.class_id
      LEFT JOIN attendance a ON s.id = a.student_id AND a.class_id = c.id
      WHERE c.teacher_id = ? 
        AND a.date >= date('now', '-' || ? || ' days')
      GROUP BY c.id, c.name, c.section, a.date
      ORDER BY a.date DESC, c.name, c.section
    `, [teacherId, period]);
    
    // Process data for heatmap visualization
    const processedData = heatmapData.map(row => ({
      ...row,
      attendance_rate: row.total_students > 0 ? 
        ((row.present_count + row.late_count) / row.total_students * 100).toFixed(1) : 0
    }));
    
    res.json({
      heatmapData: processedData,
      period: parseInt(period)
    });
    
  } catch (error) {
    console.error('Heatmap API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;