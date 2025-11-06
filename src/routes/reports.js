import express from 'express';
import { all, getDB } from '../db.js';

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

function sendCsv(res, filename, headers, rows) {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  res.write(headers.join(',') + '\n');
  for (const r of rows) {
    res.write(headers.map(h => esc(r[h])).join(',') + '\n');
  }
  res.end();
}

router.get('/reports/class/:id', requireAuth, async (req, res) => {
  const classId = parseInt(req.params.id, 10);
  const klass = (await all(`SELECT * FROM classes WHERE id = ? AND teacher_id = ?`, [classId, req.session.user.id]))[0];
  if (!klass) return res.status(404).send('Not found');
  const { from, to, format } = req.query;
  const rows = await all(`
    SELECT a.date, s.roll_no, s.name as student_name, a.status
    FROM attendance a
    JOIN students s ON s.id = a.student_id
    WHERE a.class_id = ?
      AND (? IS NULL OR a.date >= ?)
      AND (? IS NULL OR a.date <= ?)
    ORDER BY a.date DESC, CAST(s.roll_no AS INT)
  `, [classId, from || null, from || null, to || null, to || null]);

  if (format === 'csv') {
    return sendCsv(res, `class-${classId}-report.csv`, ['date','roll_no','student_name','status'], rows);
  }
  res.render('report_class', { klass, rows, from: from || '', to: to || '' });
});

// Enhanced reports generation page
router.get('/reports', requireAuth, async (req, res) => {
  try {
    const db = getDB();
    const teacherId = req.session.user.id;

    // Get all classes for this teacher
    const classes = await db.all(`
      SELECT c.*, COUNT(s.id) as student_count
      FROM classes c 
      LEFT JOIN students s ON c.id = s.class_id 
      WHERE c.teacher_id = ? 
      GROUP BY c.id
      ORDER BY c.name
    `, [teacherId]);

    // Get all subjects
    const subjects = await db.all(`
      SELECT DISTINCT id, name FROM subjects ORDER BY name
    `);

    // Get total students count
    const totalStudentsResult = await db.get(`
      SELECT COUNT(s.id) as total
      FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE c.teacher_id = ?
    `, [teacherId]);

    // Get recent reports (mock data for now)
    const recentReports = []; // This would come from a reports history table

    res.render('reports/generate', {
      title: 'Generate Reports',
      classes,
      subjects,
      totalStudents: totalStudentsResult?.total || 0,
      recentReports,
      currentPage: 'reports'
    });
  } catch (error) {
    console.error('Error loading reports page:', error);
    req.session.flash = { message: 'Error loading reports page' };
    res.redirect('/dashboard');
  }
});

