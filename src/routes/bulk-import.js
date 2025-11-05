import express from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';
import { all, run } from '../db.js';
import { requirePermission, PERMISSIONS } from '../middleware/rbac.js';
import { logAuditEvent, AUDIT_ACTIONS } from '../middleware/audit.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

// CSV Import page
router.get('/class/:id/import-advanced', requireAuth, requirePermission(PERMISSIONS.CREATE_STUDENT), async (req, res) => {
  const classId = parseInt(req.params.id);
  const teacherId = req.session.user.id;
  
  // Verify teacher owns this class
  const classInfo = await all(`
    SELECT * FROM classes WHERE id = ? AND teacher_id = ?
  `, [classId, teacherId]);
  
  if (classInfo.length === 0) {
    req.session.flash = { message: 'Class not found or access denied' };
    return res.redirect('/dashboard');
  }

  res.render('bulk-import', {
    class: classInfo[0],
    pageTitle: `Import Students - ${classInfo[0].name}`
  });
});

// CSV Upload and Preview
router.post('/class/:id/upload-csv', requireAuth, requirePermission(PERMISSIONS.CREATE_STUDENT), upload.single('csvFile'), async (req, res) => {
  const classId = parseInt(req.params.id);
  const teacherId = req.session.user.id;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Verify teacher owns this class
    const classInfo = await all(`
      SELECT * FROM classes WHERE id = ? AND teacher_id = ?
    `, [classId, teacherId]);
    
    if (classInfo.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Parse CSV file
    const results = await parseCSVFile(req.file.path);
    
    // Validate data
    const validation = validateStudentData(results.data);
    
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
    
    res.json({
      success: true,
      data: results.data,
      headers: results.headers,
      validation: validation,
      preview: results.data.slice(0, 10) // First 10 rows for preview
    });

  } catch (error) {
    console.error('CSV upload error:', error);
    
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ error: error.message });
  }
});

