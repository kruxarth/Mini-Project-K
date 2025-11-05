import { run } from '../db.js';

// Audit log actions
const AUDIT_ACTIONS = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  CREATE_CLASS: 'create_class',
  UPDATE_CLASS: 'update_class',
  DELETE_CLASS: 'delete_class',
  CREATE_STUDENT: 'create_student',
  UPDATE_STUDENT: 'update_student',
  DELETE_STUDENT: 'delete_student',
  MARK_ATTENDANCE: 'mark_attendance',
  UPDATE_ATTENDANCE: 'update_attendance',
  DELETE_ATTENDANCE: 'delete_attendance',
  SEND_EMAIL: 'send_email',
  EXPORT_REPORT: 'export_report',
  BULK_IMPORT: 'bulk_import',
  SYSTEM_CONFIG: 'system_config'
};

// Initialize audit log table
async function initializeAuditTable() {
  await run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      resource_type TEXT,
      resource_id INTEGER,
      old_values TEXT,
      new_values TEXT,
      ip_address TEXT,
      user_agent TEXT,
      timestamp TEXT DEFAULT (datetime('now')),
      success INTEGER DEFAULT 1,
      error_message TEXT,
      FOREIGN KEY (user_id) REFERENCES teachers(id)
    )
  `);
}

// Log audit event
async function logAuditEvent({
  userId,
  action,
  resourceType = null,
  resourceId = null,
  oldValues = null,
  newValues = null,
  ipAddress = null,
  userAgent = null,
  success = true,
  errorMessage = null
}) {
  try {
    await run(`
      INSERT INTO audit_logs (
        user_id, action, resource_type, resource_id, 
        old_values, new_values, ip_address, user_agent, 
        success, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userId,
      action,
      resourceType,
      resourceId,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      ipAddress,
      userAgent,
      success ? 1 : 0,
      errorMessage
    ]);
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}

// Middleware to automatically log certain actions
function auditMiddleware(action, resourceType = null) {
  return (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log the audit event
      const userId = req.session.user?.id;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent');
      const success = res.statusCode < 400;
      
      logAuditEvent({
        userId,
        action,
        resourceType,
        resourceId: req.params.id ? parseInt(req.params.id) : null,
        newValues: req.body,
        ipAddress,
        userAgent,
        success,
        errorMessage: success ? null : 'Request failed'
      });
      
      originalSend.call(this, data);
    };
    
    next();
  };
}

// Middleware to track attendance changes specifically
function auditAttendanceChange(req, res, next) {
  // Store original attendance data for comparison
  req.auditData = {
    action: AUDIT_ACTIONS.MARK_ATTENDANCE,
    resourceType: 'attendance',
    userId: req.session.user?.id,
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent')
  };
  
  next();
}

// Function to log attendance changes with detailed information
async function logAttendanceChange(studentId, oldStatus, newStatus, userId, note = null) {
  await logAuditEvent({
    userId,
    action: AUDIT_ACTIONS.MARK_ATTENDANCE,
    resourceType: 'attendance',
    resourceId: studentId,
    oldValues: { status: oldStatus },
    newValues: { status: newStatus, note },
    success: true
  });
}

// Function to get audit history for a specific resource
async function getAuditHistory(resourceType, resourceId, limit = 50) {
  const { all } = await import('../db.js');
  
  return await all(`
    SELECT 
      al.*,
      t.name as user_name,
      t.email as user_email
    FROM audit_logs al
    LEFT JOIN teachers t ON al.user_id = t.id
    WHERE al.resource_type = ? AND al.resource_id = ?
    ORDER BY al.timestamp DESC
    LIMIT ?
  `, [resourceType, resourceId, limit]);
}

// Function to get user activity history
async function getUserActivity(userId, limit = 100) {
  const { all } = await import('../db.js');
  
  return await all(`
    SELECT *
    FROM audit_logs
    WHERE user_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `, [userId, limit]);
}

// Function to get system-wide audit summary
async function getAuditSummary(days = 30) {
  const { all } = await import('../db.js');
  
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);
  
  return await all(`
    SELECT 
      action,
      COUNT(*) as count,
      COUNT(CASE WHEN success = 0 THEN 1 END) as failures
    FROM audit_logs
    WHERE date(timestamp) >= ?
    GROUP BY action
    ORDER BY count DESC
  `, [sinceStr]);
}

export {
  AUDIT_ACTIONS,
  initializeAuditTable,
  logAuditEvent,
  auditMiddleware,
  auditAttendanceChange,
  logAttendanceChange,
  getAuditHistory,
  getUserActivity,
  getAuditSummary
};