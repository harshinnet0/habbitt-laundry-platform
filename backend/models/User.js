const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  phone: { type: String, required: true, trim: true, index: true },
  password: { type: String, required: true },
  rfidCardId: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
  hostelName: { type: String, default: 'Main PG / Hostel', trim: true, index: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user', index: true },
  avatar: { type: String, default: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250' },
  createdAt: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model('User', userSchema);
