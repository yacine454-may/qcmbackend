const mongoose = require('mongoose');
const Qcm = require('./models/Qcm');

mongoose.connect('mongodb://localhost:27017/appqcm');

const qcms = [
  {
    question: "Quel est l'organe principal de la respiration ?",
    choices: ["Cœur", "Poumon", "Foie", "Rein"],
    answer: 1
  },
  {
    question: "Combien d'os compose le squelette humain adulte ?",
    choices: ["206", "305", "150", "100"],
    answer: 0
  },
  {
    question: "Quel est le rôle des globules rouges ?",
    choices: ["Transporter l'oxygène", "Combattre les infections", "Coaguler le sang", "Produire des hormones"],
    answer: 0
  }
];

Qcm.insertMany(qcms).then(() => {
  console.log('QCMs ajoutés !');
  mongoose.disconnect();
});