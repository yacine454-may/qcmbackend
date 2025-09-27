require('dotenv').config({ path: './backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
});

// Sample medical QCMs organized by module
const sampleQCMs = {
  'Cardiologie': [
    {
      question: "Quelle est la cause la plus fréquente d'insuffisance cardiaque chez l'adulte jeune?",
      choices: ["Cardiomyopathie dilatée", "Cardiopathie ischémique", "Valvulopathie mitrale", "Hypertension artérielle"],
      correctAnswer: 0,
      explanation: "La cardiomyopathie dilatée est la cause principale d'insuffisance cardiaque chez l'adulte jeune.",
      difficulty: "Medium"
    },
    {
      question: "L'onde Q pathologique à l'ECG indique:",
      choices: ["Ischémie myocardique", "Nécrose myocardique", "Trouble de conduction", "Arythmie auriculaire"],
      correctAnswer: 1,
      explanation: "L'onde Q pathologique (>0.04s et >25% de l'onde R) indique une nécrose myocardique.",
      difficulty: "Easy"
    },
    {
      question: "Dans l'infarctus du myocarde STEMI, le traitement de première intention est:",
      choices: ["Thrombolyse", "Angioplastie primaire", "Pontage coronaire", "Traitement médical seul"],
      correctAnswer: 1,
      explanation: "L'angioplastie primaire est le traitement de référence du STEMI si réalisable dans les délais.",
      difficulty: "Medium"
    }
  ],
  'Gastrologie': [
    {
      question: "Le signe de Murphy est caractéristique de:",
      choices: ["Appendicite", "Cholécystite", "Pancréatite", "Péritonite"],
      correctAnswer: 1,
      explanation: "Le signe de Murphy (douleur à la palpation de l'hypochondre droit en inspiration) est pathognomonique de la cholécystite.",
      difficulty: "Easy"
    },
    {
      question: "L'helicobacter pylori est associé à:",
      choices: ["Ulcère gastrique uniquement", "Ulcère duodénal uniquement", "Ulcères gastro-duodénaux et cancer gastrique", "Reflux gastro-œsophagien"],
      correctAnswer: 2,
      explanation: "H. pylori est impliqué dans les ulcères gastro-duodénaux et constitue un facteur de risque de cancer gastrique.",
      difficulty: "Medium"
    },
    {
      question: "La complication la plus grave de la cirrhose est:",
      choices: ["Ascite", "Hémorragie digestive", "Encéphalopathie hépatique", "Carcinome hépatocellulaire"],
      correctAnswer: 3,
      explanation: "Le carcinome hépatocellulaire est la complication la plus redoutable de la cirrhose avec un pronostic sombre.",
      difficulty: "Hard"
    }
  ],
  'Pneumologie': [
    {
      question: "Le signe radiologique pathognomonique de l'œdème pulmonaire aigu est:",
      choices: ["Opacités alvéolaires bilatérales", "Pneumothorax", "Atélectasie", "Caverne pulmonaire"],
      correctAnswer: 0,
      explanation: "Les opacités alvéolaires bilatérales en 'ailes de papillon' sont caractéristiques de l'OAP.",
      difficulty: "Easy"
    },
    {
      question: "Dans l'asthme, le traitement de fond de première intention est:",
      choices: ["Bronchodilatateurs β2-agonistes", "Corticoïdes inhalés", "Théophylline", "Antileucotriènes"],
      correctAnswer: 1,
      explanation: "Les corticoïdes inhalés constituent le traitement de fond de référence de l'asthme persistant.",
      difficulty: "Medium"
    }
  ]
};

async function createSampleQCMs() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Creating sample QCMs...\n');
    
    let totalCreated = 0;
    let totalFailed = 0;
    
    for (const [moduleName, qcms] of Object.entries(sampleQCMs)) {
      console.log(`📚 Processing module: ${moduleName}`);
      
      // Get module ID
      const moduleResult = await client.query(
        'SELECT id FROM modules WHERE name = $1 LIMIT 1',
        [moduleName]
      );
      
      if (moduleResult.rows.length === 0) {
        console.log(`❌ Module "${moduleName}" not found. Please create it first.`);
        totalFailed += qcms.length;
        continue;
      }
      
      const moduleId = moduleResult.rows[0].id;
      
      for (const qcm of qcms) {
        try {
          await client.query('BEGIN');
          
          // Insert QCM
          const qcmResult = await client.query(`
            INSERT INTO qcm (module_id, question, explanation, difficulty, created_at)
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING id
          `, [moduleId, qcm.question, qcm.explanation, qcm.difficulty]);
          
          const qcmId = qcmResult.rows[0].id;
          
          // Insert choices
          for (let i = 0; i < qcm.choices.length; i++) {
            await client.query(`
              INSERT INTO qcm_choices (qcm_id, choice_text, is_correct, choice_order)
              VALUES ($1, $2, $3, $4)
            `, [qcmId, qcm.choices[i], i === qcm.correctAnswer, i]);
          }
          
          await client.query('COMMIT');
          console.log(`✅ Created QCM: "${qcm.question.substring(0, 50)}..."`);
          totalCreated++;
          
        } catch (error) {
          await client.query('ROLLBACK');
          console.log(`❌ Failed to create QCM: ${error.message}`);
          totalFailed++;
        }
      }
      console.log('');
    }
    
    console.log('='.repeat(60));
    console.log(`📊 SUMMARY: ✅ ${totalCreated} QCMs created, ❌ ${totalFailed} failed`);
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Additional QCMs for other modules
const additionalQCMs = {
  'Neurologie': [
    {
      question: "Le signe de Babinski indique:",
      choices: ["Lésion du faisceau pyramidal", "Atteinte cérébelleuse", "Neuropathie périphérique", "Syndrome méningé"],
      correctAnswer: 0,
      explanation: "Le signe de Babinski (extension du gros orteil) indique une atteinte du faisceau cortico-spinal (pyramidal).",
      difficulty: "Easy"
    },
    {
      question: "Dans la maladie de Parkinson, le tremblement est caractérisé par:",
      choices: ["Tremblement d'action", "Tremblement de repos", "Tremblement intentionnel", "Tremblement postural"],
      correctAnswer: 1,
      explanation: "Le tremblement parkinsonien est un tremblement de repos, disparaissant lors du mouvement volontaire.",
      difficulty: "Medium"
    }
  ],
  'Hématologie': [
    {
      question: "L'anémie ferriprive se caractérise par:",
      choices: ["Microcytose hypochrome", "Macrocytose", "Normocytose normochrome", "Sphérocytose"],
      correctAnswer: 0,
      explanation: "La carence en fer entraîne une anémie microcytaire (VGM<80fl) et hypochrome (TCMH diminuée).",
      difficulty: "Easy"
    },
    {
      question: "Le traitement de première intention de la leucémie aiguë lymphoblastique est:",
      choices: ["Radiothérapie", "Chimiothérapie", "Greffe de moelle", "Immunothérapie"],
      correctAnswer: 1,
      explanation: "La chimiothérapie d'induction est le traitement initial standard de la LAL.",
      difficulty: "Medium"
    }
  ]
};

// Merge additional QCMs
Object.assign(sampleQCMs, additionalQCMs);

if (require.main === module) {
  createSampleQCMs().catch(console.error);
}

module.exports = { createSampleQCMs, sampleQCMs };
