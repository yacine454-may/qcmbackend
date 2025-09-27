const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const db = require('../services/db');

// GET /api/qcm/sb?moduleId=...
// Returns an array of { id, question, choices: [text,...] } without exposing answers
router.get('/', requireAuth, async (req, res) => {
  try {
    const { moduleId, limit, offset } = req.query;
    if (!moduleId) return res.status(400).json({ message: 'moduleId is required' });
    const lim = Math.min(parseInt(limit || '25', 10) || 25, 100);
    const off = Math.max(parseInt(offset || '0', 10) || 0, 0);

    // Fetch qcms for module
    const qcms = await db.query(
      `select id, question
       from qcm
       where module_id = $1
       order by created_at asc
       limit $2 offset $3`,
      [moduleId, lim, off]
    );

    if (qcms.rowCount === 0) return res.json([]);

    const ids = qcms.rows.map(r => r.id);

    // Fetch choices for these qcms (order by id; if you have created_at use it instead)
    const choicesRes = await db.query(
      `select qc.qcm_id, qc.text
       from qcm_choices qc
       where qc.qcm_id = any($1)
       order by qc.id asc`,
      [ids]
    );

    const choicesByQcm = new Map();
    for (const row of choicesRes.rows) {
      if (!choicesByQcm.has(row.qcm_id)) choicesByQcm.set(row.qcm_id, []);
      choicesByQcm.get(row.qcm_id).push(row.text);
    }

    const payload = qcms.rows.map(r => ({
      id: r.id,
      question: r.question,
      choices: choicesByQcm.get(r.id) || [],
    }));

    return res.json(payload);
  } catch (err) {
    console.error('qcm/sb error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
