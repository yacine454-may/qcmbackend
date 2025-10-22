const express = require('express');
const router = express.Router();
const { signup, login, activate, getMe, updateMe, changePassword } = require('../controllers/userController');
const { requireAuth } = require('../middleware/auth');
const { pool } = require('../services/db');

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

// Get user progress statistics for all modules
router.get('/progress', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Query to get progress statistics for each module
    const query = `
      SELECT 
        m.id as module_id,
        m.name as module_name,
        m.level,
        m.category,
        COUNT(DISTINCT q.id) as total_qcm,
        COUNT(DISTINCT CASE 
          WHEN r.is_correct = true THEN r.qcm_id 
        END) as correct_answers,
        COUNT(DISTINCT CASE 
          WHEN r.is_correct = false THEN r.qcm_id 
        END) as incorrect_answers,
        COUNT(DISTINCT q.id) - COUNT(DISTINCT r.qcm_id) as unanswered
      FROM modules m
      LEFT JOIN qcm q ON q.module_id = m.id
      LEFT JOIN (
        SELECT DISTINCT ON (ra.qcm_id) 
          ra.qcm_id, 
          ra.is_correct
        FROM result_answers ra
        JOIN results res ON res.id = ra.result_id
        WHERE res.user_id = $1
        ORDER BY ra.qcm_id, ra.answered_at DESC
      ) r ON r.qcm_id = q.id
      WHERE m.is_active = true
      GROUP BY m.id, m.name, m.level, m.category
      ORDER BY m.category, m.name
    `;
    
    const result = await pool.query(query, [userId]);
    res.json(result.rows);
    
  } catch (error) {
    console.error('Error fetching user progress:', error);
    next(error);
  }
});

module.exports = router;