// Process CSV Import
router.post('/class/:id/process-import', requireAuth, requirePermission(PERMISSIONS.CREATE_STUDENT), async (req, res) => {
  const classId = parseInt(req.params.id);
  const teacherId = req.session.user.id;
  const { students, mapping, options } = req.body;
  
  try {
    // Verify teacher owns this class
    const classInfo = await all(`
      SELECT * FROM classes WHERE id = ? AND teacher_id = ?
    `, [classId, teacherId]);
    
    if (classInfo.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const results = await processStudentImport(classId, students, mapping, options);
    
    // Log audit event
    await logAuditEvent({
      userId: teacherId,
      action: AUDIT_ACTIONS.BULK_IMPORT,
      resourceType: 'students',
      resourceId: classId,
      newValues: { 
        imported: results.imported, 
        skipped: results.skipped, 
        errors: results.errors.length 
      },
      success: results.errors.length === 0
    });

    res.json({
      success: true,
      results: results
    });

  } catch (error) {
    console.error('Import processing error:', error);
    
    await logAuditEvent({
      userId: teacherId,
      action: AUDIT_ACTIONS.BULK_IMPORT,
      resourceType: 'students',
      resourceId: classId,
      success: false,
      errorMessage: error.message
    });
    
    res.status(500).json({ error: error.message });
  }
});

// Download CSV template
router.get('/csv-template', requireAuth, (req, res) => {
  const templatePath = path.join(process.cwd(), 'templates', 'student-import-template.csv');
  
  // Create template if it doesn't exist
  if (!fs.existsSync(templatePath)) {
    const templateDir = path.dirname(templatePath);
    if (!fs.existsSync(templateDir)) {
      fs.mkdirSync(templateDir, { recursive: true });
    }
    
    const templateContent = `name,roll_no,parent_name,parent_email,parent_phone,date_of_birth,address
John Doe,001,Jane Doe,jane.doe@email.com,+1234567890,2010-05-15,123 Main St
Alice Smith,002,Bob Smith,bob.smith@email.com,+1234567891,2010-08-22,456 Oak Ave
Charlie Brown,003,Lucy Brown,lucy.brown@email.com,+1234567892,2010-03-10,789 Pine Rd`;
    
    fs.writeFileSync(templatePath, templateContent);
  }
  
  res.download(templatePath, 'student-import-template.csv');
});

// Helper function to parse CSV file
function parseCSVFile(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    let headers = [];
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('headers', (headerList) => {
        headers = headerList;
      })
      .on('data', (data) => {
        results.push(data);
      })
      .on('end', () => {
        resolve({ data: results, headers });
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

// Helper function to validate student data
function validateStudentData(students) {
  const errors = [];
  const warnings = [];
  const duplicates = [];
  
  const seenRollNumbers = new Set();
  const seenEmails = new Set();
  
  students.forEach((student, index) => {
    const rowNum = index + 1;
    
    // Required field validation
    if (!student.name || student.name.trim() === '') {
      errors.push(`Row ${rowNum}: Name is required`);
    }
    
    if (!student.roll_no || student.roll_no.trim() === '') {
      errors.push(`Row ${rowNum}: Roll number is required`);
    } else {
      // Check for duplicate roll numbers
      if (seenRollNumbers.has(student.roll_no)) {
        duplicates.push(`Row ${rowNum}: Duplicate roll number ${student.roll_no}`);
      }
      seenRollNumbers.add(student.roll_no);
    }
    
    // Email validation
    if (student.parent_email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(student.parent_email)) {
        errors.push(`Row ${rowNum}: Invalid email format`);
      } else {
        // Check for duplicate emails
        if (seenEmails.has(student.parent_email)) {
          warnings.push(`Row ${rowNum}: Duplicate email ${student.parent_email}`);
        }
        seenEmails.add(student.parent_email);
      }
    } else {
      warnings.push(`Row ${rowNum}: No parent email provided - weekly reports won't be sent`);
    }
    
    // Phone validation
    if (student.parent_phone) {
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
      if (!phoneRegex.test(student.parent_phone.replace(/[\s\-\(\)]/g, ''))) {
        warnings.push(`Row ${rowNum}: Invalid phone number format`);
      }
    }
    
    // Date validation
    if (student.date_of_birth) {
      const date = new Date(student.date_of_birth);
      if (isNaN(date.getTime())) {
        warnings.push(`Row ${rowNum}: Invalid date format for date of birth`);
      }
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors: [...errors, ...duplicates],
    warnings,
    summary: {
      totalRows: students.length,
      validRows: students.length - errors.length,
      errorCount: errors.length,
      warningCount: warnings.length
    }
  };
}

// Helper function to process student import
async function processStudentImport(classId, students, mapping, options = {}) {
  const results = {
    imported: 0,
    skipped: 0,
    updated: 0,
    errors: []
  };
  
  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    const rowNum = i + 1;
    
    try {
      // Map fields according to user selection
      const mappedStudent = {};
      Object.keys(mapping).forEach(csvField => {
        const dbField = mapping[csvField];
        if (dbField && student[csvField]) {
          mappedStudent[dbField] = student[csvField].trim();
        }
      });
      
      // Check if student already exists
      const existing = await all(`
        SELECT id FROM students 
        WHERE class_id = ? AND roll_no = ?
      `, [classId, mappedStudent.roll_no]);
      
      if (existing.length > 0) {
        if (options.updateExisting) {
          // Update existing student
          await run(`
            UPDATE students 
            SET name = ?, parent_name = ?, parent_email = ?, 
                parent_phone = ?, date_of_birth = ?, address = ?
            WHERE id = ?
          `, [
            mappedStudent.name,
            mappedStudent.parent_name,
            mappedStudent.parent_email,
            mappedStudent.parent_phone,
            mappedStudent.date_of_birth,
            mappedStudent.address,
            existing[0].id
          ]);
          
          // Update guardian information
          if (mappedStudent.parent_name || mappedStudent.parent_email) {
            await run(`
              INSERT OR REPLACE INTO guardians 
              (student_id, name, email, phone, preferred_channel)
              VALUES (?, ?, ?, ?, 'email')
            `, [
              existing[0].id,
              mappedStudent.parent_name,
              mappedStudent.parent_email,
              mappedStudent.parent_phone
            ]);
          }
          
          results.updated++;
        } else {
          results.skipped++;
        }
      } else {
        // Insert new student
        const studentResult = await run(`
          INSERT INTO students 
          (class_id, name, roll_no, parent_name, parent_email, parent_phone, date_of_birth, address)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          classId,
          mappedStudent.name,
          mappedStudent.roll_no,
          mappedStudent.parent_name,
          mappedStudent.parent_email,
          mappedStudent.parent_phone,
          mappedStudent.date_of_birth,
          mappedStudent.address
        ]);
        
        // Insert guardian information
        if (mappedStudent.parent_name || mappedStudent.parent_email) {
          await run(`
            INSERT INTO guardians 
            (student_id, name, email, phone, preferred_channel)
            VALUES (?, ?, ?, ?, 'email')
          `, [
            studentResult.lastID,
            mappedStudent.parent_name,
            mappedStudent.parent_email,
            mappedStudent.parent_phone
          ]);
        }
        
        results.imported++;
      }
      
    } catch (error) {
      console.error(`Error processing row ${rowNum}:`, error);
      results.errors.push(`Row ${rowNum}: ${error.message}`);
    }
  }
  
  return results;
}

export default router;