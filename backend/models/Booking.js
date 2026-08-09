const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  bookingId: { type: String, required: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true },
  userPhone: { type: String, required: true },
  rfidCardId: { type: String, required: true, uppercase: true, trim: true },
  machineId: { type: String, default: 'HABBITT-M01' },
  machineName: { type: String, default: 'Habbitt Ultra Wash X1' },
  date: { type: String, required: true }, // Format YYYY-MM-DD
  timeSlot: { type: String, required: true }, // e.g. "10:00 AM - 11:00 AM"
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  amount: { type: Number, required: true, default: 60 },
  paymentStatus: { type: String, enum: ['PAID', 'PENDING', 'CANCELLED'], default: 'PAID' },
  paymentMethod: { type: String, default: 'UPI / QR Code' },
  paymentTransactionId: { type: String, required: true },
  relayActivationStatus: { type: String, enum: ['NOT_ACTIVATED', 'ACTIVATED', 'EXPIRED'], default: 'NOT_ACTIVATED' },
  lastScanTime: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Booking', bookingSchema);
