const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  bookingId: { type: String, required: true, unique: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  userName: { type: String, required: true },
  userPhone: { type: String, required: true },
  rfidCardId: { type: String, required: true, uppercase: true, trim: true, index: true },
  machineId: { type: String, default: 'HABBITT-M01', index: true },
  machineName: { type: String, default: 'Habbitt Ultra Wash X1' },
  date: { type: String, required: true, index: true }, // Format YYYY-MM-DD
  timeSlot: { type: String, required: true }, // e.g. "10:00 AM - 11:00 AM"
  startTime: { type: Date, required: true, index: true },
  endTime: { type: Date, required: true, index: true },
  amount: { type: Number, required: true, default: 60 },
  paymentStatus: { type: String, enum: ['PAID', 'PENDING', 'CANCELLED'], default: 'PAID', index: true },
  paymentMethod: { type: String, default: 'UPI / QR Code' },
  paymentTransactionId: { type: String, required: true, index: true },
  relayActivationStatus: { type: String, enum: ['NOT_ACTIVATED', 'ACTIVATED', 'EXPIRED'], default: 'NOT_ACTIVATED', index: true },
  lastScanTime: { type: Date },
  createdAt: { type: Date, default: Date.now, index: true }
});

// Compound indexes for scalable 10,000+ user queries
bookingSchema.index({ user: 1, paymentStatus: 1, createdAt: -1 });
bookingSchema.index({ machineId: 1, paymentStatus: 1 });
bookingSchema.index({ date: 1, machineId: 1 });
bookingSchema.index({ rfidCardId: 1, paymentStatus: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
