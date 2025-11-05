// Role-Based Access Control Middleware

const ROLES = {
  ADMIN: 'admin',
  TEACHER: 'teacher',
  PARENT: 'parent',
  STUDENT: 'student'
};

const PERMISSIONS = {
  // User management
  CREATE_USER: 'create_user',
  READ_USER: 'read_user',
  UPDATE_USER: 'update_user',
  DELETE_USER: 'delete_user',
  
  // Class management
  CREATE_CLASS: 'create_class',
  READ_CLASS: 'read_class',
  UPDATE_CLASS: 'update_class',
  DELETE_CLASS: 'delete_class',
  
  // Student management
  CREATE_STUDENT: 'create_student',
  READ_STUDENT: 'read_student',
  UPDATE_STUDENT: 'update_student',
  DELETE_STUDENT: 'delete_student',
  
  // Attendance management
  MARK_ATTENDANCE: 'mark_attendance',
  VIEW_ATTENDANCE: 'view_attendance',
  EDIT_ATTENDANCE: 'edit_attendance',
  
  // Reports
  VIEW_REPORTS: 'view_reports',
  EXPORT_REPORTS: 'export_reports',
  
  // Email/SMS
  SEND_NOTIFICATIONS: 'send_notifications',
  
  // System administration
  MANAGE_SYSTEM: 'manage_system',
  VIEW_AUDIT_LOGS: 'view_audit_logs'
};

// Role-Permission mapping
const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: [
    PERMISSIONS.CREATE_USER,
    PERMISSIONS.READ_USER,
    PERMISSIONS.UPDATE_USER,
    PERMISSIONS.DELETE_USER,
    PERMISSIONS.CREATE_CLASS,
    PERMISSIONS.READ_CLASS,
    PERMISSIONS.UPDATE_CLASS,
    PERMISSIONS.DELETE_CLASS,
    PERMISSIONS.CREATE_STUDENT,
    PERMISSIONS.READ_STUDENT,
    PERMISSIONS.UPDATE_STUDENT,
    PERMISSIONS.DELETE_STUDENT,
    PERMISSIONS.MARK_ATTENDANCE,
    PERMISSIONS.VIEW_ATTENDANCE,
    PERMISSIONS.EDIT_ATTENDANCE,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.EXPORT_REPORTS,
    PERMISSIONS.SEND_NOTIFICATIONS,
    PERMISSIONS.MANAGE_SYSTEM,
    PERMISSIONS.VIEW_AUDIT_LOGS
  ],
  
  [ROLES.TEACHER]: [
    PERMISSIONS.READ_USER,
    PERMISSIONS.CREATE_CLASS,
    PERMISSIONS.READ_CLASS,
    PERMISSIONS.UPDATE_CLASS,
    PERMISSIONS.CREATE_STUDENT,
    PERMISSIONS.READ_STUDENT,
    PERMISSIONS.UPDATE_STUDENT,
    PERMISSIONS.MARK_ATTENDANCE,
    PERMISSIONS.VIEW_ATTENDANCE,
    PERMISSIONS.EDIT_ATTENDANCE,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.EXPORT_REPORTS,
    PERMISSIONS.SEND_NOTIFICATIONS
  ],
  
  [ROLES.PARENT]: [
    PERMISSIONS.VIEW_ATTENDANCE,
    PERMISSIONS.VIEW_REPORTS
  ],
  
  [ROLES.STUDENT]: [
    PERMISSIONS.VIEW_ATTENDANCE
  ]
};

// Middleware to check if user has required permission
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = req.session.user.role || ROLES.TEACHER; // Default to teacher for backward compatibility
    const userPermissions = ROLE_PERMISSIONS[userRole] || [];

    if (!userPermissions.includes(permission)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: permission,
        userRole: userRole
      });
    }

    next();
  };
}

// Middleware to check if user has any of the required roles
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = req.session.user.role || ROLES.TEACHER;
    
    if (!roles.includes(userRole)) {
      return res.status(403).json({ 
        error: 'Insufficient role',
        required: roles,
        userRole: userRole
      });
    }

    next();
  };
}

// Helper function to check if user owns the resource
function requireOwnership(getResourceOwnerId) {
  return async (req, res, next) => {
    try {
      const userId = req.session.user.id;
      const resourceOwnerId = await getResourceOwnerId(req);
      
      if (userId !== resourceOwnerId) {
        // Check if user is admin
        const userRole = req.session.user.role || ROLES.TEACHER;
        if (userRole !== ROLES.ADMIN) {
          return res.status(403).json({ error: 'Access denied: not resource owner' });
        }
      }
      
      next();
    } catch (error) {
      console.error('Ownership check error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

// Middleware to add user permissions to response locals
function addPermissionsToLocals(req, res, next) {
  if (req.session.user) {
    const userRole = req.session.user.role || ROLES.TEACHER;
    res.locals.userPermissions = ROLE_PERMISSIONS[userRole] || [];
    res.locals.userRole = userRole;
  } else {
    res.locals.userPermissions = [];
    res.locals.userRole = null;
  }
  next();
}

// Helper function to check permission in templates
function hasPermission(userPermissions, permission) {
  return userPermissions && userPermissions.includes(permission);
}

export {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  requirePermission,
  requireRole,
  requireOwnership,
  addPermissionsToLocals,
  hasPermission
};