-- Migration: Add category field to modules table
-- This allows grouping modules into: Médicale, Chirurgicale, Biologie

-- Add category column to modules table
ALTER TABLE modules 
ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'Médicale';

-- Add check constraint to ensure only valid categories
ALTER TABLE modules
ADD CONSTRAINT check_category 
CHECK (category IN ('Médicale', 'Chirurgicale', 'Biologie'));

-- Update existing modules with appropriate categories
-- Medical modules
UPDATE modules 
SET category = 'Médicale' 
WHERE name ILIKE ANY(ARRAY[
    '%cardiologie%', '%pneumologie%', '%néphrologie%', 
    '%endocrinologie%', '%neurologie%', '%psychiatrie%',
    '%pédiatrie%', '%gériatrie%', '%dermatologie%',
    '%hématologie%', '%oncologie%', '%rhumatologie%',
    '%gastro-entérologie%', '%hépatologie%', '%infectiologie%'
]);

-- Surgical modules
UPDATE modules 
SET category = 'Chirurgicale' 
WHERE name ILIKE ANY(ARRAY[
    '%chirurgie%', '%orthopédie%', '%traumatologie%',
    '%urologie%', '%gynécologie%', '%obstétrique%',
    '%ophtalmologie%', '%ORL%', '%stomatologie%',
    '%neurochirurgie%', '%chirurgie vasculaire%'
]);

-- Biology modules
UPDATE modules 
SET category = 'Biologie' 
WHERE name ILIKE ANY(ARRAY[
    '%biologie%', '%biochimie%', '%anatomie%',
    '%physiologie%', '%histologie%', '%embryologie%',
    '%génétique%', '%immunologie%', '%microbiologie%',
    '%parasitologie%', '%pharmacologie%', '%toxicologie%'
]);

-- Create index for faster category filtering
CREATE INDEX IF NOT EXISTS idx_modules_category ON modules(category);

-- Display category distribution
SELECT category, COUNT(*) as module_count
FROM modules
GROUP BY category
ORDER BY category;
