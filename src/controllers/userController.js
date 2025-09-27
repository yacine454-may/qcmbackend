// User controller (Supabase only)
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../services/db');

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

exports.signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'username, email et password sont requis' });
    }

    // Check existing user by email or username
    const dup = await db.query(
      'select 1 from users where email = $1 or username = $2 limit 1',
      [email, username]
    );
    if (dup.rowCount > 0) {
      return res.status(409).json({ message: 'Utilisateur déjà existant (email ou username)' });
    }

    const hash = await bcrypt.hash(password, 10);
    const insert = await db.query(
      `insert into users (email, username, password_hash, role, is_active, is_admin)
       values ($1,$2,$3,$4,$5,$6)
       returning id, email, username, role, is_active, is_admin`,
      [email, username, hash, null, false, false]
    );
    const u = insert.rows[0];

    const token = jwt.sign({ supabaseUserId: u.id, email: u.email, role: u.role, isAdmin: u.is_admin, isActive: u.is_active }, JWT_SECRET, { expiresIn: '7d' });
    return res.status(201).json({
      token,
      user: { id: u.id, username: u.username, email: u.email, role: u.role, isAdmin: u.is_admin, isActive: u.is_active, supabaseUserId: u.id }
    });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Get current user's profile
exports.getMe = async (req, res) => {
  try {
    const userId = req.user?.supabaseUserId;
    if (!userId) return res.status(401).json({ message: 'Non authentifié' });

    const r = await db.query(
      `select id, email, username, first_name, last_name, role, is_active, is_admin, created_at, last_login_at
       from users where id = $1`,
      [userId]
    );
    if (r.rowCount === 0) return res.status(404).json({ message: 'Utilisateur introuvable' });
    const u = r.rows[0];
    return res.json({
      id: u.id,
      email: u.email,
      username: u.username,
      firstName: u.first_name,
      lastName: u.last_name,
      role: u.role,
      isActive: u.is_active,
      isAdmin: u.is_admin,
      createdAt: u.created_at,
      lastLoginAt: u.last_login_at,
    });
  } catch (err) {
    console.error('getMe error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Update current user's profile
exports.updateMe = async (req, res) => {
  try {
    const userId = req.user?.supabaseUserId;
    if (!userId) return res.status(401).json({ message: 'Non authentifié' });

    const { firstName, lastName, username, email } = req.body || {};
    if (!username || !email) return res.status(400).json({ message: 'username et email sont requis' });

    // Check for duplicates (exclude current user)
    const dup = await db.query(
      `select 1 from users where (email = $1 or username = $2) and id <> $3 limit 1`,
      [email, username, userId]
    );
    if (dup.rowCount > 0) {
      return res.status(409).json({ message: 'email ou username déjà utilisé' });
    }

    const upd = await db.query(
      `update users set email = $2, username = $3, first_name = $4, last_name = $5, updated_at = now()
       where id = $1 returning id, email, username, first_name, last_name, role, is_active, is_admin`,
      [userId, email, username, firstName || null, lastName || null]
    );
    const u = upd.rows[0];
    return res.json({
      id: u.id,
      email: u.email,
      username: u.username,
      firstName: u.first_name,
      lastName: u.last_name,
      role: u.role,
      isActive: u.is_active,
      isAdmin: u.is_admin,
    });
  } catch (err) {
    console.error('updateMe error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Change current user's password
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user?.supabaseUserId;
    if (!userId) return res.status(401).json({ message: 'Non authentifié' });

    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'currentPassword et newPassword sont requis' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: 'Le nouveau mot de passe doit contenir au moins 6 caractères' });
    }

    const r = await db.query(`select password_hash from users where id = $1`, [userId]);
    if (r.rowCount === 0) return res.status(404).json({ message: 'Utilisateur introuvable' });

    const ok = await bcrypt.compare(currentPassword, r.rows[0].password_hash);
    if (!ok) return res.status(401).json({ message: 'Mot de passe actuel incorrect' });

    const hash = await bcrypt.hash(newPassword, 10);
    await db.query('update users set password_hash = $1, updated_at = now() where id = $2', [hash, userId]);
    return res.json({ ok: true, message: 'Mot de passe changé avec succès' });
  } catch (err) {
    console.error('changePassword error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password, code } = req.body;
    if (!email || !password || !code) {
      return res.status(400).json({ message: 'email, password et code sont requis' });
    }

    const r = await db.query(
      `select id, email, username, password_hash, role, is_active, is_admin
       from users where email = $1 limit 1`,
      [email]
    );
    if (r.rowCount === 0) return res.status(401).json({ message: 'Identifiants invalides' });
    const u = r.rows[0];

    const match = await bcrypt.compare(password, u.password_hash);
    if (!match) return res.status(401).json({ message: 'Identifiants invalides' });

    // Validate unique code belongs to this user
    const normalizedCode = String(code).trim().toUpperCase();
    const cr = await db.query(
      `select code, role, used_by from subscription_codes where code = $1 limit 1`,
      [normalizedCode]
    );
    if (cr.rowCount === 0) {
      return res.status(401).json({ message: 'Code invalide' });
    }
    const c = cr.rows[0];
    if (c.used_by !== u.id) {
      return res.status(401).json({ message: 'Ce code n\'est pas associé à ce compte' });
    }
    // Optional: ensure code role matches user role if role exists
    if (u.role && c.role && u.role !== c.role) {
      return res.status(401).json({ message: 'Code non valide pour ce niveau' });
    }

    // Update last_login_at
    try {
      await db.query('update users set last_login_at = now() where id = $1', [u.id]);
    } catch (e) {
      // non-blocking
      console.warn('login: failed to update last_login_at for user', u.id, e.message);
    }

    const token = jwt.sign({ supabaseUserId: u.id, email: u.email, role: u.role, isAdmin: u.is_admin, isActive: u.is_active }, JWT_SECRET, { expiresIn: '7d' });
    return res.status(200).json({
      token,
      user: { id: u.id, username: u.username, email: u.email, role: u.role, isAdmin: u.is_admin, isActive: u.is_active, supabaseUserId: u.id }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Activation par code (Supabase)
exports.activate = async (req, res) => {
  try {
    const supaId = req.user?.supabaseUserId;
    const { code } = req.body;
    if (!supaId) return res.status(401).json({ message: 'Non authentifié' });
    if (!code || typeof code !== 'string') return res.status(400).json({ message: 'Code requis' });

    const map = { Code4A: '4A', Code5A: '5A', Code6A: '6A', CodeRES: 'RES' };
    const role = map[code.trim()];
    if (!role) return res.status(400).json({ message: 'Code invalide' });

    const upd = await db.query(
      `update users set role = $2, is_active = true where id = $1
       returning id, email, username, role, is_active, is_admin`,
      [supaId, role]
    );
    if (upd.rowCount === 0) return res.status(404).json({ message: 'Utilisateur introuvable' });
    const u = upd.rows[0];

    return res.status(200).json({
      message: 'Compte activé',
      user: { id: u.id, username: u.username, email: u.email, role: u.role, isAdmin: u.is_admin, isActive: u.is_active, supabaseUserId: u.id }
    });
  } catch (err) {
    console.error('Activation error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};