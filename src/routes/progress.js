const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const db = require('../services/db');

// GET /api/progress/my
// Returns overall counters and per-module stats for current user
router.get('/my', requireAuth, async (req, res) => {
  try {
    const userId = req.user.supabaseUserId;
    if (!userId) return res.status(400).json({ message: 'Missing supabaseUserId in token' });

    const [overall, byModule] = await Promise.all([
      db.query(
        `select coalesce(sum(correct_count + wrong_count),0)::int as total_solved,
                coalesce(sum(correct_count),0)::int as correct_sum,
                coalesce(sum(wrong_count),0)::int as wrong_sum,
                case when coalesce(sum(correct_count + wrong_count),0) = 0 then 0
                     else round(100.0 * coalesce(sum(correct_count),0) / nullif(sum(correct_count + wrong_count),0)) end::int as success_rate
         from user_progress
         where user_id = $1`,
        [userId]
      ),
      db.query(
        `select m.id as module_id, m.name as module_name,
                up.correct_count::int, up.wrong_count::int,
                case when (up.correct_count + up.wrong_count) = 0 then 0
                     else round(100.0 * up.correct_count / nullif((up.correct_count + up.wrong_count),0)) end::int as success_rate
         from user_progress up
         join modules m on m.id = up.module_id
         where up.user_id = $1
         order by m.name asc`,
        [userId]
      )
    ]);

    return res.json({
      overall: overall.rows[0] || { total_solved: 0, success_rate: 0 },
      modules: byModule.rows,
    });
  } catch (err) {
    console.error('progress/my error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
