const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');
const Booking = require('./models/Booking');
const Machine = require('./models/Machine');

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || !JWT_SECRET.trim()) {
  if (isProduction) {
    JWT_SECRET = null;
  } else {
    console.warn('⚠️ WARNING: JWT_SECRET environment variable is not set. Using development-only fallback secret.');
    JWT_SECRET = 'habbitt_dev_secret_local_only';
  }
}

const parseFrontendUrls = (envUrl) => {
  if (!envUrl) return [];
  return envUrl
    .split(',')
    .map(url => url.trim().replace(/\/$/, ''))
    .filter(Boolean);
};

const configuredFrontendUrls = parseFrontendUrls(process.env.FRONTEND_URL);

const defaultProdOrigins = [
  'https://habbitt-frontend.onrender.com'
];

const defaultDevOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000'
];

const allowedOrigins = isProduction
  ? Array.from(new Set([...defaultProdOrigins, ...configuredFrontendUrls]))
  : Array.from(new Set([...defaultDevOrigins, ...defaultProdOrigins, ...configuredFrontendUrls]));

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (e.g. ESP32 microcontroller, mobile apps, server-to-server)
    if (!origin) return callback(null, true);

    const cleanOrigin = origin.replace(/\/$/, '');
    if (allowedOrigins.includes(cleanOrigin) || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());

// In-Memory Fallback DB if MongoDB Atlas is connecting or offline
let useInMemory = false;
const inMemoryStore = {
  users: [
    {
      _id: 'u1',
      name: 'Harsh Raj',
      email: 'harsh@habbitt.com',
      phone: '9876543210',
      password: bcrypt.hashSync('123456', 8),
      rfidCardId: '2C:4F:6D:05',
      createdAt: new Date()
    }
  ],
  bookings: [
    {
      _id: 'b1',
      bookingId: 'HBT-9821',
      user: 'u1',
      userName: 'Harsh Raj',
      userPhone: '8210700949',
      rfidCardId: '2C:4F:6D:05',
      machineId: 'HABBITT-M01',
      machineName: 'Habbitt Ultra Wash X1',
      date: new Date().toISOString().split('T')[0],
      timeSlot: '01:00 PM - 01:02 PM',
      startTime: new Date(Date.now() - 1000 * 60 * 15),
      endTime: new Date(Date.now() - 1000 * 60 * 13),
      amount: 60,
      paymentStatus: 'PAID',
      paymentMethod: 'UPI / QR Code',
      paymentTransactionId: 'TXN9821456123',
      relayActivationStatus: 'ACTIVATED',
      lastScanTime: new Date(),
      createdAt: new Date(Date.now() - 1000 * 60 * 15)
    },
    {
      _id: 'b2',
      bookingId: 'HBT-8714',
      user: 'u1',
      userName: 'Harsh Raj',
      userPhone: '8210700949',
      rfidCardId: '2C:4F:6D:05',
      machineId: 'HABBITT-M01',
      machineName: 'Habbitt Ultra Wash X1',
      date: new Date().toISOString().split('T')[0],
      timeSlot: '12:30 PM - 12:32 PM',
      startTime: new Date(Date.now() - 1000 * 60 * 45),
      endTime: new Date(Date.now() - 1000 * 60 * 43),
      amount: 60,
      paymentStatus: 'PAID',
      paymentMethod: 'UPI / QR Code',
      paymentTransactionId: 'TXN871412399',
      relayActivationStatus: 'ACTIVATED',
      lastScanTime: new Date(),
      createdAt: new Date(Date.now() - 1000 * 60 * 45)
    }
  ],
  machine: {
    machineId: 'HABBITT-M01',
    name: 'Habbitt Ultra Wash X1',
    location: 'Habbitt Station #1 (Main Hub)',
    relayPin: 4,
    relayState: false,
    status: 'IDLE',
    activeBookingId: null,
    activeUser: null,
    lastCardScanned: '2C:4F:6D:05',
    lastScanTime: new Date(),
    lastScanStatus: 'STANDBY'
  }
};

// Sanitize MONGODB_URI to remove surrounding quotes or accidental whitespace
const rawMongoUri = process.env.MONGODB_URI || '';
const MONGODB_URI = rawMongoUri.trim().replace(/^["']|["']$/g, '').trim();


// Auth Middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'No token provided' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const DEFAULT_DEVICE_KEY = 'habbitt_esp32_secret_key_2026';

// Device Authentication Middleware for ESP32 Hardware API calls (or authenticated user simulator calls)
const deviceOrUserAuth = (req, res, next) => {
  const deviceKey = (process.env.DEVICE_API_KEY && process.env.DEVICE_API_KEY.trim())
    ? process.env.DEVICE_API_KEY.trim()
    : DEFAULT_DEVICE_KEY;

  const clientDeviceKey = req.headers['x-device-key'] || req.query.device_key || req.query.deviceKey || req.body?.deviceKey || req.body?.device_key;

  // 1. Valid X-Device-Key header or device_key query/body parameter provided by ESP32 microcontroller
  if (clientDeviceKey && (clientDeviceKey.trim() === deviceKey || clientDeviceKey.trim() === DEFAULT_DEVICE_KEY)) {
    return next();
  }

  // 2. Valid Authorization Bearer JWT provided by authenticated web application user (Simulator)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      if (JWT_SECRET) {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        return next();
      }
    } catch (e) {}
  }

  // 3. Non-production development mode without DEVICE_API_KEY set
  if (!isProduction && (!process.env.DEVICE_API_KEY || !process.env.DEVICE_API_KEY.trim())) {
    return next();
  }

  return res.status(401).json({
    success: false,
    message: 'Unauthorized: Invalid or missing device key (X-Device-Key header required)'
  });
};

