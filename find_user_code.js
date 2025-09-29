require('dotenv').config();
const { Pool } = require('pg');

// Database connection
let connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ Missing SUPABASE_DB_URL in .env file');
  process.exit(1);
}

if (!/sslmode=/.test(connectionString)) {
  connectionString += (connectionString.includes('?') ? '&' : '?') + 'sslmode=no-verify';
}
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function findUserCode(email) {
  try {
    console.log(`🔍 Looking for user: ${email}`);
    
    // Find user and their subscription code
    const result = await pool.query(`
      SELECT 
        u.id,
        u.username,
        u.email,
        u.role,
        u.is_active,
        sc.code,
        sc.is_active as code_active
      FROM users u
      LEFT JOIN subscription_codes sc ON sc.used_by = u.id
      WHERE u.email = $1
    `, [email]);
    
    if (result.rows.length === 0) {
      console.log('❌ User not found');
      return;
    }
    
    const user = result.rows[0];
    
    console.log('\n📋 User Information:');
    console.log(`👤 Username: ${user.username}`);
    console.log(`📧 Email: ${user.email}`);
    console.log(`🎓 Role: ${user.role}`);
    console.log(`✅ Active: ${user.is_active ? 'Yes' : 'No'}`);
    
    if (user.code) {
      console.log(`🔑 Unique Code: ${user.code}`);
      console.log(`🔓 Code Active: ${user.code_active ? 'Yes' : 'No'}`);
      
      console.log('\n🚀 Login Credentials:');
      console.log(`Email: ${user.email}`);
      console.log(`Code: ${user.code}`);
      console.log('Password: [Your password]');
    } else {
      console.log('❌ No subscription code found for this user');
      
      // Check if there are any unused codes for this role
      const unusedCodes = await pool.query(`
        SELECT code FROM subscription_codes 
        WHERE role = $1 AND used_by IS NULL AND is_active = true
        LIMIT 3
      `, [user.role]);
      
      if (unusedCodes.rows.length > 0) {
        console.log(`\n💡 Available codes for ${user.role}:`);
        unusedCodes.rows.forEach(row => {
          console.log(`   - ${row.code}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

// Get email from command line or use default
const email = process.argv[2] || 'yacinemehdi2005@gmail.com';
findUserCode(email).catch(console.error);
