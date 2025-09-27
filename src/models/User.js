const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  supabaseUserId: { type: String, default: null },
  role: { type: String, enum: ['4A', '5A', '6A', 'RES', null], default: null },
  isActive: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  // Ajoute d'autres champs selon besoin
});

module.exports = mongoose.model('User', userSchema);