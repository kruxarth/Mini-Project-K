import express from 'express';
import { all } from '../db.js';
import { requirePermission, PERMISSIONS } from '../middleware/rbac.js';

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

// Analytics Dashboard
router.get('/analytics', requireAuth, requirePermission(PERMISSIONS.VIEW_REPORTS), async (req, res) => {
  const teacherId = req.session.user.id;
  
  // Get teacher's classes
  const classes = await all(`
    SELECT c.*, COUNT(s.id) as student_count
    FROM classes c 
    LEFT JOIN students s ON c.id = s.class_id 
    WHERE c.teacher_id = ? 
    GROUP BY c.id
    ORDER BY c.name
  `, [teacherId]);

  res.render('analytics-dashboard', {
    classes,
    pageTitle: 'Advanced Analytics'
  });
});

// Attendance Heatmap Data
router.get('/api/analytics/heatmap/:classId', requireAuth, requirePermission(PERMISSIONS.VIEW_REPORTS), async (req, res) => {
  const classId = parseInt(req.params.classId);
  const teacherId = req.session.user.id;
  const { startDate, endDate } = req.query;
  
  try {
    // Verify teacher owns this class
    const classCheck = await all(`
      SELECT id FROM classes WHERE id = ? AND teacher_id = ?
    `, [classId, teacherId]);
    
    if (classCheck.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get attendance data for heatmap
    const attendanceData = await all(`
      SELECT 
        s.id as student_id,
        s.name as student_name,
        s.roll_no,
        a.date,
        a.status,
        CASE 
          WHEN a.status = 'present' THEN 1
          WHEN a.status = 'late' THEN 0.7
          WHEN a.status = 'excused' THEN 0.5
          ELSE 0
        END as value
      FROM students s
      LEFT JOIN attendance a ON s.id = a.student_id
        AND a.date >= ? AND a.date <= ?
      WHERE s.class_id = ?
      ORDER BY CAST(s.roll_no AS INTEGER), a.date
    `, [startDate, endDate, classId]);

    // Generate date range
    const dates = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().slice(0, 10));
    }

    // Group data by student
    const studentData = {};
    attendanceData.forEach(record => {
      if (!studentData[record.student_id]) {
        studentData[record.student_id] = {
          student_id: record.student_id,
          student_name: record.student_name,
          roll_no: record.roll_no,
          attendance: {}
        };
      }
      
      if (record.date) {
        studentData[record.student_id].attendance[record.date] = {
          status: record.status,
          value: record.value
        };
      }
    });

    // Fill missing dates with null values
    Object.values(studentData).forEach(student => {
      dates.forEach(date => {
        if (!student.attendance[date]) {
          student.attendance[date] = { status: null, value: null };
        }
      });
    });

    res.json({
      students: Object.values(studentData),
      dates: dates,
      classId: classId
    });

  } catch (error) {
    console.error('Heatmap data error:', error);
    res.status(500).json({ error: 'Failed to generate heatmap data' });
  }
});

// Attendance Trends Analysis
router.get('/api/analytics/trends/:classId', requireAuth, requirePermission(PERMISSIONS.VIEW_REPORTS), async (req, res) => {
  const classId = parseInt(req.params.classId);
  const teacherId = req.session.user.id;
  const { period = '30' } = req.query; // days
  
  try {
    // Verify teacher owns this class
    const classCheck = await all(`
      SELECT id FROM classes WHERE id = ? AND teacher_id = ?
    `, [classId, teacherId]);
    
    if (classCheck.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const days = parseInt(period);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    // Daily attendance trends
    const dailyTrends = await all(`
      SELECT 
        a.date,
        COUNT(*) as total_records,
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late_count,
        SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END) as excused_count,
        ROUND(
          (SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2
        ) as attendance_rate
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      WHERE s.class_id = ? 
        AND a.date >= ? 
        AND a.date <= ?
      GROUP BY a.date
      ORDER BY a.date
    `, [classId, startDate.toISOString().slice(0, 10), endDate.toISOString().slice(0, 10)]);

    // Weekly patterns (day of week analysis)
    const weeklyPatterns = await all(`
      SELECT 
        CASE strftime('%w', a.date)
          WHEN '0' THEN 'Sunday'
          WHEN '1' THEN 'Monday'
          WHEN '2' THEN 'Tuesday'
          WHEN '3' THEN 'Wednesday'
          WHEN '4' THEN 'Thursday'
          WHEN '5' THEN 'Friday'
          WHEN '6' THEN 'Saturday'
        END as day_of_week,
        strftime('%w', a.date) as day_number,
        COUNT(*) as total_records,
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
        ROUND(
          (SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2
        ) as attendance_rate
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      WHERE s.class_id = ? 
        AND a.date >= ?
        AND a.date <= ?
      GROUP BY strftime('%w', a.date)
      ORDER BY day_number
    `, [classId, startDate.toISOString().slice(0, 10), endDate.toISOString().slice(0, 10)]);

    // Student performance analysis
    const studentPerformance = await all(`
      SELECT 
        s.id,
        s.name,
        s.roll_no,
        COUNT(a.id) as total_days,
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_days,
        SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_days,
        SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late_days,
        ROUND(
          (SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) * 100.0 / COUNT(a.id)), 2
        ) as attendance_percentage
      FROM students s
      LEFT JOIN attendance a ON s.id = a.student_id
        AND a.date >= ? AND a.date <= ?
      WHERE s.class_id = ?
      GROUP BY s.id
      ORDER BY attendance_percentage DESC, s.roll_no
    `, [startDate.toISOString().slice(0, 10), endDate.toISOString().slice(0, 10), classId]);

    res.json({
      dailyTrends,
      weeklyPatterns,
      studentPerformance,
      period: {
        days: days,
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10)
      }
    });

  } catch (error) {
    console.error('Trends analysis error:', error);
    res.status(500).json({ error: 'Failed to generate trends analysis' });
  }
});

// Comparative Analysis (multiple classes)
router.get('/api/analytics/comparative', requireAuth, requirePermission(PERMISSIONS.VIEW_REPORTS), async (req, res) => {
  const teacherId = req.session.user.id;
  const { period = '30' } = req.query;
  
  try {
    const days = parseInt(period);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    // Get comparative data for all teacher's classes
    const classComparison = await all(`
      SELECT 
        c.id,
        c.name as class_name,
        c.section,
        COUNT(DISTINCT s.id) as total_students,
        COUNT(a.id) as total_attendance_records,
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late_count,
        ROUND(
          (SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) * 100.0 / 
           NULLIF(COUNT(a.id), 0)), 2
        ) as attendance_rate
      FROM classes c
      LEFT JOIN students s ON c.id = s.class_id
      LEFT JOIN attendance a ON s.id = a.student_id
        AND a.date >= ? AND a.date <= ?
      WHERE c.teacher_id = ?
      GROUP BY c.id
      ORDER BY attendance_rate DESC
    `, [startDate.toISOString().slice(0, 10), endDate.toISOString().slice(0, 10), teacherId]);

    res.json({
      classComparison,
      period: {
        days: days,
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10)
      }
    });

  } catch (error) {
    console.error('Comparative analysis error:', error);
    res.status(500).json({ error: 'Failed to generate comparative analysis' });
  }
});

export default router;