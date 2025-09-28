require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./services/db');

const app = express();
app.use(express.json());

// Configure CORS for production deployment (supports mobile and Vercel previews)
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'https://resedqcm-front.vercel.app',
  'https://resicoqcm-front.vercel.app',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, file://)
    if (!origin) return callback(null, true);
    try {
      const url = new URL(origin);
      const hostname = url.hostname;
      const isVercel = hostname.endsWith('.vercel.app');
      if (allowedOrigins.includes(origin) || isVercel) {
        return callback(null, true);
      }
    } catch (e) {
      // If origin is not a valid URL string, allow cautiously (mobile edge cases)
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Preflight support (Express 5 compatible pattern)
// Remove problematic wildcard OPTIONS route for compatibility with Node.js v22+
// app.options('(.*)', cors());

// Lightweight startup migrations to ensure schema is compatible
async function runMigrations() {
  try {
    console.log('[MIGRATIONS] Checking database schema...');
    await db.query(`
      do $$ begin
        begin
          alter table users add column if not exists first_name text;
        exception when others then null; end;
        begin
          alter table users add column if not exists last_name text;
        exception when others then null; end;
        begin
          alter table users add column if not exists last_login_at timestamptz;
        exception when others then null; end;
        begin
          alter table users add column if not exists updated_at timestamptz default now();
        exception when others then null; end;
        -- Ensure only one subscription code per user (when used_by is set)
        begin
          create unique index if not exists uq_subscription_codes_used_by
          on subscription_codes(used_by) where used_by is not null;
        exception when others then null; end;
        -- Ensure code has a supporting unique index (should exist from schema)
        begin
          create unique index if not exists uq_subscription_codes_code on subscription_codes(code);
        exception when others then null; end;
      end $$;
    `);
    console.log('[MIGRATIONS] Users table is up to date');
  } catch (err) {
    console.warn('[MIGRATIONS] Skipped with warning:', err.message);
  }
}

// Import routes
const userRoutes = require('./routes/user');
const modulesRoutes = require('./routes/modules');
const resultsRoutes = require('./routes/results');
const progressRoutes = require('./routes/progress');
const qcmSbRoutes = require('./routes/qcm_sb');
const adminRoutes = require('./routes/admin');
app.use('/api/user', userRoutes);
app.use('/api/modules', modulesRoutes);
app.use('/api/results', resultsRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/qcm/sb', qcmSbRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Database (Supabase Postgres) health check
app.get('/api/db/health', async (req, res) => {
  try {
    const r = await db.query('select now() as now');
    return res.json({ status: 'ok', now: r.rows[0].now });
  } catch (err) {
    console.error('DB health error:', err);
    return res.status(500).json({ status: 'error', message: 'DB not reachable' });
  }
});

const PORT = process.env.PORT || 8001;
runMigrations().finally(() => {
  app.listen(PORT, () => {
    console.log(`Serveur backend lancé sur le port ${PORT}`);
  });
});