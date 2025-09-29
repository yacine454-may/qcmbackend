require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

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

async function createAdmin() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Creating admin user...\n');

    const adminData = {
      email: 'yacinemehdi2005@gmail.com',
      username: 'admin_yacine',
      firstName: 'Yacine',
      lastName: 'Mehdi',
      password: 'admin123456',
      role: 'RES',
      code: 'ADMIN-25-YACINE'
    };

    await client.query('BEGIN');

    // Check if user already exists
    const existing = await client.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [adminData.email, adminData.username]
    );

    if (existing.rows.length > 0) {
      console.log('⚠️  User already exists, updating...');
      
      // Update existing user to admin
      const passwordHash = await bcrypt.hash(adminData.password, 10);
      
      const userResult = await client.query(`
        UPDATE users 
        SET password_hash = $1, is_admin = true, is_active = true, 
            first_name = $2, last_name = $3, role = $4
        WHERE email = $5
        RETURNING id
      `, [passwordHash, adminData.firstName, adminData.lastName, adminData.role, adminData.email]);
      
      const userId = userResult.rows[0].id;
      
      // Update or create subscription code
      await client.query(`
        INSERT INTO subscription_codes (code, role, is_active, used_by, used_at)
        VALUES ($1, $2, true, $3, NOW())
        ON CONFLICT (code) DO UPDATE SET
        used_by = $3, used_at = NOW()
      `, [adminData.code, adminData.role, userId]);
      
    } else {
      // Create new user
      const passwordHash = await bcrypt.hash(adminData.password, 10);

      const userResult = await client.query(`
        INSERT INTO users (email, username, password_hash, role, is_active, is_admin, first_name, last_name, created_at)
        VALUES ($1, $2, $3, $4, true, true, $5, $6, NOW())
        RETURNING id
      `, [adminData.email, adminData.username, passwordHash, adminData.role, adminData.firstName, adminData.lastName]);

      const userId = userResult.rows[0].id;

      // Create subscription code
      await client.query(`
        INSERT INTO subscription_codes (code, role, is_active, used_by, used_at)
        VALUES ($1, $2, true, $3, NOW())
      `, [adminData.code, adminData.role, userId]);
    }

    await client.query('COMMIT');
    
    console.log('✅ Admin user created successfully!\n');
    console.log('🔑 LOGIN CREDENTIALS:');
    console.log('='.repeat(40));
    console.log(`📧 Email: ${adminData.email}`);
    console.log(`🔒 Password: ${adminData.password}`);
    console.log(`🎫 Unique Code: ${adminData.code}`);
    console.log(`👤 Role: ${adminData.role} (Admin)`);
    console.log('='.repeat(40));
    console.log('\n🚀 You can now login to:');
    console.log('• Frontend: http://localhost:3000/login.html');
    console.log('• Admin Panel: http://localhost:3000/admin.html');
    console.log('\n💡 Use these credentials for both local and production login');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating admin user:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

createAdmin().catch(console.error);
