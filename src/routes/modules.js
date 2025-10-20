const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const db = require('../services/db');

// Maps role to module levels; RES gets all
const allowedLevelsByRole = {
  '4A': ['4A'],
  '5A': ['5A'],
  '6A': ['6A'],
  'RES': ['4A','5A','6A','RES'],
};

// GET /api/modules/my - modules allowed by the user's role
router.get('/my', requireAuth, async (req, res) => {
  try {
    const role = req.user?.role || null;
    if (!role) return res.status(403).json({ message: 'Compte non activé (aucun rôle)' });

    const levels = allowedLevelsByRole[role] || [];
    const { rows } = await db.query(
      `select m.id, m.name, m.slug, m.level, m.category,
              coalesce(count(q.id), 0)::int as qcm_count
       from modules m
       left join qcm q on q.module_id = m.id
       where m.is_active = true
         and (m.level = any($1) or $2 = true)
       group by m.id, m.name, m.slug, m.level, m.category
       order by m.category asc, m.name asc`,
      [levels, role === 'RES']
    );
    return res.json(rows);
  } catch (err) {
    console.error('modules/my error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET /api/modules/by-category - modules grouped by category
router.get('/by-category', requireAuth, async (req, res) => {
  try {
    const role = req.user?.role || null;
    if (!role) return res.status(403).json({ message: 'Compte non activé (aucun rôle)' });

    const levels = allowedLevelsByRole[role] || [];
    const { rows } = await db.query(
      `select m.id, m.name, m.slug, m.level, 
              coalesce(m.category, 'Médicale') as category,
              coalesce(count(q.id), 0)::int as qcm_count
       from modules m
       left join qcm q on q.module_id = m.id
       where m.is_active = true
         and (m.level = any($1) or $2 = true)
       group by m.id, m.name, m.slug, m.level, m.category
       order by m.category asc, m.name asc`,
      [levels, role === 'RES']
    );
    
    // Group modules by category
    const grouped = {
      'Médicale': [],
      'Chirurgicale': [],
      'Biologie': []
    };
    
    rows.forEach(module => {
      const cat = module.category || 'Médicale';
      if (grouped[cat]) {
        grouped[cat].push(module);
      }
    });
    
    return res.json(grouped);
  } catch (err) {
    console.error('modules/by-category error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
