const express = require('express');
const router = express.Router();
const { signup, login, activate, getMe, updateMe, changePassword } = require('../controllers/userController');
const { requireAuth } = require('../middleware/auth');

// Signup
router.post('/signup', (req, res, next) => {
  signup(req, res).catch(next);
});

// Login
router.post('/login', (req, res, next) => {
  login(req, res).catch(next);
});

// Activate account with subscription code
router.post('/activate', requireAuth, (req, res, next) => {
  activate(req, res).catch(next);
});

// Get current user profile
router.get('/me', requireAuth, (req, res, next) => {
  getMe(req, res).catch(next);
});

// Update current user profile
router.put('/me', requireAuth, (req, res, next) => {
  updateMe(req, res).catch(next);
});

// Change password
router.post('/change-password', requireAuth, (req, res, next) => {
  changePassword(req, res).catch(next);
});

module.exports = router;