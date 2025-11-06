import express from 'express';
import { all, run } from '../db.js';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('login', { error: null });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const rows = await all(`SELECT * FROM teachers WHERE email = ?`, [email]);
  if (rows.length === 0) return res.status(401).render('login', { error: 'Invalid credentials' });
  const teacher = rows[0];
  const ok = await bcrypt.compare(password, teacher.password_hash);
  if (!ok) return res.status(401).render('login', { error: 'Invalid credentials' });
  req.session.user = { id: teacher.id, name: teacher.name, email: teacher.email };
  res.redirect('/dashboard');
});

// Registration page
router.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('register', { 
    error: null, 
    success: null,
    formData: {}
  });
});

// Handle registration with file upload
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configure multer for profile photo upload
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
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Handle registration
router.post('/register', upload.single('profilePhoto'), async (req, res) => {
  const { 
    name, email, password, confirmPassword, phone, dateOfBirth, address,
    department, designation, employeeId, bio
  } = req.body;
  
  try {
    // Validation
    const errors = [];
    
    if (!name || name.trim().length < 2) {
      errors.push('Name must be at least 2 characters long');
    }
    
    if (!email || !email.includes('@')) {
      errors.push('Please enter a valid email address');
    }
    
    if (!password || password.length < 6) {
      errors.push('Password must be at least 6 characters long');
    }
    
    if (password !== confirmPassword) {
      errors.push('Passwords do not match');
    }
    
    if (!department) {
      errors.push('Please select a department');
    }
    
    if (!designation) {
      errors.push('Please select a designation');
    }
    
    // Validate phone number if provided
    if (phone && !/^[\+]?[1-9][\d]{0,15}$/.test(phone.replace(/[\s\-\(\)]/g, ''))) {
      errors.push('Please enter a valid phone number');
    }
    
    // Validate date of birth if provided
    if (dateOfBirth) {
      const birthDate = new Date(dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      if (age < 18 || age > 100) {
        errors.push('Please enter a valid date of birth (age must be between 18-100)');
      }
    }
    
    if (errors.length > 0) {
      // Clean up uploaded file if validation fails
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      
      return res.render('register', {
        error: errors.join(', '),
        success: null,
        formData: { 
          name, email, phone, dateOfBirth, address, 
          department, designation, employeeId, bio 
        }
      });
    }
    
    // Check if email already exists
    const existingUser = await all(`SELECT id FROM teachers WHERE email = ?`, [email]);
    if (existingUser.length > 0) {
      // Clean up uploaded file
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      
      return res.render('register', {
        error: 'An account with this email already exists',
        success: null,
        formData: { 
          name, email, phone, dateOfBirth, address, 
          department, designation, employeeId, bio 
        }
      });
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    // Handle profile photo
    let profilePhotoPath = null;
    if (req.file) {
      profilePhotoPath = `/uploads/profiles/${req.file.filename}`;
    }
    
    // Create user account (unverified) with complete profile
    const now = new Date().toISOString();
    const result = await run(`
      INSERT INTO teachers (
        name, email, password_hash, phone, address, profile_photo, bio,
        department, designation, date_of_birth, date_joined,
        email_verified, verification_token, token_expiry, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, date('now'), 0, ?, ?, ?, ?)
    `, [
      name.trim(), 
      email.toLowerCase(), 
      passwordHash, 
      phone || null,
      address || null,
      profilePhotoPath,
      bio || null,
      department, 
      designation, 
      dateOfBirth || null,
      verificationToken, 
      tokenExpiry.toISOString(),
      now,
      now
    ]);
    
    // Send verification email
    const emailSent = await sendVerificationEmail(email, name, verificationToken);
    
    if (emailSent) {
      res.render('register', {
        error: null,
        success: `Registration successful! Please check your email (${email}) for verification instructions. Your complete profile has been saved.`,
        formData: {}
      });
    } else {
      // If email fails, still allow login but show warning
      res.render('register', {
        error: null,
        success: `Registration successful! Your complete profile has been saved. Email verification is temporarily unavailable. You can login directly.`,
        formData: {}
      });
    }
    
  } catch (error) {
    console.error('Registration error:', error);
    
    // Clean up uploaded file on error
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error cleaning up uploaded file:', unlinkError);
      }
    }
    
    res.render('register', {
      error: 'Registration failed. Please try again.',
      success: null,
      formData: { 
        name, email, phone, dateOfBirth, address, 
        department, designation, employeeId, bio 
      }
    });
  }
});

