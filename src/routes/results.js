const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const db = require('../services/db');

// POST /api/results/start { moduleId, mode }
router.post('/start', requireAuth, async (req, res) => {
  try {
    const userId = req.user.supabaseUserId;
    const { moduleId, mode } = req.body;
    if (!userId) return res.status(400).json({ message: 'Missing supabaseUserId in token' });
    if (!moduleId || !mode) return res.status(400).json({ message: 'moduleId and mode are required' });
    const { rows } = await db.query(
      `insert into results (user_id, module_id, mode, score, total)
       values ($1,$2,$3,0,0)
       returning id`,
      [userId, moduleId, mode]
    );
    return res.status(201).json({ resultId: rows[0].id });
  } catch (err) {
    console.error('results/start error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET /api/results/active - latest unfinished session for current user
router.get('/active', requireAuth, async (req, res) => {
  try {
    const userId = req.user.supabaseUserId;
    const { rows } = await db.query(
      `select r.id, r.mode, r.module_id, r.started_at
       from results r
       where r.user_id = $1 and r.completed_at is null
       order by r.started_at desc
       limit 1`,
      [userId]
    );
    return res.json(rows[0] || null);
  } catch (err) {
    console.error('results/active error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET /api/results/:id/answers - list qcm_ids answered in a result
router.get('/:id/answers', requireAuth, async (req, res) => {
  try {
    const resultId = req.params.id;
    const { rows } = await db.query(
      `select qcm_id from result_answers where result_id = $1 order by qcm_id`,
      [resultId]
    );
    return res.json(rows.map(r => r.qcm_id));
  } catch (err) {
    console.error('results/:id/answers error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/results/answer { resultId, qcmId, selectedIndex }
router.post('/answer', requireAuth, async (req, res) => {
  try {
    const { resultId, qcmId, selectedIndex } = req.body;
    if (!resultId || !qcmId || typeof selectedIndex !== 'number') {
      return res.status(400).json({ message: 'resultId, qcmId and selectedIndex are required' });
    }
    // Compute correctness using qcm.answer_index
    const q = await db.query('select answer_index from qcm where id = $1', [qcmId]);
    if (q.rowCount === 0) return res.status(404).json({ message: 'QCM not found' });
    const answerIndex = q.rows[0].answer_index;
    const isCorrect = (typeof answerIndex === 'number') ? (answerIndex === selectedIndex) : null;
    let correctText = null;
    if (typeof answerIndex === 'number') {
      const c = await db.query('select text from qcm_choices where qcm_id = $1 order by id asc', [qcmId]);
      // choices order by id may not match original index order. Prefer stable ordering by insertion; alternatively store index.
      // For now, attempt to fetch in creation order using created_at if exists; fallback to id order.
      if (c.rowCount > answerIndex) {
        correctText = c.rows[answerIndex]?.text || null;
      }
    }

    await db.query(
      `insert into result_answers (result_id, qcm_id, selected_index, is_correct)
       values ($1,$2,$3,$4)`,
      [resultId, qcmId, selectedIndex, isCorrect]
    );
    return res.status(201).json({ ok: true, isCorrect, correctIndex: answerIndex ?? null, correctText });
  } catch (err) {
    console.error('results/answer error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/results/finish { resultId }
router.post('/finish', requireAuth, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { resultId } = req.body;
    if (!resultId) return res.status(400).json({ message: 'resultId is required' });

    await client.query('begin');
    const agg = await client.query(
      `select count(*)::int as total,
              coalesce(sum(case when is_correct is true then 1 else 0 end),0)::int as correct
       from result_answers
       where result_id = $1`,
      [resultId]
    );
    const total = agg.rows[0].total;
    const correct = agg.rows[0].correct;

    const upd = await client.query(
      `update results set score = $2, total = $3, completed_at = now()
       where id = $1
       returning user_id, module_id, mode, score, total, started_at, completed_at`,
      [resultId, correct, total]
    );
    if (upd.rowCount === 0) {
      await client.query('rollback');
      return res.status(404).json({ message: 'Result not found' });
    }
    const row = upd.rows[0];

    // Upsert user_progress
    await client.query(
      `insert into user_progress (user_id, module_id, correct_count, wrong_count, last_activity_at)
       values ($1,$2,$3,$4, now())
       on conflict (user_id, module_id)
       do update set correct_count = user_progress.correct_count + excluded.correct_count,
                     wrong_count = user_progress.wrong_count + excluded.wrong_count,
                     last_activity_at = now()`,
      [row.user_id, row.module_id, correct, (total - correct)]
    );

    await client.query('commit');
    return res.json({
      result: {
        id: resultId,
        mode: row.mode,
        score: row.score,
        total: row.total,
        started_at: row.started_at,
        completed_at: row.completed_at,
      }
    });
  } catch (err) {
    await client.query('rollback');
    console.error('results/finish error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  } finally {
    client.release();
  }
});

// GET /api/results/my - list recent results for current user
router.get('/my', requireAuth, async (req, res) => {
  try {
    const userId = req.user.supabaseUserId;
    const { rows } = await db.query(
      `select r.id, r.mode, r.score, r.total, r.started_at, r.completed_at,
              r.module_id, m.name as module_name
       from results r
       left join modules m on m.id = r.module_id
       where r.user_id = $1
       order by coalesce(r.completed_at, r.started_at) desc
       limit 30`,
      [userId]
    );
    return res.json(rows);
  } catch (err) {
    console.error('results/my error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
