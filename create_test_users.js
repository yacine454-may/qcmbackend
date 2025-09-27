require('dotenv').config({ path: './.env' });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Database connection (align with backend/services/db.js)
let connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('Missing SUPABASE_DB_URL (or DATABASE_URL) in .env');
}
if (!/sslmode=/.test(connectionString)) {
  connectionString += (connectionString.includes('?') ? '&' : '?') + 'sslmode=no-verify';
}
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function createTestUsers() {
  console.log('🔧 Creating test users for admin panel...\n');

  const testUsers = [
    // 4ème Année
    {
      email: 'marie.dupont@medecine.fr',
      username: 'marie_dupont',
      firstName: 'Marie',
      lastName: 'Dupont',
      role: '4A',
      isActive: true,
      password: 'password123',
      code: '4A-25-MARIE1'
    },
    {
      email: 'jean.martin@medecine.fr',
      username: 'jean_martin',
      firstName: 'Jean',
      lastName: 'Martin',
      role: '4A',
      isActive: true,
      password: 'password123',
      code: '4A-25-JEAN01'
    },
    // 5ème Année
    {
      email: 'sophie.bernard@medecine.fr',
      username: 'sophie_bernard',
      firstName: 'Sophie',
      lastName: 'Bernard',
      role: '5A',
      isActive: true,
      password: 'password123',
      code: '5A-25-SOPHIE'
    },
    {
      email: 'pierre.dubois@medecine.fr',
      username: 'pierre_dubois',
      firstName: 'Pierre',
      lastName: 'Dubois',
      role: '5A',
      isActive: true,
      password: 'password123',
      code: '5A-25-PIERRE'
    },
    // 6ème Année
    {
      email: 'claire.moreau@medecine.fr',
      username: 'claire_moreau',
      firstName: 'Claire',
      lastName: 'Moreau',
      role: '6A',
      isActive: true,
      password: 'password123',
      code: '6A-25-CLAIRE'
    },
    // Résidents
    {
      email: 'dr.ahmed@hopital.fr',
      username: 'dr_ahmed',
      firstName: 'Ahmed',
      lastName: 'Benali',
      role: 'RES',
      isActive: true,
      password: 'password123',
      code: 'RES-25-AHMED'
    }
  ];

  const client = await pool.connect();
  let created = 0;
  let failed = 0;

  try {
    for (const user of testUsers) {
      try {
        await client.query('BEGIN');

        // Hash password
        const passwordHash = await bcrypt.hash(user.password, 10);

        // Check if user already exists
        const existing = await client.query(
          'SELECT id FROM users WHERE email = $1 OR username = $2',
          [user.email, user.username]
        );

        if (existing.rows.length > 0) {
          console.log(`⚠️  User ${user.email} already exists, skipping...`);
          await client.query('ROLLBACK');
          continue;
        }

        // Create user
        const userResult = await client.query(`
          INSERT INTO users (email, username, password_hash, role, is_active, is_admin, first_name, last_name, created_at)
          VALUES ($1, $2, $3, $4, $5, false, $6, $7, NOW())
          RETURNING id
        `, [user.email, user.username, passwordHash, user.role, user.isActive, user.firstName, user.lastName]);

        const userId = userResult.rows[0].id;

        // Create subscription code
        await client.query(`
          INSERT INTO subscription_codes (code, role, is_active, used_by, used_at)
          VALUES ($1, $2, false, $3, NOW())
        `, [user.code, user.role, userId]);

        await client.query('COMMIT');
        console.log(`✅ Created user: ${user.firstName} ${user.lastName} (${user.email}) - Code: ${user.code}`);
        created++;

      } catch (error) {
        await client.query('ROLLBACK');
        console.log(`❌ Failed to create user ${user.email}: ${error.message}`);
        failed++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`📊 SUMMARY: ✅ ${created} users created, ❌ ${failed} failed`);
    console.log('='.repeat(60));
    console.log('\n📝 Test login credentials:');
    console.log('Email: marie.dupont@medecine.fr | Password: password123 | Code: 4A-25-MARIE1');
    console.log('Email: jean.martin@medecine.fr | Password: password123 | Code: 4A-25-JEAN01');
    console.log('Email: sophie.bernard@medecine.fr | Password: password123 | Code: 5A-25-SOPHIE');
    console.log('Email: dr.ahmed@hopital.fr | Password: password123 | Code: RES-25-AHMED');

  } catch (error) {
    console.error('❌ Error creating test users:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  createTestUsers().catch(console.error);
}

module.exports = { createTestUsers };
