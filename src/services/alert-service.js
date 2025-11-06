/**
 * Alert Service for AttendanceMS
 * Manages different types of alerts with severity levels
 */

class AlertService {
  constructor() {
    this.alerts = [];
    this.alertTypes = {
      SUCCESS: {
        type: 'success',
        color: '#28a745',
        bgColor: 'rgba(40, 167, 69, 0.1)',
        borderColor: '#28a745',
        icon: 'fas fa-check-circle',
        emoji: '✅'
      },
      INFO: {
        type: 'info',
        color: '#17a2b8',
        bgColor: 'rgba(23, 162, 184, 0.1)',
        borderColor: '#17a2b8',
        icon: 'fas fa-info-circle',
        emoji: 'ℹ️'
      },
      WARNING: {
        type: 'warning',
        color: '#ffc107',
        bgColor: 'rgba(255, 193, 7, 0.1)',
        borderColor: '#ffc107',
        icon: 'fas fa-exclamation-triangle',
        emoji: '⚠️'
      },
      ERROR: {
        type: 'error',
        color: '#dc3545',
        bgColor: 'rgba(220, 53, 69, 0.1)',
        borderColor: '#dc3545',
        icon: 'fas fa-times-circle',
        emoji: '❌'
      },
      SYSTEM: {
        type: 'system',
        color: '#6c757d',
        bgColor: 'rgba(108, 117, 125, 0.1)',
        borderColor: '#6c757d',
        icon: 'fas fa-cog',
        emoji: '🛠️'
      }
    };
  }

  /**
   * Add a new alert
   * @param {string} type - Alert type (SUCCESS, INFO, WARNING, ERROR, SYSTEM)
   * @param {string} title - Alert title
   * @param {string} message - Alert message
   * @param {Object} options - Additional options
   */
  addAlert(type, title, message, options = {}) {
    const alertType = this.alertTypes[type] || this.alertTypes.INFO;
    
    const alert = {
      id: Date.now() + Math.random(),
      type: alertType.type,
      title,
      message,
      timestamp: new Date(),
      isRead: false,
      isDismissible: options.isDismissible !== false,
      autoHide: options.autoHide || false,
      duration: options.duration || 5000,
      priority: options.priority || 'normal',
      category: options.category || 'general',
      actionUrl: options.actionUrl || null,
      actionText: options.actionText || null,
      ...alertType
    };

    this.alerts.unshift(alert);
    
    // Limit to 50 alerts to prevent memory issues
    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(0, 50);
    }

    return alert;
  }

  /**
   * Get all alerts
   */
  getAllAlerts() {
    return this.alerts;
  }

  /**
   * Get unread alerts
   */
  getUnreadAlerts() {
    return this.alerts.filter(alert => !alert.isRead);
  }

  /**
   * Get alerts by type
   */
  getAlertsByType(type) {
    return this.alerts.filter(alert => alert.type === type);
  }

  /**
   * Mark alert as read
   */
  markAsRead(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.isRead = true;
    }
    return alert;
  }

  /**
   * Mark all alerts as read
   */
  markAllAsRead() {
    this.alerts.forEach(alert => {
      alert.isRead = true;
    });
  }

  /**
   * Dismiss alert
   */
  dismissAlert(alertId) {
    const index = this.alerts.findIndex(a => a.id === alertId);
    if (index > -1) {
      return this.alerts.splice(index, 1)[0];
    }
    return null;
  }

  /**
   * Clear all alerts
   */
  clearAllAlerts() {
    this.alerts = [];
  }

  /**
   * Get alert statistics
   */
  getStats() {
    const total = this.alerts.length;
    const unread = this.getUnreadAlerts().length;
    const byType = {};
    
    Object.keys(this.alertTypes).forEach(type => {
      byType[type.toLowerCase()] = this.getAlertsByType(type.toLowerCase()).length;
    });

    return {
      total,
      unread,
      read: total - unread,
      byType
    };
  }

  /**
   * Generate sample alerts for demonstration
   */
  generateSampleAlerts() {
    // Success alerts
    this.addAlert('SUCCESS', 'Attendance Marked', 'Successfully marked attendance for Class 10A - 32 students present.', {
      category: 'attendance',
      actionUrl: '/attendance/view/123',
      actionText: 'View Details'
    });

    this.addAlert('SUCCESS', 'Report Generated', 'Weekly attendance report has been generated and sent to parents.', {
      category: 'reports',
      actionUrl: '/reports/weekly/456',
      actionText: 'Download Report'
    });

    // Info alerts
    this.addAlert('INFO', 'New Features Available', 'Check out the new analytics dashboard and improved notification system.', {
      category: 'features',
      actionUrl: '/help/release-notes',
      actionText: 'Learn More'
    });

    this.addAlert('INFO', 'Parent Meeting Reminder', 'Parent-teacher meeting scheduled for next Friday at 2:00 PM.', {
      category: 'events',
      priority: 'high'
    });

    // Warning alerts
    this.addAlert('WARNING', 'Low Attendance Alert', 'Class 9B has attendance below 75% this week. Consider follow-up actions.', {
      category: 'attendance',
      priority: 'high',
      actionUrl: '/analytics/class/9b',
      actionText: 'View Analytics'
    });

    this.addAlert('WARNING', 'Email Delivery Issues', 'Some parent notification emails are bouncing. Please verify email addresses.', {
      category: 'notifications',
      actionUrl: '/settings/notifications',
      actionText: 'Check Settings'
    });

    // Error alerts
    this.addAlert('ERROR', 'CSV Import Failed', 'Failed to import student data from CSV file. Please check the file format.', {
      category: 'import',
      actionUrl: '/help/troubleshooting#csv-import',
      actionText: 'Get Help'
    });

    // System alerts
    this.addAlert('SYSTEM', 'Scheduled Maintenance', 'System maintenance scheduled for tonight 11:00 PM - 2:00 AM EST.', {
      category: 'maintenance',
      priority: 'high',
      isDismissible: false
    });

    this.addAlert('SYSTEM', 'Database Backup Complete', 'Daily database backup completed successfully at 3:00 AM.', {
      category: 'backup'
    });
  }
}

// Create singleton instance
const alertService = new AlertService();

// Generate sample alerts for demonstration
alertService.generateSampleAlerts();

export default alertService;