// Process report generation
router.post('/reports/generate', requireAuth, async (req, res) => {
  try {
    const db = getDB();
    const teacherId = req.session.user.id;
    const {
      report_type,
      class_id,
      date_range_type,
      calculated_start_date,
      calculated_end_date,
      start_date,
      end_date,
      section_filter,
      subject_filter,
      period_filter,
      attendance_threshold,
      status_filter,
      output_format
    } = req.body;

    // Determine actual date range
    let startDate = calculated_start_date;
    let endDate = calculated_end_date;
    
    if (date_range_type === 'custom') {
      startDate = start_date;
      endDate = end_date;
    }

    // Build the query based on report type and filters
    let query = '';
    let params = [];

    if (report_type === 'class') {
      query = `
        SELECT 
          a.date,
          s.id as student_id,
          s.name as student_name,
          s.roll_number,
          a.status,
          a.remarks,
          c.name as class_name,
          c.section
        FROM attendance a
        JOIN students s ON s.id = a.student_id
        JOIN classes c ON c.id = s.class_id
        WHERE c.id = ? AND c.teacher_id = ?
          AND DATE(a.date) >= DATE(?)
          AND DATE(a.date) <= DATE(?)
      `;
      params = [class_id, teacherId, startDate, endDate];

      // Add optional filters
      if (status_filter) {
        query += ' AND a.status = ?';
        params.push(status_filter);
      }

      if (section_filter) {
        query += ' AND c.section = ?';
        params.push(section_filter);
      }

      query += ' ORDER BY a.date DESC, s.roll_number';
    }

    const reportData = await db.all(query, params);

    // Get class information
    const classInfo = await db.get(`
      SELECT * FROM classes WHERE id = ? AND teacher_id = ?
    `, [class_id, teacherId]);

    // Calculate summary statistics
    const summary = await db.get(`
      SELECT 
        COUNT(DISTINCT a.date) as total_days,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as total_present,
        COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as total_absent,
        COUNT(CASE WHEN a.status = 'late' THEN 1 END) as total_late,
        COUNT(CASE WHEN a.status = 'excused' THEN 1 END) as total_excused,
        COUNT(DISTINCT s.id) as total_students
      FROM attendance a
      JOIN students s ON s.id = a.student_id
      JOIN classes c ON c.id = s.class_id
      WHERE c.id = ? AND c.teacher_id = ?
        AND DATE(a.date) >= DATE(?)
        AND DATE(a.date) <= DATE(?)
    `, [class_id, teacherId, startDate, endDate]);

    // Handle different output formats
    if (output_format === 'csv') {
      return sendCsv(res, `${classInfo.name}-report.csv`, 
        ['date', 'student_name', 'roll_number', 'status', 'remarks'], 
        reportData);
    }

    // For HTML output, render the report page
    res.render('reports/view', {
      title: `${classInfo.name} - Attendance Report`,
      reportType: report_type,
      classInfo,
      reportData,
      summary,
      dateRange: {
        start: startDate,
        end: endDate,
        type: date_range_type
      },
      filters: {
        section: section_filter,
        subject: subject_filter,
        period: period_filter,
        threshold: attendance_threshold,
        status: status_filter
      },
      currentPage: 'reports'
    });

  } catch (error) {
    console.error('Error generating report:', error);
    req.session.flash = { message: 'Error generating report' };
    res.redirect('/reports');
  }
});

// API endpoint to get class details
router.get('/api/class/:id/details', requireAuth, async (req, res) => {
  try {
    const db = getDB();
    const classId = req.params.id;
    const teacherId = req.session.user.id;

    // Verify class belongs to teacher
    const classInfo = await db.get(`
      SELECT * FROM classes WHERE id = ? AND teacher_id = ?
    `, [classId, teacherId]);

    if (!classInfo) {
      return res.status(404).json({ error: 'Class not found' });
    }

    // Get unique sections for this class (if any)
    const sections = await db.all(`
      SELECT DISTINCT section FROM classes 
      WHERE teacher_id = ? AND section IS NOT NULL AND section != ''
      ORDER BY section
    `, [teacherId]);

    // Get periods for this class
    const periods = await db.all(`
      SELECT * FROM periods WHERE class_id = ? ORDER BY name
    `, [classId]);

    res.json({
      success: true,
      classInfo,
      sections: sections.map(s => s.section),
      periods
    });
  } catch (error) {
    console.error('Error fetching class details:', error);
    res.status(500).json({ error: 'Error fetching class details' });
  }
});

router.get('/reports/student/:id', requireAuth, async (req, res) => {
  const studentId = parseInt(req.params.id, 10);
  const student = (await all(`SELECT s.*, c.name as class_name FROM students s JOIN classes c ON c.id = s.class_id WHERE s.id = ? AND c.teacher_id = ?`, [studentId, req.session.user.id]))[0];
  if (!student) return res.status(404).send('Not found');
  const { from, to, format } = req.query;
  const rows = await all(`
    SELECT a.date, a.status
    FROM attendance a
    WHERE a.student_id = ?
      AND (? IS NULL OR a.date >= ?)
      AND (? IS NULL OR a.date <= ?)
    ORDER BY a.date DESC
  `, [studentId, from || null, from || null, to || null, to || null]);

  if (format === 'csv') {
    const mapped = rows.map(r => ({ date: r.date, status: r.status }));
    return sendCsv(res, `student-${studentId}-report.csv`, ['date','status'], mapped);
  }
  res.render('report_student', { student, rows, from: from || '', to: to || '' });
});

