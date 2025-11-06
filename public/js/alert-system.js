/**
 * AttendanceMS Alert System
 * Professional alert management for dashboard
 */

class AlertSystem {
  constructor() {
    this.alerts = [];
    this.isInitialized = false;
    this.refreshInterval = null;
    this.notificationSound = null;
    
    this.init();
  }

  async init() {
    if (this.isInitialized) return;
    
    this.createAlertContainer();
    this.createAlertStyles();
    this.setupEventListeners();
    await this.loadAlerts();
    this.startAutoRefresh();
    
    this.isInitialized = true;
    console.log('Alert System initialized');
  }

  createAlertContainer() {
    // Create main alert container
    const alertContainer = document.createElement('div');
    alertContainer.id = 'alert-system-container';
    alertContainer.innerHTML = `
      <!-- Alert Bell Icon -->
      <div id="alert-bell" class="alert-bell">
        <i class="fas fa-bell"></i>
        <span id="alert-count" class="alert-count">0</span>
      </div>

      <!-- Alert Dropdown -->
      <div id="alert-dropdown" class="alert-dropdown">
        <div class="alert-header">
          <h6><i class="fas fa-bell me-2"></i>Notifications</h6>
          <div class="alert-actions">
            <button id="mark-all-read" class="btn-link" title="Mark all as read">
              <i class="fas fa-check-double"></i>
            </button>
            <button id="refresh-alerts" class="btn-link" title="Refresh">
              <i class="fas fa-sync-alt"></i>
            </button>
          </div>
        </div>
        
        <div class="alert-filters">
          <button class="filter-btn active" data-filter="all">All</button>
          <button class="filter-btn" data-filter="unread">Unread</button>
          <button class="filter-btn" data-filter="success">Success</button>
          <button class="filter-btn" data-filter="warning">Warning</button>
          <button class="filter-btn" data-filter="error">Error</button>
        </div>
        
        <div id="alert-list" class="alert-list">
          <div class="alert-loading">
            <i class="fas fa-spinner fa-spin"></i>
            <span>Loading alerts...</span>
          </div>
        </div>
        
        <div class="alert-footer">
          <a href="/help/contact" class="btn-link">
            <i class="fas fa-headset me-1"></i>Contact Support
          </a>
        </div>
      </div>

      <!-- Toast Container -->
      <div id="toast-container" class="toast-container"></div>
    `;

    // Insert into navbar or appropriate location
    const navbar = document.querySelector('.navbar .container-fluid, .navbar .container');
    if (navbar) {
      navbar.appendChild(alertContainer);
    } else {
      document.body.appendChild(alertContainer);
    }
  }

  createAlertStyles() {
    const style = document.createElement('style