const mongoose = require('mongoose');

const qcmSchema = new mongoose.Schema({
  question: { type: String, required: true },
  choices: [{ type: String, required: true }],
  answer: { type: Number, required: true }, // index de la bonne réponse
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Qcm', qcmSchema);