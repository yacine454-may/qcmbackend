const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const db = require('../services/db');
const bcrypt = require('bcryptjs');

function slugify(name) {
  return (name || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

// GET /api/admin/users?role=4A - Get users by role with counts
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { role } = req.query;
    
    // Get user counts by role
    const countsQuery = await db.query(`
      SELECT role, COUNT(*) as count 
      FROM users 
      WHERE role IS NOT NULL 
      GROUP BY role
    `);
    
    const counts = {};
    countsQuery.rows.forEach(row => {
      counts[row.role] = parseInt(row.count);
    });
    
    // Get users for specific role if provided
    let users = [];
    if (role) {
      const usersQuery = await db.query(`
        SELECT 
          id, 
          email, 
          username, 
          first_name,
          last_name,
          role, 
          is_active, 
          is_admin,
          created_at,
          last_login_at,
          (SELECT MAX(started_at) FROM results WHERE user_id = users.id) as last_activity_at
        FROM users 
        WHERE role = $1 
        ORDER BY created_at DESC
      `, [role]);
      
      users = usersQuery.rows.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name || user.username.split('_')[0] || '',
        lastName: user.last_name || user.username.split('_')[1] || '',
        role: user.role,
        isActive: user.is_active,
        isAdmin: user.is_admin,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at || user.last_activity_at
      }));
    }
    
    return res.json({ users, counts });
  } catch (err) {
    console.error('admin/users error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/admin/users - Create a user (admin only)
// Body: { firstName?, lastName?, name?, email, password, role, code }
router.post('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { firstName, lastName, name, email, password, role, code } = req.body || {};
    if (!email || !password || !role || !code) {
      return res.status(400).json({ message: 'email, password, role et code sont requis' });
    }
    if (!['4A','5A','6A','RES'].includes(role)) {
      return res.status(400).json({ message: 'role invalide' });
    }

    // Derive names if only a single name is provided
    let fName = firstName;
    let lName = lastName;
    if ((!fName && !lName) && name) {
      const parts = String(name).trim().split(/\s+/);
      fName = parts[0] || null;
      lName = parts.slice(1).join(' ') || null;
    }

    // Generate a username from email local-part if not provided
    let username = (email.split('@')[0] || '').toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    if (!username) username = `user_${Math.random().toString(36).slice(2,8)}`;

    // Ensure email or username not already taken
    const dup = await db.query('select 1 from users where email = $1 or username = $2 limit 1', [email, username]);
    if (dup.rowCount > 0) {
      return res.status(409).json({ message: 'Utilisateur déjà existant (email ou username)' });
    }

    // Ensure subscription code is unique (subscription_codes.code is unique)
    const codeExists = await db.query('select 1 from subscription_codes where code = $1 limit 1', [code]);
    if (codeExists.rowCount > 0) {
      return res.status(409).json({ message: 'Ce code est déjà utilisé. Veuillez en choisir un autre.' });
    }

    const hash = await bcrypt.hash(String(password), 10);

    const client = await db.pool.connect();
    try {
      await client.query('begin');
      const ins = await client.query(
        `insert into users (email, username, password_hash, role, is_active, is_admin, first_name, last_name)
         values ($1,$2,$3,$4,true,false,$5,$6)
         returning id, email, username, role, is_active, is_admin`,
        [email, username, hash, role, fName || null, lName || null]
      );
      const u = ins.rows[0];

      // Assign unique code to this user (mark as used by this user)
      await client.query(
        `insert into subscription_codes (code, role, is_active, used_by, used_at)
         values ($1,$2,false,$3, now())`,
        [code, role, u.id]
      );

      await client.query('commit');
      return res.status(201).json({
        ok: true,
        user: u
      });
    } catch (err) {
      await client.query('rollback');
      console.error('admin/users create error:', err);
      return res.status(500).json({ message: 'Erreur serveur' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('admin/users post error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
});

// PATCH /api/admin/users/:id/status - Toggle user active status
router.patch('/users/:id/status', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ message: 'isActive must be a boolean' });
    }
    
    const result = await db.query(
      'UPDATE users SET is_active = $1 WHERE id = $2 RETURNING id, username, email, is_active',
      [isActive, id]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    return res.json({ 
      ok: true, 
      user: result.rows[0],
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (err) {
    console.error('admin/users/status error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET /api/admin/users/:id - Get user details
router.get('/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const userQuery = await db.query(`
      SELECT 
        id, 
        email, 
        username, 
        role, 
        is_active, 
        is_admin,
        created_at,
        (SELECT COUNT(*) FROM results WHERE user_id = users.id) as total_sessions,
        (SELECT COUNT(*) FROM results WHERE user_id = users.id AND completed_at IS NOT NULL) as completed_sessions,
        (SELECT AVG(score::float / NULLIF(total, 0) * 100) FROM results WHERE user_id = users.id AND completed_at IS NOT NULL) as avg_score
      FROM users 
      WHERE id = $1
    `, [id]);
    
    if (userQuery.rowCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = userQuery.rows[0];
    
    // Get user's recent activity
    const activityQuery = await db.query(`
      SELECT 
        r.id,
        r.mode,
        r.score,
        r.total,
        r.started_at,
        r.completed_at,
        m.name as module_name
      FROM results r
      LEFT JOIN modules m ON r.module_id = m.id
      WHERE r.user_id = $1
      ORDER BY r.started_at DESC
      LIMIT 10
    `, [id]);
    
    const userDetails = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.is_active,
      isAdmin: user.is_admin,
      createdAt: user.created_at,
      stats: {
        totalSessions: parseInt(user.total_sessions) || 0,
        completedSessions: parseInt(user.completed_sessions) || 0,
        averageScore: user.avg_score ? Math.round(parseFloat(user.avg_score)) : 0
      },
      recentActivity: activityQuery.rows
    };
    
    return res.json(userDetails);
  } catch (err) {
    console.error('admin/users/:id error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/admin/users/promote { email }
router.post('/users/promote', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ message: 'email is required' });
    const r = await db.query('update users set is_admin = true where email = $1 returning id, email, is_admin', [email]);
    if (r.rowCount === 0) return res.status(404).json({ message: 'User not found' });
    return res.json({ ok: true, user: r.rows[0] });
  } catch (err) {
    console.error('admin/users/promote error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET /api/admin/qcm?moduleId=...&limit=50&offset=0
router.get('/qcm', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { moduleId, limit, offset } = req.query;
    if (!moduleId) return res.status(400).json({ message: 'moduleId is required' });
    const lim = Math.min(parseInt(limit || '50', 10) || 50, 200);
    const off = Math.max(parseInt(offset || '0', 10) || 0, 0);
    const qs = await db.query(
      `select id, question, explanation, difficulty, answer_index
       from qcm where module_id = $1
       order by created_at asc
       limit $2 offset $3`,
      [moduleId, lim, off]
    );
    const ids = qs.rows.map(r => r.id);
    let choices = [];
    if (ids.length) {
      const cr = await db.query(
        `select id, qcm_id, text, is_correct from qcm_choices where qcm_id = any($1) order by id asc`,
        [ids]
      );
      choices = cr.rows;
    }
    const byId = new Map();
    for (const q of qs.rows) byId.set(q.id, { ...q, choices: [] });
    for (const c of choices) {
      byId.get(c.qcm_id)?.choices.push({ id: c.id, text: c.text, is_correct: c.is_correct });
    }
    return res.json(Array.from(byId.values()));
  } catch (err) {
    console.error('admin/qcm list error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
});

// DELETE /api/admin/modules/:id
router.delete('/modules/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const r = await db.query('delete from modules where id = $1', [id]);
    return res.json({ ok: true, deleted: r.rowCount });
  } catch (err) {
    console.error('admin/modules delete error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
});

// DELETE /api/admin/qcm/:id
router.delete('/qcm/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const r = await db.query('delete from qcm where id = $1', [id]);
    return res.json({ ok: true, deleted: r.rowCount });
  } catch (err) {
    console.error('admin/qcm delete error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
});

// PUT /api/admin/qcm/:id { question, answer_index, difficulty?, explanation?, choices: [ { id?, text } ] }
router.put('/qcm/:id', requireAuth, requireAdmin, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const id = req.params.id;
    const { question, answer_index, difficulty, explanation, choices } = req.body || {};
    if (!question || typeof answer_index !== 'number' || !Array.isArray(choices) || choices.length < 2) {
      return res.status(400).json({ message: 'question, answer_index and at least 2 choices are required' });
    }
    await client.query('begin');
    await client.query(
      `update qcm set question=$1, answer_index=$2, difficulty=$3, explanation=$4 where id=$5`,
      [question, answer_index, difficulty || null, explanation || null, id]
    );
    // Replace choices for simplicity
    await client.query('delete from qcm_choices where qcm_id = $1', [id]);
    for (let i = 0; i < choices.length; i++) {
      await client.query(
        `insert into qcm_choices (qcm_id, text, is_correct) values ($1,$2,$3)`,
        [id, choices[i].text || String(choices[i]), i === answer_index]
      );
    }
    await client.query('commit');
    return res.json({ ok: true });
  } catch (err) {
    await client.query('rollback');
    console.error('admin/qcm update error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  } finally {
    client.release();
  }
});

// POST /api/admin/qcm/import { moduleId, csv }
// CSV columns: question, choice1, choice2, choice3, choice4, answer_index(1-based), [difficulty], [explanation]
router.post('/qcm/import', requireAuth, requireAdmin, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { moduleId, csv } = req.body || {};
    if (!moduleId || !csv) return res.status(400).json({ message: 'moduleId and csv are required' });
    const lines = csv.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let created = 0;
    await client.query('begin');
    for (const line of lines) {
      const cols = line.split(',').map(s => s.trim());
      if (cols.length < 6) continue;
      const [question, c1, c2, c3, c4, ansIdxStr, diff, expl] = cols;
      const choices = [c1, c2, c3, c4].filter(x => x && x.length);
      const answer_index = Math.max(0, (parseInt(ansIdxStr, 10) || 1) - 1);
      const q = await client.query(
        `insert into qcm (module_id, question, explanation, difficulty, answer_index)
         values ($1,$2,$3,$4,$5) returning id`,
        [moduleId, question, expl || null, diff || null, answer_index]
      );
      const qid = q.rows[0].id;
      for (let i = 0; i < choices.length; i++) {
        await client.query(
          `insert into qcm_choices (qcm_id, text, is_correct) values ($1,$2,$3)`,
          [qid, choices[i], i === answer_index]
        );
      }
      created += 1;
    }
    await client.query('commit');
    return res.json({ ok: true, created });
  } catch (err) {
    await client.query('rollback');
    console.error('admin/qcm import error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  } finally {
    client.release();
  }
});
// POST /api/admin/modules { name, level }
router.post('/modules', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, level } = req.body || {};
    if (!name || !level) return res.status(400).json({ message: 'name and level are required' });
    if (!['4A','5A','6A','RES'].includes(level)) return res.status(400).json({ message: 'invalid level' });
    const slug = slugify(name);
    const r = await db.query(
      `insert into modules (name, slug, level, is_active)
       values ($1,$2,$3,true)
       on conflict (slug) do update set name = excluded.name, level = excluded.level, is_active = true
       returning id, name, slug, level`,
      [name, slug, level]
    );
    return res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error('admin/modules error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET /api/admin/modules?level=4A
router.get('/modules', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { level } = req.query;
    let q = 'select id, name, slug, level from modules';
    const params = [];
    if (level) { q += ' where level = $1'; params.push(level); }
    q += ' order by name asc';
    const { rows } = await db.query(q, params);
    return res.json(rows);
  } catch (err) {
    console.error('admin/modules list error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/admin/qcm { moduleId, question, choices: [text...], answer_index }
router.post('/qcm', requireAuth, requireAdmin, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { moduleId, question, choices, answer_index, explanation, difficulty } = req.body || {};
    if (!moduleId || !question || !Array.isArray(choices) || choices.length < 2 || typeof answer_index !== 'number') {
      return res.status(400).json({ message: 'moduleId, question, choices[>=2], and answer_index are required' });
    }
    await client.query('begin');
    const q = await client.query(
      `insert into qcm (module_id, question, explanation, difficulty, answer_index)
       values ($1,$2,$3,$4,$5)
       returning id`,
      [moduleId, question, explanation || null, difficulty || null, answer_index]
    );
    const qid = q.rows[0].id;
    for (let i = 0; i < choices.length; i++) {
      await client.query(
        `insert into qcm_choices (qcm_id, text, is_correct) values ($1,$2,$3)`,
        [qid, choices[i], i === answer_index]
      );
    }
    await client.query('commit');
    return res.status(201).json({ id: qid });
  } catch (err) {
    await client.query('rollback');
    console.error('admin/qcm error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  } finally {
    client.release();
  }
});

// POST /api/admin/seed - insert example modules, qcm, and choices
router.post('/seed', requireAuth, requireAdmin, async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('begin');

    // Seed modules (upsert by slug)
    const modules = [
      { name: 'Cardiology', slug: 'cardiology', level: '4A' },
      { name: 'Neurology', slug: 'neurology', level: '4A' },
      { name: 'Orthopedics', slug: 'orthopedics', level: '5A' },
      { name: 'Dermatology', slug: 'dermatology', level: '6A' }
    ];

    for (const m of modules) {
      await client.query(
        `insert into modules (name, slug, level, is_active)
         values ($1,$2,$3,true)
         on conflict (slug) do update set name = excluded.name, level = excluded.level, is_active = true`,
        [m.name, m.slug, m.level]
      );
    }

    // Map slug to id
    const modRows = await client.query('select id, slug from modules where slug = any($1)', [modules.map(m => m.slug)]);
    const modBySlug = Object.fromEntries(modRows.rows.map(r => [r.slug, r.id]));

    // Seed a few QCMs per module (if none exist yet) using simple EXISTS check
    async function seedQcmFor(slug, items) {
      const mid = modBySlug[slug];
      if (!mid) return;
      const has = await client.query('select 1 from qcm where module_id = $1 limit 1', [mid]);
      if (has.rowCount > 0) return; // already has questions
      for (const it of items) {
        const q = await client.query(
          `insert into qcm (module_id, question, explanation, difficulty, answer_index)
           values ($1,$2,$3,$4,$5)
           returning id`,
          [mid, it.question, it.explanation || null, it.difficulty || null, it.answer_index]
        );
        const qid = q.rows[0].id;
        for (const c of it.choices) {
          await client.query(
            `insert into qcm_choices (qcm_id, text, is_correct)
             values ($1,$2,$3)`,
            [qid, c.text, !!c.is_correct]
          );
        }
      }
    }

    await seedQcmFor('cardiology', [
      {
        question: 'Which medication reduces mortality in HFrEF?',
        explanation: 'ACE inhibitors reduce afterload and improve survival.',
        difficulty: 'Easy',
        answer_index: 0,
        choices: [
          { text: 'ACE inhibitors', is_correct: true },
          { text: 'Short-acting nitrates', is_correct: false },
          { text: 'Digoxin', is_correct: false },
          { text: 'Loop diuretics', is_correct: false },
        ]
      },
      {
        question: 'STEMI management: next step after aspirin?',
        explanation: 'Dual antiplatelet therapy is recommended.',
        difficulty: 'Medium',
        answer_index: 2,
        choices: [
          { text: 'Warfarin', is_correct: false },
          { text: 'Amiodarone', is_correct: false },
          { text: 'P2Y12 inhibitor (e.g., clopidogrel)', is_correct: true },
          { text: 'Atropine', is_correct: false },
        ]
      }
    ]);

    await seedQcmFor('neurology', [
      {
        question: 'First-line therapy for status epilepticus?',
        explanation: 'Benzodiazepines are first-line.',
        difficulty: 'Easy',
        answer_index: 1,
        choices: [
          { text: 'Phenytoin', is_correct: false },
          { text: 'Lorazepam', is_correct: true },
          { text: 'Levetiracetam', is_correct: false },
          { text: 'Valproate', is_correct: false },
        ]
      }
    ]);

    await seedQcmFor('orthopedics', [
      {
        question: 'Best initial imaging for suspected fracture?',
        explanation: 'Plain radiograph is typically first.',
        difficulty: 'Easy',
        answer_index: 0,
        choices: [
          { text: 'X-ray', is_correct: true },
          { text: 'MRI', is_correct: false },
          { text: 'CT with contrast', is_correct: false },
          { text: 'Ultrasound', is_correct: false },
        ]
      }
    ]);

    await client.query('commit');
    return res.json({ ok: true });
  } catch (err) {
    await client.query('rollback');
    console.error('admin/seed error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  } finally {
    client.release();
  }
});

module.exports = router;
