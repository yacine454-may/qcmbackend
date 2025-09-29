const { Pool } = require('pg');
require('dotenv').config();

// Support both SUPABASE_DB_URL (local) and DATABASE_URL (Render/production)
let connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('[DB] ERROR: No database connection string found!');
  console.error('[DB] Please set either SUPABASE_DB_URL or DATABASE_URL environment variable');
  throw new Error('Database connection string is required');
}

console.log('[DB] Connection string found:', connectionString.substring(0, 30) + '...');

// Ensure SSL mode is enforced for Supabase/Postgres
if (!/sslmode=/.test(connectionString)) {
  connectionString += (connectionString.includes('?') ? '&' : '?') + 'sslmode=no-verify';
}

// DEV ONLY: bypass TLS validation to avoid SELF_SIGNED_CERT_IN_CHAIN on Windows
// In production (Render), this should be handled by proper SSL config
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 8000,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
