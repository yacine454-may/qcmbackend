const { Pool } = require('pg');
require('dotenv').config();

// Prefer SUPABASE_DB_URL, but gracefully fallback to DATABASE_URL (Render/Heroku convention)
let connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.warn('[DB] SUPABASE_DB_URL/DATABASE_URL is not set. Please add it to your environment');
} else if (!/sslmode=/.test(connectionString)) {
  // Ensure SSL mode is enforced for Supabase/Render
  connectionString += (connectionString.includes('?') ? '&' : '?') + 'sslmode=no-verify';
}

// DEV ONLY: bypass TLS validation to avoid SELF_SIGNED_CERT_IN_CHAIN on Windows
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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
