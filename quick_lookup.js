// Quick user lookup
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false }
});

async function lookup() {
  try {
    const result = await pool.query(`
      SELECT u.email, u.username, u.role, sc.code 
      FROM users u 
      LEFT JOIN subscription_codes sc ON sc.used_by = u.id 
      WHERE u.email = 'yacinemehdi2005@gmail.com'
    `);
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log('User found:');
      console.log('Email:', user.email);
      console.log('Username:', user.username);
      console.log('Role:', user.role);
      console.log('Code:', user.code || 'No code assigned');
    } else {
      console.log('User not found');
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
  process.exit(0);
}

lookup();