export default router;
 
// Period-wise class report
router.get('/reports/class/:id/periods', requireAuth, async (req, res) => {
  const classId = parseInt(req.params.id, 10);
  const klass = (await all(`SELECT * FROM classes WHERE id = ? AND teacher_id = ?`, [classId, req.session.user.id]))[0];
  if (!klass) return res.status(404).send('Not found');
  const { date, format } = req.query;
  const selDate = date || new Date().toISOString().slice(0,10);
  const periods = await all(`SELECT * FROM periods WHERE class_id = ? ORDER BY id ASC`, [classId]);
  const students = await all(`SELECT * FROM students WHERE class_id = ? ORDER BY CAST(roll_no AS INT)`, [classId]);
  const rows = await all(`SELECT * FROM attendance_period WHERE class_id = ? AND date = ?`, [classId, selDate]);
  const present = new Map();
  for (const r of rows) present.set(`${r.student_id}_${r.period_id}`, r.present);
  if (format === 'csv') {
    const headers = ['roll_no','student_name', ...periods.map(p=>p.name)];
    const out = students.map(s => {
      const row = { roll_no: s.roll_no, student_name: s.name };
      for (const p of periods) row[p.name] = present.get(`${s.id}_${p.id}`) ? 1 : 0;
      return row;
    });
    return sendCsv(res, `class-${classId}-periods-${selDate}.csv`, headers, out);
  }
  res.render('report_class_periods', { klass, periods, students, present, date: selDate });
});

// Period-wise student report
router.get('/reports/student/:id/periods', requireAuth, async (req, res) => {
  const studentId = parseInt(req.params.id, 10);
  const student = (await all(`SELECT s.*, c.name as class_name FROM students s JOIN classes c ON c.id = s.class_id WHERE s.id = ? AND c.teacher_id = ?`, [studentId, req.session.user.id]))[0];
  if (!student) return res.status(404).send('Not found');
  const { from, to, format } = req.query;
  const rows = await all(`
    SELECT a.date, p.name as period_name, a.present
    FROM attendance_period a
    JOIN periods p ON p.id = a.period_id
    WHERE a.student_id = ?
      AND (? IS NULL OR a.date >= ?)
      AND (? IS NULL OR a.date <= ?)
    ORDER BY a.date DESC, p.id ASC
  `, [studentId, from || null, from || null, to || null, to || null]);
  if (format === 'csv') {
    return sendCsv(res, `student-${studentId}-periods.csv`, ['date','period_name','present'], rows.map(r=>({ ...r, present: r.present?1:0 })));
  }
  res.render('report_student_periods', { student, rows, from: from || '', to: to || '' });
});

// Class attendance overview (daily summary rows)
router.get('/reports/class/:id/overview', requireAuth, async (req, res) => {
  const classId = parseInt(req.params.id, 10);
  const klass = (await all(`SELECT * FROM classes WHERE id = ? AND teacher_id = ?`, [classId, req.session.user.id]))[0];
  if (!klass) return res.status(404).send('Not found');
  const { from, to, format } = req.query;
  const rows = await all(`
    SELECT date,
      SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) as present,
      SUM(CASE WHEN status='absent' THEN 1 ELSE 0 END) as absent,
      SUM(CASE WHEN status='late' THEN 1 ELSE 0 END) as late,
      SUM(CASE WHEN status='excused' THEN 1 ELSE 0 END) as excused,
      COUNT(id) as total
    FROM attendance
    WHERE class_id = ?
      AND (? IS NULL OR date >= ?)
      AND (? IS NULL OR date <= ?)
    GROUP BY date
    ORDER BY date DESC
  `, [classId, from || null, from || null, to || null, to || null]);

  const enhanced = rows.map(r => ({
    ...r,
    rate: r.total ? Math.round((r.present / r.total) * 100) : 0
  }));

  if (format === 'csv') {
    const headers = ['date','present','absent','late','excused','total','rate'];
    return sendCsv(res, `class-${classId}-overview.csv`, headers, enhanced);
  }
  res.render('overview_class', { klass, rows: enhanced, from: from || '', to: to || '' });
});