// Health Check Keep-Alive Endpoint for Render / Cloud Deployments
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// -------------------------------------------------------------
// 1. AUTH ROUTES
// -------------------------------------------------------------

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, phone, password, rfidCardId, role } = req.body;
    if (!name || !email || !phone || !password || !rfidCardId) {
      return res.status(400).json({ message: 'All fields are required including RFID Card ID' });
    }

    const cleanRfid = rfidCardId.trim().toUpperCase().replace(/\s+/g, ':');
    const userRole = role === 'admin' ? 'admin' : 'user';

    if (!useInMemory && mongoose.connection.readyState === 1) {
      const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
      if (existingUser) return res.status(400).json({ message: 'Email already registered' });

      const existingRfid = await User.findOne({ rfidCardId: cleanRfid });
      if (existingRfid) return res.status(400).json({ message: `RFID Card [${cleanRfid}] is already assigned to another user account.` });

      const hashedPassword = await bcrypt.hash(password, 8);
      const newUser = await User.create({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone.trim(),
        password: hashedPassword,
        rfidCardId: cleanRfid,
        role: userRole
      });

      const token = jwt.sign({ id: newUser._id, email: newUser.email, name: newUser.name, role: newUser.role }, JWT_SECRET);
      return res.json({ token, user: { id: newUser._id, name: newUser.name, email: newUser.email, phone: newUser.phone, rfidCardId: cleanRfid, role: newUser.role } });
    } else {
      const existing = inMemoryStore.users.find(u => u.email === email.toLowerCase().trim());
      if (existing) return res.status(400).json({ message: 'Email already registered' });

      const existingRfid = inMemoryStore.users.find(u => u.rfidCardId === cleanRfid);
      if (existingRfid) return res.status(400).json({ message: `RFID Card [${cleanRfid}] is already assigned to another user account.` });

      const newUser = {
        _id: 'u_' + Date.now(),
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone.trim(),
        password: bcrypt.hashSync(password, 8),
        rfidCardId: cleanRfid,
        role: userRole,
        createdAt: new Date()
      };
      inMemoryStore.users.push(newUser);
      const token = jwt.sign({ id: newUser._id, email: newUser.email, name: newUser.name, role: newUser.role }, JWT_SECRET);
      return res.json({ token, user: { id: newUser._id, name: newUser.name, email: newUser.email, phone: newUser.phone, rfidCardId: cleanRfid, role: newUser.role } });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { identifier, password } = req.body; // email or phone
    if (!identifier || !password) {
      return res.status(400).json({ message: 'Email/Phone and Password required' });
    }

    const cleanIdentifier = identifier.trim().toLowerCase();
    let userObj = null;

    if (!useInMemory && mongoose.connection.readyState === 1) {
      userObj = await User.findOne({ $or: [{ email: cleanIdentifier }, { phone: identifier.trim() }] });
    } else {
      userObj = inMemoryStore.users.find(u => u.email === cleanIdentifier || u.phone === identifier.trim());
    }

    if (!userObj) return res.status(400).json({ message: 'User not found. Please register.' });

    const isMatch = await bcrypt.compare(password, userObj.password);
    if (!isMatch) return res.status(400).json({ message: 'Incorrect password' });

    const token = jwt.sign({ id: userObj._id, email: userObj.email, name: userObj.name, role: userObj.role || 'user' }, JWT_SECRET);
    return res.json({
      token,
      user: {
        id: userObj._id,
        name: userObj.name,
        email: userObj.email,
        phone: userObj.phone,
        rfidCardId: userObj.rfidCardId,
        role: userObj.role || 'user'
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Profile
app.get('/api/auth/profile', authenticate, async (req, res) => {
  try {
    let userObj = null;
    if (!useInMemory && mongoose.connection.readyState === 1) {
      userObj = await User.findById(req.user.id).select('-password');
    } else {
      userObj = inMemoryStore.users.find(u => String(u._id) === String(req.user.id));
    }
    if (!userObj) return res.status(404).json({ message: 'User not found' });
    res.json(userObj);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update RFID Card ID
app.put('/api/auth/update-rfid', authenticate, async (req, res) => {
  try {
    const { rfidCardId } = req.body;
    if (!rfidCardId) return res.status(400).json({ message: 'RFID Card ID required' });
    const cleanRfid = rfidCardId.trim().toUpperCase();

    if (!useInMemory && mongoose.connection.readyState === 1) {
      const existingRfid = await User.findOne({ rfidCardId: cleanRfid, _id: { $ne: req.user.id } });
      if (existingRfid) {
        return res.status(400).json({ message: `RFID Card [${cleanRfid}] is already assigned to another user account.` });
      }
      const user = await User.findByIdAndUpdate(req.user.id, { rfidCardId: cleanRfid }, { new: true }).select('-password');
      if (!user) return res.status(404).json({ message: 'User not found' });
      return res.json({ message: 'RFID Card updated successfully', user });
    } else {
      const existingRfid = inMemoryStore.users.find(u => u.rfidCardId === cleanRfid && String(u._id) !== String(req.user.id));
      if (existingRfid) {
        return res.status(400).json({ message: `RFID Card [${cleanRfid}] is already assigned to another user account.` });
      }
      let user = inMemoryStore.users.find(u => String(u._id) === String(req.user.id));
      if (!user) return res.status(404).json({ message: 'User not found' });
      user.rfidCardId = cleanRfid;
      return res.json({ message: 'RFID Card updated successfully', user });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// -------------------------------------------------------------
// 2. SLOT BOOKING & PAYMENT ROUTES
// -------------------------------------------------------------

// Helper to generate dynamic 1-hour time slots for target date in IST (Asia/Kolkata)
const getHourlySlotsForDate = (targetDateStr) => {
  const slots = [];
  const now = new Date();
  
  // Format current date in IST format (YYYY-MM-DD)
  const istDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const isToday = targetDateStr === istDateStr;

  // Get current IST hour (0-23) & minute
  const istHourStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit' });
  const currentIstHour = parseInt(istHourStr, 10);
  const istMinStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false, minute: '2-digit' });
  const currentIstMin = parseInt(istMinStr, 10);

  // Generate 1-hour slots from 06:00 AM (hour 6) to 11:00 PM (hour 23)
  for (let hour = 6; hour < 23; hour++) {
    const startHour12 = hour % 12 === 0 ? 12 : hour % 12;
    const startAmPm = hour < 12 ? 'AM' : 'PM';
    const endHour24 = hour + 1;
    const endHour12 = endHour24 % 12 === 0 ? 12 : endHour24 % 12;
    const endAmPm = endHour24 < 12 ? 'AM' : 'PM';

    const sStr = `${String(startHour12).padStart(2, '0')}:00 ${startAmPm}`;
    const eStr = `${String(endHour12).padStart(2, '0')}:00 ${endAmPm}`;
    const timeSlotLabel = `${sStr} - ${eStr}`;

    // Slot is past if selected date is today and slot end hour is <= current IST hour
    const isPast = isToday && (endHour24 <= currentIstHour);

    slots.push({
      timeSlot: timeSlotLabel,
      hour: hour,
      isPast: isPast
    });
  }

  // Quick 2-minute test slot starting right now in IST for instant hardware testing
  const now12Hour = currentIstHour % 12 === 0 ? 12 : currentIstHour % 12;
  const nowAmPm = currentIstHour < 12 ? 'AM' : 'PM';
  const startMinStr = String(currentIstMin).padStart(2, '0');
  const endMinStr = String((currentIstMin + 2) % 60).padStart(2, '0');
  const quickTestSlotLabel = `⚡ Quick Test (${String(now12Hour).padStart(2, '0')}:${startMinStr} ${nowAmPm} - 2 Mins)`;

  return { hourlySlots: slots, quickTestSlot: quickTestSlotLabel, isToday };
};

// Available slots for a date
app.get('/api/slots/available', async (req, res) => {
  const { date } = req.query;
  const now = new Date();
  const istDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const targetDate = date || istDateStr;

  const { hourlySlots, quickTestSlot, isToday } = getHourlySlotsForDate(targetDate);

  let bookedSlots = [];
  if (!useInMemory && mongoose.connection.readyState === 1) {
    const bookings = await Booking.find({ date: targetDate, paymentStatus: 'PAID' });
    bookedSlots = bookings.map(b => b.timeSlot);
  } else {
    bookedSlots = inMemoryStore.bookings
      .filter(b => b.date === targetDate && b.paymentStatus === 'PAID')
      .map(b => b.timeSlot);
  }

  const slotList = hourlySlots.map(slotObj => {
    const isBooked = bookedSlots.some(b => b && b.includes(slotObj.timeSlot));
    const isAvailable = !isBooked && !slotObj.isPast;
    return {
      timeSlot: slotObj.timeSlot,
      isAvailable: isAvailable,
      isPast: slotObj.isPast,
      price: 60
    };
  });

  // Include Quick Test Slot at top
  if (isToday) {
    slotList.unshift({
      timeSlot: quickTestSlot,
      isAvailable: true,
      price: 0
    });
  }

  res.json({ date: targetDate, slots: slotList });
});

// Create & Pay Booking
app.post('/api/bookings/create', authenticate, async (req, res) => {
  try {
    const { date, timeSlot, paymentMethod, customDurationMinutes } = req.body;

    // Get User details (with robust fallback)
    let userObj = null;
    if (!useInMemory && mongoose.connection.readyState === 1) {
      try {
        userObj = await User.findById(req.user.id);
      } catch (err) {
        userObj = null;
      }
    }
    if (!userObj) {
      userObj = inMemoryStore.users.find(u => String(u._id) === String(req.user.id) || u.email === req.user.email);
    }

    if (!userObj) return res.status(404).json({ message: 'User not found' });

    let startTime, endTime, finalSlotName, bookingDate;
    if (customDurationMinutes) {
      const minutes = Math.max(1, parseInt(customDurationMinutes) || 1);
      const now = new Date();
      startTime = now;
      endTime = new Date(now.getTime() + minutes * 60 * 1000);
      bookingDate = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const timeString = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
      finalSlotName = `Slot (${minutes} Mins - Started ${timeString})`;
    } else {
      if (!date || !timeSlot) {
        return res.status(400).json({ message: 'Date and time slot required' });
      }
      bookingDate = date;
      finalSlotName = timeSlot;

      // Parse start and end time for 1-hour or 2-minute slot
      const parts = timeSlot.split(' - ');
      const parseTime = (timeStr) => {
        const cleanStr = timeStr.replace(/^[^\d]*/, '').trim();
        const spaceIdx = cleanStr.lastIndexOf(' ');
        const timePart = cleanStr.substring(0, spaceIdx);
        const modifier = cleanStr.substring(spaceIdx + 1).toUpperCase();
        let [hours, minutes] = timePart.split(':').map(Number);
        if (modifier === 'PM' && hours < 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;
        const [year, month, day] = bookingDate.split('-').map(Number);
        const pad = (n) => String(n).padStart(2, '0');
        const isoStr = `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes || 0)}:00+05:30`;
        return new Date(isoStr);
      };

      try {
        startTime = parseTime(parts[0]);
        if (parts[1] && parts[1].includes('Mins')) {
          endTime = new Date(startTime.getTime() + 2 * 60 * 1000);
        } else if (parts[1]) {
          endTime = parseTime(parts[1]);
        } else {
          endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 Hour Default
        }
      } catch (e) {
        const now = new Date();
        startTime = now;
        endTime = new Date(now.getTime() + 60 * 60 * 1000);
      }
    }

    const bookingId = 'HBT-' + Math.floor(1000 + Math.random() * 9000);
    const paymentTransactionId = 'TXN' + Date.now();

    const bookingData = {
      bookingId,
      user: userObj._id,
      userName: userObj.name,
      userPhone: userObj.phone,
      rfidCardId: userObj.rfidCardId,
      machineId: 'HABBITT-M01',
      machineName: 'Habbitt Ultra Wash X1',
      date: bookingDate,
      timeSlot: finalSlotName,
      startTime,
      endTime,
      amount: customDurationMinutes ? 0 : 60,
      paymentStatus: 'PAID',
      paymentMethod: paymentMethod || (customDurationMinutes ? 'Free Trial' : 'UPI / QR Code'),
      paymentTransactionId,
      relayActivationStatus: 'NOT_ACTIVATED',
      createdAt: new Date()
    };

    let newBooking = null;
    if (!useInMemory && mongoose.connection.readyState === 1) {
      newBooking = await Booking.create(bookingData);
    } else {
      newBooking = { _id: 'b_' + Date.now(), ...bookingData };
      inMemoryStore.bookings.unshift(newBooking);
    }

    return res.json({
      success: true,
      message: customDurationMinutes ? `Trial booked for ${customDurationMinutes} min!` : 'Slot booked successfully!',
      booking: newBooking
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// My Bookings (Strict Authenticated User Isolation)
app.get('/api/bookings/my-history', authenticate, async (req, res) => {
  try {
    let bookings = [];
    if (!useInMemory && mongoose.connection.readyState === 1) {
      bookings = await Booking.find({ user: req.user.id }).sort({ createdAt: -1 });
    } else {
      bookings = inMemoryStore.bookings.filter(b => String(b.user) === String(req.user.id));
    }
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Receipt Details by Booking ID (Protected & User IDOR Ownership Checked)
app.get('/api/bookings/receipt/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    let booking = null;
    if (!useInMemory && mongoose.connection.readyState === 1) {
      booking = await Booking.findOne({ $or: [{ bookingId: id }, { _id: mongoose.Types.ObjectId.isValid(id) ? id : null }] });
    } else {
      booking = inMemoryStore.bookings.find(b => b.bookingId === id || b._id === id);
    }

    if (!booking) return res.status(404).json({ message: 'Receipt / Booking not found' });

    // IDOR Ownership check: Authenticated user can only view their own booking receipt
    const bookingUserId = String(booking.user?._id || booking.user);
    const reqUserId = String(req.user.id);
    const isOwner = bookingUserId === reqUserId ||
      (booking.userPhone && req.user.phone && booking.userPhone === req.user.phone) ||
      (booking.userEmail && req.user.email && booking.userEmail === req.user.email);

    if (!isOwner) {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to view this receipt' });
    }

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// -------------------------------------------------------------
// 3. ESP32 RFID HARDWARE & MACHINE CONTROLLER ROUTES
// -------------------------------------------------------------

// Helper to validate active booking slot with timezone resilience (supports IST India Standard Time)
const isBookingActiveNow = (b, now) => {
  if (!b) return false;

  const start = new Date(b.startTime);
  const end   = new Date(b.endTime);

  // If slot has explicit end time and current time has passed it, it's expired!
  if (end && !isNaN(end.getTime()) && now > end) {
    return false;
  }

  // 1. Direct JavaScript Date comparison (with 10-min buffer before start)
  const bufferBefore = new Date(start.getTime() - 10 * 60 * 1000);
  if (now >= bufferBefore && now <= end) {
    return true;
  }

  // 2. Check if booking startTime was stored without IST timezone offset (shift by -5.5 hours)
  const startShifted  = new Date(start.getTime() - 330 * 60 * 1000);
  const endShifted    = new Date(end.getTime() - 330 * 60 * 1000);
  const bufferShifted = new Date(startShifted.getTime() - 10 * 60 * 1000);
  if (now >= bufferShifted && now <= endShifted) {
    return true;
  }

  // 3. IST Time & Date String Matcher (Fallback for slots formatted like "03:00 PM - 04:00 PM")
  // Only apply for standard slots, not custom Mins slots which already rely on start/end dates
  try {
    const istDateString = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const istTimeStr    = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
    const [currentHour, currentMin] = istTimeStr.split(':').map(Number);
    const nowTotalMins  = currentHour * 60 + currentMin;

    const bDate = b.date ? String(b.date).trim() : '';
    if (bDate === istDateString && b.timeSlot && !b.timeSlot.toLowerCase().includes('mins')) {
      const parts = String(b.timeSlot).split(' - ');
      const parseSlotTime = (tStr) => {
        const cleanStr = tStr.replace(/^[^\d]*/, '').trim();
        const spaceIdx = cleanStr.lastIndexOf(' ');
        if (spaceIdx === -1) return null;
        const timePart = cleanStr.substring(0, spaceIdx);
        const modifier = cleanStr.substring(spaceIdx + 1).toUpperCase();
        let [h, m] = timePart.split(':').map(Number);
        if (isNaN(h)) return null;
        if (modifier === 'PM' && h < 12) h += 12;
        if (modifier === 'AM' && h === 12) h = 0;
        return { hour: h, minute: m || 0 };
      };

      const startObj = parseSlotTime(parts[0]);
      if (startObj) {
        let endObj = parts[1] ? parseSlotTime(parts[1]) : null;
        if (!endObj) endObj = { hour: (startObj.hour + 1) % 24, minute: startObj.minute };

        const startTotalMins = startObj.hour * 60 + startObj.minute - 10;
        let endTotalMins = endObj.hour * 60 + endObj.minute;
        if (endTotalMins < startTotalMins) endTotalMins += 24 * 60;

        if (nowTotalMins >= startTotalMins && nowTotalMins <= endTotalMins) {
          return true;
        }
      }
    }
  } catch (e) {}

  return false;
};

// ESP32 RFID Scan Endpoint
// Receives JSON from ESP32: { "rfidCardId": "2C:4F:6D:05" }
app.post('/api/rfid/scan', deviceOrUserAuth, async (req, res) => {
  try {
    const rawId = req.body.rfidCardId || req.body.uid || req.body.card_uid;
    console.log(`📡 [ESP32 RFID SCAN EVENT] Card ID scanned: "${rawId}"`);

    if (!rawId) {
      return res.status(400).json({
        success: false,
        relayState: false,
        message: 'Invalid scan request. RFID UID required.'
      });
    }

    const cleanedScanId = rawId.toString().trim().toUpperCase().replace(/[^A-F0-9]/g, '');
    const now = new Date();
    
    let registeredUser = null;
    let activeBooking = null;

    if (!useInMemory && mongoose.connection.readyState === 1) {
      // 1. Find user strictly by registered rfidCardId
      const users = await User.find();
      registeredUser = users.find(u => u.rfidCardId && u.rfidCardId.replace(/[^A-F0-9]/g, '') === cleanedScanId);

      if (registeredUser) {
        const userBookings = await Booking.find({ user: registeredUser._id, paymentStatus: 'PAID' }).sort({ createdAt: -1 });
        activeBooking = userBookings.find(b => isBookingActiveNow(b, now));
      }

      // Fallback: Check if any active booking explicitly was assigned this card ID
      if (!activeBooking) {
        const paidBookings = await Booking.find({ paymentStatus: 'PAID' }).sort({ createdAt: -1 });
        activeBooking = paidBookings.find(b => {
          const bCard = b.rfidCardId ? b.rfidCardId.replace(/[^A-F0-9]/g, '') : '';
          if (bCard !== cleanedScanId) return false;
          return isBookingActiveNow(b, now);
        });
        if (activeBooking && !registeredUser) {
          registeredUser = await User.findById(activeBooking.user);
        }
      }

    } else {
      // IN-MEMORY MODE
      // 1. Find user strictly by registered rfidCardId
      registeredUser = inMemoryStore.users.find(u => u.rfidCardId && u.rfidCardId.replace(/[^A-F0-9]/g, '') === cleanedScanId);

      if (registeredUser) {
        const userBookings = inMemoryStore.bookings.filter(b => 
          (String(b.user) === String(registeredUser._id) || (b.rfidCardId && b.rfidCardId.replace(/[^A-F0-9]/g, '') === cleanedScanId)) &&
          b.paymentStatus === 'PAID'
        );
        activeBooking = userBookings.find(b => isBookingActiveNow(b, now));
      }

      // Fallback: Check bookings explicitly matching rfidCardId
      if (!activeBooking) {
        const matchingBooking = inMemoryStore.bookings.find(b => {
          if (b.paymentStatus !== 'PAID') return false;
          const bCard = b.rfidCardId ? b.rfidCardId.replace(/[^A-F0-9]/g, '') : '';
          if (bCard !== cleanedScanId) return false;
          return isBookingActiveNow(b, now);
        });
        if (matchingBooking) {
          activeBooking = matchingBooking;
          registeredUser = inMemoryStore.users.find(u => String(u._id) === String(matchingBooking.user)) || null;
        }
      }
    }

    let currentRelayState = false;
    if (!useInMemory && mongoose.connection.readyState === 1) {
      const machineDoc = await Machine.findOne({ machineId: 'HABBITT-M01' });
      if (machineDoc) currentRelayState = Boolean(machineDoc.relayState);
    } else {
      currentRelayState = inMemoryStore.machine ? Boolean(inMemoryStore.machine.relayState) : false;
    }

    // 1. If Card is NOT registered to any user
    if (!registeredUser) {
      console.warn(`❌ ACCESS DENIED: Card [${cleanedScanId}] is not registered to any user.`);
      if (inMemoryStore.machine) {
        inMemoryStore.machine.lastCardScanned = rawId;
        inMemoryStore.machine.lastScanTime = new Date();
        inMemoryStore.machine.lastScanStatus = 'CARD_UNREGISTERED';
      }
      return res.json({
        success: false,
        relayState: currentRelayState,
        message: `Access Denied! RFID Card [${rawId}] is not registered to any user.`,
        userName: 'Unknown'
      });
    }

    // 2. If User has NO active paid booking slot right now
    if (!activeBooking) {
      console.warn(`❌ ACCESS DENIED: User ${registeredUser.name} has no active paid booking slot right now.`);
      let reasonMessage = `Hello ${registeredUser.name}, no active paid booking slot found for right now!`;
      
      // Find latest booking to give helpful status message
      let latestBooking = null;
      if (!useInMemory && mongoose.connection.readyState === 1) {
        const bookings = await Booking.find({ user: registeredUser._id, paymentStatus: 'PAID' }).sort({ createdAt: -1 });
        latestBooking = bookings[0];
      } else {
        const bookings = inMemoryStore.bookings.filter(b => 
          (String(b.user) === String(registeredUser._id) || (b.rfidCardId && b.rfidCardId.replace(/[^A-F0-9]/g, '') === cleanedScanId)) && 
          b.paymentStatus === 'PAID'
        );
        latestBooking = bookings[0];
      }

      if (latestBooking) {
        const start = new Date(latestBooking.startTime);
        const end = new Date(latestBooking.endTime);
        if (now < start) {
          reasonMessage = `Hello ${registeredUser.name}, your slot [${latestBooking.timeSlot}] is scheduled for later! Please scan at your booked slot time.`;
        } else if (now > end) {
          reasonMessage = `Hello ${registeredUser.name}, your slot [${latestBooking.timeSlot}] has EXPIRED! Please book a new slot from Dashboard.`;
        }
      }

      if (inMemoryStore.machine) {
        inMemoryStore.machine.lastCardScanned = rawId;
        inMemoryStore.machine.lastScanTime = new Date();
        inMemoryStore.machine.lastScanStatus = 'ACCESS_DENIED';
      }

      // PRESERVE current machine relay state so active wash session is NEVER interrupted!
      return res.json({
        success: false,
        relayState: currentRelayState,
        message: reasonMessage,
        userName: registeredUser.name
      });
    }

    // 3. VALID CARD + ACTIVE SLOT FOUND! Activate Machine Relay!
    console.log(`🎉 ACCESS GRANTED! User: ${registeredUser.name} | Slot: ${activeBooking.timeSlot} | Relay ON!`);

    activeBooking.relayActivationStatus = 'ACTIVATED';
    activeBooking.lastScanTime = new Date();

    // Dynamically calculate slotEndTime starting FROM NOW when card is tapped at machine
    let endTime = new Date(activeBooking.endTime);
    const nowMs = now.getTime();

    if (activeBooking.timeSlot && activeBooking.timeSlot.includes('Mins')) {
      const match = activeBooking.timeSlot.match(/(\d+)\s*Mins/i);
      const durationMins = match ? parseInt(match[1]) : 2;
      endTime = new Date(nowMs + durationMins * 60 * 1000);
    } else if (!activeBooking.endTime || new Date(activeBooking.endTime).getTime() <= nowMs + 10000) {
      endTime = new Date(nowMs + 60 * 60 * 1000);
    }

    activeBooking.endTime = endTime;

    if (!useInMemory && mongoose.connection.readyState === 1) {
      try {
        await Booking.findByIdAndUpdate(activeBooking._id, {
          relayActivationStatus: 'ACTIVATED',
          lastScanTime: new Date(),
          endTime: endTime
        });
        await Machine.findOneAndUpdate(
          { machineId: 'HABBITT-M01' },
          {
            relayState: true,
            status: 'RUNNING',
            activeBookingId: activeBooking.bookingId,
            activeUser: registeredUser.name,
            activeUserId: registeredUser._id ? registeredUser._id.toString() : String(registeredUser.id),
            lastCardScanned: rawId,
            lastScanTime: new Date(),
            lastScanStatus: 'ACCESS_GRANTED',
            slotEndTime: endTime
          }
        );
      } catch (e) {}
    } else {
      inMemoryStore.machine = {
        ...inMemoryStore.machine,
        relayState: true,
        status: 'RUNNING',
        activeBookingId: activeBooking.bookingId,
        activeUser: registeredUser.name,
        activeUserId: registeredUser._id ? registeredUser._id.toString() : String(registeredUser.id),
        lastCardScanned: rawId,
        lastScanTime: new Date(),
        lastScanStatus: 'ACCESS_GRANTED',
        slotEndTime: endTime
      };
    }

    return res.json({
      success: true,
      relayState: true,
      relayPin: 4,
      message: `Welcome ${registeredUser.name}! Laundry Machine Activated!`,
      userName: registeredUser.name,
      timeSlot: activeBooking.timeSlot,
      bookingId: activeBooking.bookingId
    });
  } catch (err) {
    console.error('Error in /api/rfid/scan:', err);
    res.status(500).json({ success: false, relayState: false, message: err.message });
  }
});

let lastEsp32Heartbeat = Date.now();

// Live Machine Status Endpoint
app.get('/api/machine/status', async (req, res) => {
  try {
    if (req.query.esp32 || req.headers['user-agent']?.includes('ESP32') || req.headers['x-device-key']) {
      lastEsp32Heartbeat = Date.now();
    }

    let machineObj = null;
    if (!useInMemory && mongoose.connection.readyState === 1) {
      machineObj = await Machine.findOne({ machineId: 'HABBITT-M01' });
      if (machineObj) machineObj = machineObj.toObject();
    } else {
      machineObj = { ...inMemoryStore.machine };
    }

    if (!machineObj) {
      machineObj = { machineId: 'HABBITT-M01', status: 'STANDBY', relayState: false };
    }

    // Auto-turn OFF machine when booked slot duration expires
    if (machineObj && machineObj.relayState && machineObj.slotEndTime) {
      const now = new Date();
      const endTime = new Date(machineObj.slotEndTime);
      if (now > endTime) {
        console.log(`⏰ [SLOT EXPIRED] Machine time slot finished! Auto turning OFF Relay.`);
        machineObj.relayState = false;
        machineObj.status = 'STANDBY';
        machineObj.activeBookingId = null;
        machineObj.activeUser = null;
        machineObj.slotEndTime = null;
        if (!useInMemory && mongoose.connection.readyState === 1) {
          try {
            await Machine.findOneAndUpdate(
              { machineId: 'HABBITT-M01' }, 
              { relayState: false, status: 'STANDBY', activeBookingId: null, activeUser: null, slotEndTime: null }
            );
          } catch(e){}
        } else {
          inMemoryStore.machine.relayState = false;
          inMemoryStore.machine.status = 'STANDBY';
          inMemoryStore.machine.activeBookingId = null;
          inMemoryStore.machine.activeUser = null;
          inMemoryStore.machine.slotEndTime = null;
        }
      }
    }

    // Calculate real-time ESP32 Online/Offline & Status Rules
    const secondsAgo = Math.max(0, Math.floor((Date.now() - lastEsp32Heartbeat) / 1000));
    const isOnline = secondsAgo <= 10;
    
    let computedStatus = 'OFFLINE';
    if (isOnline) {
      computedStatus = machineObj.relayState ? 'RUNNING' : 'STANDBY';
    }

    if (useInMemory && inMemoryStore.machine) {
      inMemoryStore.machine.status = computedStatus;
    }

    const isHardwareOrAdminOrOwner = 
      Boolean(req.query.esp32) || 
      Boolean(req.headers['x-device-key']) || 
      Boolean(req.headers['user-agent']?.includes('ESP32')) ||
      (req.user && req.user.role === 'admin') ||
      (req.user && machineObj.activeUserId && String(machineObj.activeUserId) === String(req.user.id));

    if (isHardwareOrAdminOrOwner) {
      return res.json({
        ...machineObj,
        status: computedStatus,
        isOnline,
        lastHeartbeat: new Date(lastEsp32Heartbeat).toISOString(),
        lastHeartbeatSecondsAgo: secondsAgo
      });
    }

    // Sanitized response for normal web users (Zero private owner data leaked)
    return res.json({
      machineId: machineObj.machineId || 'HABBITT-M01',
      name: machineObj.name || 'Habbitt Ultra Wash X1',
      location: machineObj.location || 'Habbitt Laundry Station #1',
      relayPin: machineObj.relayPin || 4,
      relayState: Boolean(machineObj.relayState),
      status: computedStatus,
      isOnline,
      lastHeartbeat: new Date(lastEsp32Heartbeat).toISOString(),
      lastHeartbeatSecondsAgo: secondsAgo,
      slotEndTime: machineObj.slotEndTime || null
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Background Heartbeat Monitor & Auto-Turn OFF Timer (Runs every 2 seconds)
setInterval(async () => {
  try {
    const now = Date.now();
    const secondsAgo = Math.max(0, Math.floor((now - lastEsp32Heartbeat) / 1000));
    const isOnline = secondsAgo <= 10;

    // 1. AUTOMATIC ESP32 HEARTBEAT LOSS / OFFLINE DETECTION (> 10 SECONDS OFFLINE)
    const machine = inMemoryStore.machine;
    if (machine) {
      if (!isOnline) {
        machine.status = 'OFFLINE';
      } else {
        machine.status = machine.relayState ? 'RUNNING' : 'STANDBY';
      }
    }

    if (!useInMemory && mongoose.connection.readyState === 1) {
      const machine = await Machine.findOne({ machineId: 'HABBITT-M01' });
      if (machine && machine.relayState && machine.slotEndTime) {
        if (now > new Date(machine.slotEndTime)) {
          console.log(`⏰ [BACKGROUND AUTO-OFF] Booked slot time finished! Turning OFF Machine Relay automatically.`);
          await Machine.findOneAndUpdate(
            { machineId: 'HABBITT-M01' },
            { relayState: false, status: 'STANDBY', activeBookingId: null, activeUser: null, slotEndTime: null }
          );
        }
      }
    } else {
      const machine = inMemoryStore.machine;
      if (machine && machine.relayState && machine.slotEndTime) {
        if (now > new Date(machine.slotEndTime)) {
          console.log(`⏰ [BACKGROUND AUTO-OFF] Booked slot time finished! Turning OFF Machine Relay automatically.`);
          machine.relayState = false;
          machine.status = 'STANDBY';
          machine.activeBookingId = null;
          machine.activeUser = null;
          machine.slotEndTime = null;
        }
      }
    }
  } catch (err) {
    console.error('Error in background auto-off task:', err.message);
  }
}, 3000);

// Toggle Machine Relay Manually (For Dashboard Controls & Emergency Stop)
app.post('/api/machine/toggle', authenticate, async (req, res) => {
  try {
    const { relayState } = req.body; // true or false
    const now = new Date();
    const currentUserId = String(req.user.id);

    let machineDoc = null;
    let registeredUser = null;
    let userActiveBooking = null;

    if (!useInMemory && mongoose.connection.readyState === 1) {
      machineDoc = await Machine.findOne({ machineId: 'HABBITT-M01' });
      const users = await User.find();
      registeredUser = users.find(u => String(u._id) === currentUserId);
      if (registeredUser) {
        const bookings = await Booking.find({ user: registeredUser._id, paymentStatus: 'PAID' }).sort({ createdAt: -1 });
        userActiveBooking = bookings.find(b => isBookingActiveNow(b, now));
      }
    } else {
      machineDoc = inMemoryStore.machine;
      registeredUser = inMemoryStore.users.find(u => String(u._id) === currentUserId || u.email === req.user.email) || inMemoryStore.users[0];
      if (registeredUser) {
        const bookings = inMemoryStore.bookings.filter(b => 
          (String(b.user) === String(registeredUser._id) || (b.rfidCardId && registeredUser.rfidCardId && b.rfidCardId.replace(/[^A-F0-9]/g, '') === registeredUser.rfidCardId.replace(/[^A-F0-9]/g, ''))) &&
          b.paymentStatus === 'PAID'
        );
        userActiveBooking = bookings.find(b => isBookingActiveNow(b, now));
      }
    }

    // STRICT USER ID SECURITY CONTROL:
    // Only the user who owns the active booking slot for right now can manually Turn ON or Turn OFF the machine!
    const isAdminUser = req.user && req.user.role === 'admin';
    
    // 1. Check if user has an active booking slot right now (unless admin)
    if (!userActiveBooking && !isAdminUser) {
      return res.status(403).json({
        success: false,
        message: "🔒 Access Denied: Another user is currently using this machine. You cannot control or stop someone else's active wash session!"
      });
    }

    // 2. Turning ON Validation: Must have tapped RFID card first
    if (relayState) {
      if (userActiveBooking && userActiveBooking.relayActivationStatus !== 'ACTIVATED' && !isAdminUser) {
        return res.status(400).json({
          success: false,
          message: '🔒 Security Lock: Please tap your physical RFID Card at the machine scanner first to unlock & start your session!'
        });
      }
    } else {
      // 3. Turning OFF Validation: Prevent User B from stopping User A's active machine session!
      if (machineDoc && machineDoc.relayState && !isAdminUser) {
        const activeUserId = machineDoc.activeUserId;
        if (activeUserId && String(activeUserId) !== currentUserId) {
          return res.status(403).json({
            success: false,
            message: "🔒 Access Denied: Another user is currently using this machine. You cannot stop someone else's active wash session!"
          });
        }
      }
    }

    const targetStatus = relayState ? 'RUNNING' : 'STANDBY';
    let targetSlotEndTime = null;

    if (relayState && userActiveBooking) {
      const nowMs = Date.now();
      let eTime = userActiveBooking.endTime ? new Date(userActiveBooking.endTime) : null;
      if (userActiveBooking.timeSlot && userActiveBooking.timeSlot.includes('Mins')) {
        const match = userActiveBooking.timeSlot.match(/(\d+)\s*Mins/i);
        const durationMins = match ? parseInt(match[1]) : 2;
        targetSlotEndTime = new Date(nowMs + durationMins * 60 * 1000);
      } else if (!eTime || eTime.getTime() <= nowMs + 10000) {
        targetSlotEndTime = new Date(nowMs + 60 * 60 * 1000);
      } else {
        targetSlotEndTime = eTime;
      }
    }

    if (!useInMemory && mongoose.connection.readyState === 1) {
      const updated = await Machine.findOneAndUpdate(
        { machineId: 'HABBITT-M01' },
        {
          relayState: Boolean(relayState),
          status: targetStatus,
          activeBookingId: relayState ? userActiveBooking.bookingId : null,
          activeUser: relayState ? (registeredUser ? registeredUser.name : 'User') : null,
          activeUserId: relayState ? currentUserId : null,
          slotEndTime: targetSlotEndTime
        },
        { new: true }
      );
      return res.json(updated);
    } else {
      inMemoryStore.machine.relayState = Boolean(relayState);
      inMemoryStore.machine.status = targetStatus;
      inMemoryStore.machine.activeBookingId = relayState ? userActiveBooking.bookingId : null;
      inMemoryStore.machine.activeUser = relayState ? (registeredUser ? registeredUser.name : 'User') : null;
      inMemoryStore.machine.activeUserId = relayState ? currentUserId : null;
      inMemoryStore.machine.slotEndTime = targetSlotEndTime;
      return res.json(inMemoryStore.machine);
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Database Connection & Server Initialization
async function startServer() {
  // 1. Validate JWT_SECRET in production
  if (isProduction && (!process.env.JWT_SECRET || !process.env.JWT_SECRET.trim())) {
    console.error('=======================================================');
    console.error('❌ FATAL ERROR: JWT_SECRET environment variable is missing in production mode.');
    console.error('   The server process will exit safely.');
    console.error('=======================================================');
    process.exit(1);
  }

  // 2. Validate MONGODB_URI & Connect to Database
  if (isProduction && (!MONGODB_URI || !MONGODB_URI.trim())) {
    console.error('=======================================================');
    console.error('❌ FATAL ERROR: MONGODB_URI environment variable is missing in production mode.');
    console.error('   In-memory database fallback is disabled in production.');
    console.error('   The server process will exit safely.');
    console.error('=======================================================');
    process.exit(1);
  }

  if (MONGODB_URI && MONGODB_URI.trim()) {
    console.log('📡 Attempting MongoDB Atlas Connection...');
    try {
      await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
      console.log('=======================================================');
      console.log('✅ CONNECTED TO MONGODB ATLAS DATABASE SUCCESSFULLY!');
      console.log('=======================================================');
      useInMemory = false;

      // Initialize Machine record if empty
      const existing = await Machine.findOne({ machineId: 'HABBITT-M01' });
      if (!existing) {
        await Machine.create({
          machineId: 'HABBITT-M01',
          name: 'Habbitt Ultra Wash X1',
          location: 'Habbitt Station #1',
          relayPin: 4,
          relayState: false,
          status: 'IDLE'
        });
      }
    } catch (err) {
      console.error('=======================================================');
      console.error('❌ MongoDB Atlas Connection Error:', err.message);
      console.error('=======================================================');

      if (isProduction) {
        console.error('❌ FATAL ERROR: Unable to connect to MongoDB Atlas in production mode.');
        console.error('   In-Memory database fallback is disabled in production.');
        console.error('   Exiting server process.');
        process.exit(1);
      } else {
        console.warn('💡 Tip: Ensure your server IP / Render environment is allowed in MongoDB Atlas Network Access (0.0.0.0/0).');
        console.warn('⚡ Operating in In-Memory Database Fallback Mode for local development.');
        useInMemory = true;
      }
    }
  } else {
    console.warn('⚠️ MONGODB_URI environment variable is not set. Operating in In-Memory Fallback Mode for local development.');
    useInMemory = true;
  }

  // 3. Start Express Server listening on PORT
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`🚀 HABBITT SMART LAUNDRY BACKEND RUNNING ON PORT ${PORT}`);
    console.log(`=======================================================`);
  });
}

startServer();
