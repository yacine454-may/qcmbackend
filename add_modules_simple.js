// Simple script to add all medical modules without external dependencies
const http = require('http');

const API_BASE = 'localhost:8001';

// You need to get your admin token from localStorage.getItem("authToken") in browser
const AUTH_TOKEN = ''; // Replace with your actual admin token

const modules = {
  '4A': [
    'Cardiologie',
    'Pneumologie',
    'Hématologie',
    'Gastrologie',
    'Oncologie',
    'Infections',
    'Neurologie'
  ],
  '5A': [
    'ORT',
    'Rhumatologie',
    'MPR',
    'Endocrinologie',
    'Gynécologie',
    'Pédiatre',
    'URO',
    'Néphrologie',
    'Psychiatrie'
  ],
  '6A': [
    'Dermatologie',
    'Med de Travail',
    'Med Légal',
    'Med d\'urgence',
    'Epidémiologie',
    'ORL',
    'Ophtalmologie',
    'Gériatrie',
    'Maladie du système'
  ]
};

function makeRequest(name, level) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ name, level });
    
    const options = {
      hostname: 'localhost',
      port: 8001,
      path: '/api/admin/modules',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve({ success: true, data });
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function addAllModules() {
  if (!AUTH_TOKEN) {
    console.log('❌ Please add your admin token to the AUTH_TOKEN variable');
    console.log('Get it from browser console: localStorage.getItem("authToken")');
    return;
  }

  console.log('🚀 Adding all medical modules...\n');
  
  let totalAdded = 0;
  let totalFailed = 0;

  for (const [level, moduleList] of Object.entries(modules)) {
    console.log(`📚 Adding ${level} year modules:`);
    
    for (const name of moduleList) {
      try {
        const result = await makeRequest(name, level);
        console.log(`✅ ${name} (${level}) - Added successfully`);
        totalAdded++;
      } catch (error) {
        console.log(`❌ ${name} (${level}) - Error: ${error.message}`);
        totalFailed++;
      }
      
      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    console.log('');
  }
  
  console.log('='.repeat(50));
  console.log(`📊 SUMMARY: ✅ ${totalAdded} added, ❌ ${totalFailed} failed`);
  console.log('='.repeat(50));
}

addAllModules().catch(console.error);
