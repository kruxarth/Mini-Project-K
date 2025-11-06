import express from 'express';
import { all, run } from '../db.js';
import nodemailer from 'nodemailer';
import twilio from 'twilio';

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

router.get('/class/:id/attendance', requireAuth, async (req, res) => {
  const classId = parseInt(req.params.id, 10);
  const klass = (await all(`SELECT * FROM classes WHERE id = ? AND teacher_id = ?`, [classId, req.session.user.id]))[0];
  if (!klass) return res.status(404).send('Not found');
  const students = await all(`SELECT * FROM students WHERE class_id = ? ORDER BY CAST(roll_no AS INT)`, [classId]);
  const date = req.query.date || new Date().toISOString().slice(0,10);
  const existing = await all(`SELECT * FROM attendance WHERE class_id = ? AND date = ?`, [classId, date]);
  const statusMap = new Map(existing.map(r => [r.student_id, r.status]));
  res.render('attendance', { klass, students, date, statusMap });
});

router.post('/class/:id/attendance', requireAuth, async (req, res) => {
  const classId = parseInt(req.params.id, 10);
  const { date } = req.body;
  const klass = (await all(`SELECT * FROM classes WHERE id = ? AND teacher_id = ?`, [classId, req.session.user.id]))[0];
  if (!klass) return res.status(404).send('Not found');
  const students = await all(`SELECT * FROM students WHERE class_id = ?`, [classId]);

  for (const s of students) {
    const isPresent = !!req.body[`present_${s.id}`];
    const value = isPresent ? 'present' : 'absent';
    await run(
      `INSERT INTO attendance (date, class_id, student_id, status) VALUES (?,?,?,?)
       ON CONFLICT(date, student_id) DO UPDATE SET status = excluded.status`,
      [date, classId, s.id, value]
    );
  }

  // Emit real-time update via WebSocket
  const io = req.app.get('io');
  if (io) {
    io.to(`class-${classId}`).emit('attendance-updated', {
      classId,
      date,
      updatedBy: req.session.user.id,
      timestamp: new Date().toISOString()
    });
  }

  const absentees = await all(`SELECT a.*, s.name as student_name, g.email as guardian_email, g.phone as guardian_phone, g.preferred_channel as preferred_channel
    FROM attendance a
    JOIN students s ON s.id = a.student_id
    LEFT JOIN guardians g ON g.student_id = s.id
    WHERE a.class_id = ? AND a.date = ? AND a.status = 'absent'`, [classId, date]);

  if (absentees.length > 0 && process.env.SMTP_HOST) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });

    for (const a of absentees) {
      if (!a.guardian_email) continue;
      try {
        const info = await transporter.sendMail({
          from: process.env.SMTP_FROM || 'no-reply@example.com',
          to: a.guardian_email,
          subject: `Absence Notice: ${a.student_name} on ${a.date}`,
          text: `${a.student_name} was marked ABSENT on ${a.date}. If this is an error, please contact the class teacher.`,
        });
        await run(`INSERT INTO notification_log (attendance_id, channel, status, provider_id, sent_at) VALUES (?,?,?,?,datetime('now'))`, [
          a.id, 'email', 'sent', info.messageId || null
        ]);
      } catch (e) {
        await run(`INSERT INTO notification_log (attendance_id, channel, status, error, sent_at) VALUES (?,?,?,?,datetime('now'))`, [
          a.id, 'email', 'failed', String(e)
        ]);
      }
    }
  }

  if (absentees.length > 0 && process.env.TWILIO_SID && process.env.TWILIO_TOKEN && process.env.TWILIO_FROM) {
    const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
    for (const a of absentees) {
      if (!a.guardian_phone) continue;
      try {
        const body = `${a.student_name} was marked ABSENT on ${a.date}. If this is an error, please contact the class teacher.`;
        const msg = await client.messages.create({ from: process.env.TWILIO_FROM, to: a.guardian_phone, body });
        await run(`INSERT INTO notification_log (attendance_id, channel, status, provider_id, sent_at) VALUES (?,?,?,?,datetime('now'))`, [
          a.id, 'sms', 'sent', msg.sid
        ]);
      } catch (e) {
        await run(`INSERT INTO notification_log (attendance_id, channel, status, error, sent_at) VALUES (?,?,?,?,datetime('now'))`, [
          a.id, 'sms', 'failed', String(e)
        ]);
      }
    }
  }

  res.redirect(`/class/${classId}/attendance?date=${encodeURIComponent(date)}&saved=1`);
});

export default router;
