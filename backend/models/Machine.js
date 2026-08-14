const mongoose = require('mongoose');

const machineSchema = new mongoose.Schema({
  machineId: { type: String, required: true, unique: true, index: true, default: 'HABBITT-M01' },
  name: { type: String, default: 'Habbitt Ultra Wash X1' },
  location: { type: String, default: 'Habbitt Laundry Station #1' },
  relayPin: { type: Number, default: 4 },
  relayState: { type: Boolean, default: false }, // false = OFF, true = ON
  status: { type: String, enum: ['IDLE', 'STANDBY', 'RUNNING', 'MAINTENANCE', 'OFFLINE'], default: 'STANDBY', index: true },
  activeBookingId: { type: String, default: null, index: true },
  activeUser: { type: String, default: null },
  activeUserId: { type: String, default: null, index: true },
  activeRfidCardId: { type: String, default: null, index: true },
  lastCardScanned: { type: String, default: null },
  lastScanTime: { type: Date, default: null },
  lastScanStatus: { type: String, default: null },
  slotEndTime: { type: Date, default: null },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Machine', machineSchema);
