import express from 'express';
import { all, run } from '../db.js';

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

// Test endpoint to simulate attendance updates
router.post('/test/mark-attendance', requireAuth, async (req, res) => {
  const { classId, studentId, status } = req.body;
  const today = new Date().toISOString().slice(0, 10);
  
  try {
    // Mark attendance
    await run(`
      INSERT OR REPLACE INTO attendance 
      (date, class_id, student_id, status, marked_at) 
      VALUES (?, ?, ?, ?, datetime('now'))
    `, [today, classId, studentId, status]);
    
    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`class-${classId}`).emit('attendance-updated', {
        classId,
        studentId,
        status,
        date: today,
        updatedBy: req.session.user.id,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({ success: true, message: 'Attendance marked successfully' });
    
  } catch (error) {
    console.error('Test attendance error:', error);
    res.status(500).json({ error: 'Failed to mark attendance' });
  }
});

export default router;