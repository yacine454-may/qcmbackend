const express = require('express');
const router = express.Router();
const Qcm = require('../models/Qcm');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Récupérer tous les QCMs
router.get('/', async (req, res) => {
  try {
    const qcms = await Qcm.find();
    return res.status(200).json(qcms);
  } catch (err) {
    console.error('Erreur lors de la récupération des QCMs:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Ajouter un QCM (pour test)
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { question, choices, answer } = req.body;

    // Validations basiques
    if (!question || typeof question !== 'string' || question.trim().length < 5) {
      return res.status(400).json({ message: 'Question invalide (5 caractères minimum)' });
    }
    if (!Array.isArray(choices) || choices.length < 2) {
      return res.status(400).json({ message: 'Il faut au moins 2 choix' });
    }
    const trimmedChoices = choices.map(c => (typeof c === 'string' ? c.trim() : '')).filter(c => c.length > 0);
    if (trimmedChoices.length !== choices.length) {
      return res.status(400).json({ message: 'Chaque choix doit être une chaîne non vide' });
    }
    if (typeof answer !== 'number' || !Number.isInteger(answer) || answer < 0 || answer >= trimmedChoices.length) {
      return res.status(400).json({ message: 'Index de réponse invalide' });
    }

    const qcm = new Qcm({ question: question.trim(), choices: trimmedChoices, answer });
    await qcm.save();
    return res.status(201).json(qcm);
  } catch (err) {
    console.error('Erreur lors de la création du QCM:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;