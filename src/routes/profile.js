import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { all, run } from '../db.js';
import { logAuditEvent, AUDIT_ACTIONS } from '../middleware/audit.js';

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

// Configure multer for profile photo uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'profiles');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + req.session.user.id + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, JPG, PNG, GIF) are allowed'));
    }
  }
});

// Profile page
router.get('/profile', requireAuth, async (req, res) => {
  const teacherId = req.session.user.id;
  
  try {
    // Get teacher profile data
    const teacher = await all(`
      SELECT * FROM teachers WHERE id = ?
    `, [teacherId]);
    
    if (teacher.length === 0) {
      req.session.flash = { message: 'Profile not found' };
      return res.redirect('/dashboard');
    }
    
    // Get teacher statistics
    const stats = await all(`
      SELECT 
        (SELECT COUNT(*) FROM classes WHERE teacher_id = ?) as total_classes,
        (SELECT COUNT(*) FROM students WHERE class_id IN (SELECT id FROM classes WHERE teacher_id = ?)) as total_students,
        (SELECT COUNT(*) FROM attendance WHERE class_id IN (SELECT id FROM classes WHERE teacher_id = ?) AND date = date('now')) as today_attendance
    `, [teacherId, teacherId, teacherId]);
    
    res.render('profile', {
      teacher: teacher[0],
      stats: stats[0] || { total_classes: 0, total_students: 0, today_attendance: 0 },
      pageTitle: 'My Profile'
    });
    
  } catch (error) {
    console.error('Profile fetch error:', error);
    req.session.flash = { message: 'Error loading profile' };
    res.redirect('/dashboard');
  }
});

// Update profile
router.post('/profile/update', requireAuth, async (req, res) => {
  const teacherId = req.session.user.id;
  const { name, phone, address, bio, department, designation, date_of_birth } = req.body;
  
  try {
    // Get current profile data for audit log
    const currentProfile = await all(`SELECT * FROM teachers WHERE id = ?`, [teacherId]);
    
    // Update profile
    await run(`
      UPDATE teachers 
      SET name = ?, phone = ?, address = ?, bio = ?, department = ?, designation = ?, 
          date_of_birth = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [name, phone, address, bio, department, designation, date_of_birth, teacherId]);
    
    // Update session data
    req.session.user.name = name;
    
    // Log audit event
    await logAuditEvent({
      userId: teacherId,
      action: AUDIT_ACTIONS.UPDATE_USER,
      resourceType: 'teacher_profile',
      resourceId: teacherId,
      oldValues: currentProfile[0],
      newValues: { name, phone, address, bio, department, designation, date_of_birth },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    req.session.flash = { message: 'Profile updated successfully!' };
    res.redirect('/profile');
    
  } catch (error) {
    console.error('Profile update error:', error);
    req.session.flash = { message: 'Error updating profile. Please try again.' };
    res.redirect('/profile');
  }
});

// Upload profile photo
router.post('/profile/upload-photo', requireAuth, upload.single('profilePhoto'), async (req, res) => {
  const teacherId = req.session.user.id;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Get current profile photo to delete old one
    const currentProfile = await all(`SELECT profile_photo FROM teachers WHERE id = ?`, [teacherId]);
    const oldPhotoPath = currentProfile[0]?.profile_photo;
    
    // Update database with new photo path
    const photoPath = `/uploads/profiles/${req.file.filename}`;
    await run(`
      UPDATE teachers 
      SET profile_photo = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [photoPath, teacherId]);
    
    // Delete old photo file if it exists
    if (oldPhotoPath && oldPhotoPath !== photoPath) {
      const oldFilePath = path.join(process.cwd(), 'public', oldPhotoPath);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }
    
    // Log audit event
    await logAuditEvent({
      userId: teacherId,
      action: 'update_profile_photo',
      resourceType: 'teacher_profile',
      resourceId: teacherId,
      newValues: { profile_photo: photoPath },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({ 
      success: true, 
      photoUrl: photoPath,
      message: 'Profile photo updated successfully!' 
    });
    
  } catch (error) {
    console.error('Photo upload error:', error);
    
    // Clean up uploaded file if there was an error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ error: 'Error uploading photo. Please try again.' });
  }
});

// Change password
router.post('/profile/change-password', requireAuth, async (req, res) => {
  const teacherId = req.session.user.id;
  const { currentPassword, newPassword, confirmPassword } = req.body;
  
  try {
    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'All password fields are required' });
    }
    
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New passwords do not match' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }
    
    // Get current password hash
    const teacher = await all(`SELECT password_hash FROM teachers WHERE id = ?`, [teacherId]);
    
    if (teacher.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    
    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, teacher[0].password_hash);
    
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    
    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    
    // Update password
    await run(`
      UPDATE teachers 
      SET password_hash = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [newPasswordHash, teacherId]);
    
    // Log audit event
    await logAuditEvent({
      userId: teacherId,
      action: 'change_password',
      resourceType: 'teacher_profile',
      resourceId: teacherId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({ 
      success: true, 
      message: 'Password changed successfully!' 
    });
    
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Error changing password. Please try again.' });
  }
});

// Delete profile photo
router.delete('/profile/delete-photo', requireAuth, async (req, res) => {
  const teacherId = req.session.user.id;
  
  try {
    // Get current profile photo
    const currentProfile = await all(`SELECT profile_photo FROM teachers WHERE id = ?`, [teacherId]);
    const photoPath = currentProfile[0]?.profile_photo;
    
    if (photoPath) {
      // Delete file
      const filePath = path.join(process.cwd(), 'public', photoPath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      // Update database
      await run(`
        UPDATE teachers 
        SET profile_photo = NULL, updated_at = datetime('now')
        WHERE id = ?
      `, [teacherId]);
      
      // Log audit event
      await logAuditEvent({
        userId: teacherId,
        action: 'delete_profile_photo',
        resourceType: 'teacher_profile',
        resourceId: teacherId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Profile photo deleted successfully!' 
    });
    
  } catch (error) {
    console.error('Photo delete error:', error);
    res.status(500).json({ error: 'Error deleting photo. Please try again.' });
  }
});

export default router;