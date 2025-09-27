// Import extracted QCMs into ResicoQCM database
require('dotenv').config({ path: './.env' });
const { Pool } = require('pg');
const fs = require('fs');

function slugify(name) {
  return (name || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

async function importQCMsFromJSON(filePath, moduleId) {
  const pool = new Pool({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log(`📖 Reading QCMs from ${filePath}...`);
    const qcmsData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    console.log(`📊 Found ${qcmsData.length} QCMs to import`);
    
    let imported = 0;
    let skipped = 0;
    
    for (const qcm of qcmsData) {
      try {
        // Insert QCM
        const qcmResult = await pool.query(
          `INSERT INTO qcm (module_id, question, explanation, difficulty)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [
            moduleId,
            qcm.question,
            qcm.explanation || null,
            qcm.difficulty || 'Medium'
          ]
        );
        
        const qcmId = qcmResult.rows[0].id;
        
        // Insert choices
        for (let i = 0; i < qcm.choices.length; i++) {
          await pool.query(
            `INSERT INTO qcm_choices (qcm_id, choice_text, is_correct, choice_order)
             VALUES ($1, $2, $3, $4)`,
            [
              qcmId,
              qcm.choices[i],
              i === (qcm.correctIndex || 0),
              i
            ]
          );
        }
        
        imported++;
        if (imported % 10 === 0) {
          console.log(`✅ Imported ${imported} QCMs...`);
        }
        
      } catch (error) {
        console.log(`❌ Error importing QCM: ${error.message}`);
        skipped++;
      }
    }
    
    console.log(`\n📊 Import complete: ${imported} imported, ${skipped} skipped`);
    
  } catch (error) {
    console.error('❌ Import failed:', error);
  } finally {
    await pool.end();
  }
}

async function createModuleAndImport(moduleName, level, qcmFilePath) {
  const pool = new Pool({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Check if module exists
    let moduleResult = await pool.query(
      'SELECT id FROM modules WHERE name = $1 AND level = $2',
      [moduleName, level]
    );
    
    let moduleId;
    if (moduleResult.rows.length === 0) {
      // Create module
      console.log(`📚 Creating module: ${moduleName} (${level})`);
      const newModule = await pool.query(
        `INSERT INTO modules (name, level, slug, description, is_active)
         VALUES ($1, $2, $3, $4, true) RETURNING id`,
        [moduleName, level, slugify(moduleName), `Module ${moduleName} pour ${level}`]
      );
      moduleId = newModule.rows[0].id;
    } else {
      moduleId = moduleResult.rows[0].id;
      console.log(`📚 Using existing module: ${moduleName} (${level})`);
    }
    
    await pool.end();
    
    // Import QCMs
    await importQCMsFromJSON(qcmFilePath, moduleId);
    
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
  }
}

// Example usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log('Usage: node import_qcms_to_db.js <module_name> <level> <json_file>');
    console.log('Example: node import_qcms_to_db.js "Cardiologie" "4A" "./ezmed25_qcms.json"');
    process.exit(1);
  }
  
  const [moduleName, level, jsonFile] = args;
  
  if (!fs.existsSync(jsonFile)) {
    console.error(`❌ File not found: ${jsonFile}`);
    process.exit(1);
  }
  
  createModuleAndImport(moduleName, level, jsonFile)
    .catch(console.error);
}

module.exports = { importQCMsFromJSON, createModuleAndImport };
