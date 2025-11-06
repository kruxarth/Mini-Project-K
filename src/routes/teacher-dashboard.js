import express from 'express';
import { all } from '../db.js';

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

// Teacher dashboard page
router.get('/teacher-dashboard', requireAuth, async (req, res) => {
  res.render('teacher-dashboard', {
    pageTitle: 'Teacher Dashboard'
  });
});

// API endpoint for dashboard data
router.get('/api/teacher-dashboard', requireAuth, async (req, res) => {
  try {
    const teacherId = req.session.user.id;
    const today = new Date().toISOString().slice(0, 10);
    
    // Get teacher's classes
    const classes = await all(`
      SELECT 
        c.id,
        c.name,
        c.section,
        c.subject,
        COUNT(s.id) as studentCount,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as presentCount,
        COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absentCount,
        COUNT(CASE WHEN a.status = 'late' THEN 1 END) as lateCount,
        COUNT(a.id) > 0 as attendanceMarked
      FROM classes c
      LEFT JOIN students s ON c.id = s.class_id
      LEFT JOIN attendance a ON s.id = a.student_id AND a.date = ? AND a.class_id = c.id
      WHERE c.teacher_id = ?
      GROUP BY c.id, c.name, c.section, c.subject
      ORDER BY c.name, c.section
    `, [today, teacherId]);

    // Calculate summary statistics
    const totalStudents = classes.reduce((sum, cls) => sum + cls.studentCount, 0);
    const totalPresent = classes.reduce((sum, cls) => sum + cls.presentCount, 0);
    const attendanceRate = totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0;
    
    // Get low attendance students (last 7 days)
    const lowAttendanceStudents = await all(`
      SELECT 
        s.id,
        s.name,
        c.name as class_name,
        c.section,
        COUNT(a.id) as total_days,
        COUNT(CASE WHEN a.status IN ('present', 'late') THEN 1 END) as present_days,
        ROUND(COUNT(CASE WHEN a.status IN ('present', 'late') THEN 1 END) * 100.0 / COUNT(a.id), 1) as attendance_rate
      FROM students s
      JOIN classes c ON s.class_id = c.id
      LEFT JOIN attendance a ON s.id = a.student_id 
        AND a.date >= date('now', '-7 days')
        AND a.class_id = c.id
      WHERE c.teacher_id = ?
      GROUP BY s.id, s.name, c.name, c.section
      HAVING total_days >= 3 AND attendance_rate < 75
      ORDER BY attendance_rate ASC
      LIMIT 10
    `, [teacherId]);

    // Generate alerts based on data
    const alerts = [];
    
    // Low attendance alerts
    if (lowAttendanceStudents.length > 0) {
      alerts.push({
        type: 'urgent',
        title: `${lowAttendanceStudents.length} students with low attendance`,
        description: `Students below 75% attendance in the last 7 days`,
        time: 'Now',
        action: '/notifications'
      });
    }

    // Pending attendance alerts
    const pendingClasses = classes.filter(cls => !cls.attendanceMarked);
    if (pendingClasses.length > 0) {
      alerts.push({
        type: 'warning',
        title: `${pendingClasses.length} classes need attendance`,
        description: `Mark attendance for today's classes`,
        time: 'Today',
        action: '/daily-attendance'
      });
    }

    // Get recent activity (last 10 actions)
    const recentActivity = await all(`
      SELECT 
        al.action,
        al.resource_type,
        al.created_at,
        c.name as class_name,
        c.section
      FROM audit_log al
      LEFT JOIN classes c ON al.resource_id = c.id AND al.resource_type = 'class'
      WHERE al.user_id = ?
      ORDER BY al.created_at DESC
      LIMIT 10
    `, [teacherId]);

    // Format recent activity
    const formattedActivity = recentActivity.map(activity => {
      let text = '';
      let icon = 'circle';
      
      switch (activity.action) {
        case 'mark_attendance':
          text = `Marked attendance for ${activity.class_name || 'class'}`;
          icon = 'check-circle';
          break;
        case 'create_class':
          text = `Created class ${activity.class_name || ''}`;
          icon = 'plus-circle';
          break;
        case 'update_student':
          text = `Updated student information`;
          icon = 'user-edit';
          break;
        case 'send_notification':
          text = `Sent notification to parents`;
          icon = 'bell';
          break;
        default:
          text = `${activity.action.replace('_', ' ')} - ${activity.resource_type}`;
          icon = 'circle';
      }
      
      return {
        text,
        icon,
        time: formatTimeAgo(new Date(activity.created_at))
      };
    });

    // Prepare response data
    const dashboardData = {
      success: true,
      summary: {
        classesToday: classes.length,
        totalStudents,
        attendanceRate,
        lowAttendanceCount: lowAttendanceStudents.length
      },
      classes: classes.map(cls => ({
        ...cls,
        attendanceMarked: cls.attendanceMarked === 1
      })),
      alerts,
      recentActivity: formattedActivity,
      lowAttendanceStudents
    };

    res.json(dashboardData);
    
  } catch (error) {
    console.error('Teacher dashboard API error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to load dashboard data' 
    });
  }
});

// Quick stats API for summary cards
router.get('/api/quick-stats', requireAuth, async (req, res) => {
  try {
    const teacherId = req.session.user.id;
    const today = new Date().toISOString().slice(0, 10);
    
    // Get basic stats
    const stats = await all(`
      SELECT 
        COUNT(DISTINCT c.id) as total_classes,
        COUNT(DISTINCT s.id) as total_students,
        COUNT(CASE WHEN a.status = 'present' AND a.date = ? THEN 1 END) as present_today,
        COUNT(CASE WHEN a.status = 'absent' AND a.date = ? THEN 1 END) as absent_today,
        COUNT(CASE WHEN a.date = ? THEN 1 END) as marked_today
      FROM classes c
      LEFT JOIN students s ON c.id = s.class_id
      LEFT JOIN attendance a ON s.id = a.student_id AND a.class_id = c.id
      WHERE c.teacher_id = ?
    `, [today, today, today, teacherId]);

    const stat = stats[0];
    const attendanceRate = stat.marked_today > 0 ? 
      Math.round((stat.present_today / stat.marked_today) * 100) : 0;

    res.json({
      success: true,
      stats: {
        totalClasses: stat.total_classes,
        totalStudents: stat.total_students,
        attendanceRate,
        presentToday: stat.present_today,
        absentToday: stat.absent_today,
        markedToday: stat.marked_today
      }
    });
    
  } catch (error) {
    console.error('Quick stats API error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to load stats' 
    });
  }
});

// Helper function to format time ago
function formatTimeAgo(date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) {
    return 'Just now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
}

export default router;