// Email verification
router.get('/verify-email/:token', async (req, res) => {
  const { token } = req.params;
  
  try {
    const user = await all(`
      SELECT id, name, email, token_expiry 
      FROM teachers 
      WHERE verification_token = ? AND email_verified = 0
    `, [token]);
    
    if (user.length === 0) {
      return res.render('verification-result', {
        success: false,
        message: 'Invalid or expired verification link'
      });
    }
    
    const teacher = user[0];
    const now = new Date();
    const expiry = new Date(teacher.token_expiry);
    
    if (now > expiry) {
      return res.render('verification-result', {
        success: false,
        message: 'Verification link has expired. Please register again.'
      });
    }
    
    // Verify the email
    await run(`
      UPDATE teachers 
      SET email_verified = 1, verification_token = NULL, token_expiry = NULL
      WHERE id = ?
    `, [teacher.id]);
    
    res.render('verification-result', {
      success: true,
      message: `Email verified successfully! Welcome ${teacher.name}. You can now login.`
    });
    
  } catch (error) {
    console.error('Email verification error:', error);
    res.render('verification-result', {
      success: false,
      message: 'Verification failed. Please try again.'
    });
  }
});

// Resend verification email
router.post('/resend-verification', async (req, res) => {
  const { email } = req.body;
  
  try {
    const user = await all(`
      SELECT id, name, email 
      FROM teachers 
      WHERE email = ? AND email_verified = 0
    `, [email]);
    
    if (user.length === 0) {
      return res.json({
        success: false,
        message: 'No unverified account found with this email'
      });
    }
    
    const teacher = user[0];
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    // Update verification token
    await run(`
      UPDATE teachers 
      SET verification_token = ?, token_expiry = ?
      WHERE id = ?
    `, [verificationToken, tokenExpiry.toISOString(), teacher.id]);
    
    // Send verification email
    const emailSent = await sendVerificationEmail(teacher.email, teacher.name, verificationToken);
    
    res.json({
      success: emailSent,
      message: emailSent ? 
        'Verification email sent successfully' : 
        'Failed to send verification email'
    });
    
  } catch (error) {
    console.error('Resend verification error:', error);
    res.json({
      success: false,
      message: 'Failed to resend verification email'
    });
  }
});

// Update login to check email verification
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const rows = await all(`SELECT * FROM teachers WHERE email = ?`, [email]);
    if (rows.length === 0) {
      return res.status(401).render('login', { 
        error: 'Invalid credentials' 
      });
    }
    
    const teacher = rows[0];
    const passwordValid = await bcrypt.compare(password, teacher.password_hash);
    
    if (!passwordValid) {
      return res.status(401).render('login', { 
        error: 'Invalid credentials' 
      });
    }
    
    // Check if email is verified (if verification system is enabled)
    if (teacher.email_verified === 0 && process.env.SMTP_HOST) {
      return res.render('login', {
        error: 'Please verify your email before logging in. Check your inbox for verification instructions.',
        showResendLink: true,
        email: email
      });
    }
    
    // Login successful
    req.session.user = { 
      id: teacher.id, 
      name: teacher.name, 
      email: teacher.email 
    };
    
    res.redirect('/dashboard');
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).render('login', { 
      error: 'Login failed. Please try again.' 
    });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// Helper function to send verification email
async function sendVerificationEmail(email, name, token) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log('SMTP not configured, skipping email verification');
    return false;
  }
  
  try {
    const transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    
    const verificationUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/verify-email/${token}`;
    
    const mailOptions = {
      from: process.env.SMTP_FROM || 'AttendanceMS <no-reply@attendancems.com>',
      to: email,
      subject: 'Verify Your AttendanceMS Account',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Verify Your Account</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎓 Welcome to AttendanceMS!</h1>
            </div>
            <div class="content">
              <h2>Hello ${name}!</h2>
              <p>Thank you for registering with AttendanceMS. To complete your registration and start managing attendance, please verify your email address.</p>
              
              <div style="text-align: center;">
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
              </div>
              
              <p>Or copy and paste this link in your browser:</p>
              <p style="word-break: break-all; background: #e9ecef; padding: 10px; border-radius: 4px;">${verificationUrl}</p>
              
              <p><strong>This link will expire in 24 hours.</strong></p>
              
              <p>If you didn't create this account, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>AttendanceMS - Modern Attendance Management System</p>
              <p>This is an automated email, please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };
    
    await transporter.sendMail(mailOptions);
    return true;
    
  } catch (error) {
    console.error('Email sending error:', error);
    return false;
  }
}

export default router;
