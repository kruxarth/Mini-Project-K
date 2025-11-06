import express from 'express';
import alertService from '../services/alert-service.js';

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

// Get all alerts
router.get('/api/alerts', requireAuth, (req, res) => {
  try {
    const alerts = alertService.getAllAlerts();
    const stats = alertService.getStats();
    
    res.json({
      success: true,
      alerts,
      stats
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alerts'
    });
  }
});

// Get unread alerts
router.get('/api/alerts/unread', requireAuth, (req, res) => {
  try {
    const alerts = alertService.getUnreadAlerts();
    
    res.json({
      success: true,
      alerts,
      count: alerts.length
    });
  } catch (error) {
    console.error('Error fetching unread alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unread alerts'
    });
  }
});

// Mark alert as read
router.post('/api/alerts/:id/read', requireAuth, (req, res) => {
  try {
    const alertId = parseFloat(req.params.id);
    const alert = alertService.markAsRead(alertId);
    
    if (alert) {
      res.json({
        success: true,
        alert
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }
  } catch (error) {
    console.error('Error marking alert as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark alert as read'
    });
  }
});

// Mark all alerts as read
router.post('/api/alerts/read-all', requireAuth, (req, res) => {
  try {
    alertService.markAllAsRead();
    
    res.json({
      success: true,
      message: 'All alerts marked as read'
    });
  } catch (error) {
    console.error('Error marking all alerts as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark all alerts as read'
    });
  }
});

// Dismiss alert
router.delete('/api/alerts/:id', requireAuth, (req, res) => {
  try {
    const alertId = parseFloat(req.params.id);
    const alert = alertService.dismissAlert(alertId);
    
    if (alert) {
      res.json({
        success: true,
        message: 'Alert dismissed'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }
  } catch (error) {
    console.error('Error dismissing alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to dismiss alert'
    });
  }
});

// Add new alert (for testing/admin use)
router.post('/api/alerts', requireAuth, (req, res) => {
  try {
    const { type, title, message, options } = req.body;
    
    if (!type || !title || !message) {
      return res.status(400).json({
        success: false,
        error: 'Type, title, and message are required'
      });
    }
    
    const alert = alertService.addAlert(type.toUpperCase(), title, message, options);
    
    res.json({
      success: true,
      alert
    });
  } catch (error) {
    console.error('Error adding alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add alert'
    });
  }
});

// Get alert statistics
router.get('/api/alerts/stats', requireAuth, (req, res) => {
  try {
    const stats = alertService.getStats();
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching alert stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alert statistics'
    });
  }
});

export default router;