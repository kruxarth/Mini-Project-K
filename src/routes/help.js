import express from 'express';

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

// Help main page
router.get('/help', requireAuth, (req, res) => {
  res.render('help/index', {
    title: 'Help Center',
    currentPage: 'help'
  });
});

// Getting Started
router.get('/help/getting-started', requireAuth, (req, res) => {
  res.render('help/getting-started', {
    title: 'Getting Started - Help Center',
    currentPage: 'help'
  });
});

// User Roles & Access
router.get('/help/roles', requireAuth, (req, res) => {
  res.render('help/roles', {
    title: 'User Roles & Access - Help Center',
    currentPage: 'help'
  });
});

// How-To Guides
router.get('/help/how-to', requireAuth, (req, res) => {
  res.render('help/how-to', {
    title: 'How-To Guides - Help Center',
    currentPage: 'help'
  });
});

// FAQs
router.get('/help/faq', requireAuth, (req, res) => {
  res.render('help/faq', {
    title: 'Frequently Asked Questions - Help Center',
    currentPage: 'help'
  });
});

// Troubleshooting
router.get('/help/troubleshooting', requireAuth, (req, res) => {
  res.render('help/troubleshooting', {
    title: 'Troubleshooting - Help Center',
    currentPage: 'help'
  });
});

// Video Tutorials
router.get('/help/videos', requireAuth, (req, res) => {
  res.render('help/videos', {
    title: 'Video Tutorials - Help Center',
    currentPage: 'help'
  });
});

// Contact Support
router.get('/help/contact', requireAuth, (req, res) => {
  res.render('help/contact', {
    title: 'Contact Support - Help Center',
    currentPage: 'help'
  });
});

// Release Notes
router.get('/help/release-notes', requireAuth, (req, res) => {
  res.render('help/release-notes', {
    title: 'Release Notes - Help Center',
    currentPage: 'help'
  });
});

// Keyboard Shortcuts
router.get('/help/shortcuts', requireAuth, (req, res) => {
  res.render('help/shortcuts', {
    title: 'Keyboard Shortcuts - Help Center',
    currentPage: 'help'
  });
});

// Privacy Policy
router.get('/help/privacy', requireAuth, (req, res) => {
  res.render('help/privacy', {
    title: 'Privacy & Data Policy - Help Center',
    currentPage: 'help'
  });
});

export default router;