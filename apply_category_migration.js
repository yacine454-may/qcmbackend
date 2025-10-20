/**
 * Apply category migration to modules table
 * Adds category field and categorizes existing modules
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false } // Always use SSL for Supabase
});

async function applyMigration() {
  // Verify database connection string
  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    throw new Error('❌ No database connection string found! Please check your .env file.\nExpected: DATABASE_URL or SUPABASE_DB_URL');
  }
  
  console.log('🔌 Connecting to database...');
  console.log('📍 Using:', dbUrl.replace(/:[^:@]+@/, ':****@')); // Hide password
  
  const client = await pool.connect();
  console.log('✅ Connected to database!\n');
  
  try {
    console.log('🔄 Starting category migration...\n');
    
    // Read migration SQL file
    const migrationPath = path.join(__dirname, 'migrations', 'add_category_to_modules.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute migration
    await client.query('BEGIN');
    await client.query(migrationSQL);
    await client.query('COMMIT');
    
    console.log('✅ Migration applied successfully!\n');
    
    // Display results
    const result = await client.query(`
      SELECT category, COUNT(*) as module_count
      FROM modules
      GROUP BY category
      ORDER BY category
    `);
    
    console.log('📊 Category distribution:');
    console.table(result.rows);
    
    // Display some example modules per category
    console.log('\n📚 Example modules per category:\n');
    
    for (const cat of ['Médicale', 'Chirurgicale', 'Biologie']) {
      const examples = await client.query(`
        SELECT name, level, category
        FROM modules
        WHERE category = $1
        LIMIT 5
      `, [cat]);
      
      console.log(`${cat}:`);
      examples.rows.forEach(m => {
        console.log(`  - ${m.name} (${m.level})`);
      });
      console.log('');
    }
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
applyMigration()
  .then(() => {
    console.log('✨ Migration completed successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('💥 Migration error:', err);
    process.exit(1);
  });
