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
      hostelName: 'St. Xavier PG Hostel #1',
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
    const { name, email, phone, password, rfidCardId, hostelName, role } = req.body;
    if (!name || !email || !phone || !password || !rfidCardId) {
      return res.status(400).json({ message: 'All fields are required including RFID Card ID and Hostel/PG Name' });
    }

    const cleanRfid = rfidCardId.trim().toUpperCase().replace(/\s+/g, ':');
    const cleanHostel = (hostelName && hostelName.trim()) ? hostelName.trim() : 'Main PG / Hostel';
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
        hostelName: cleanHostel,
        role: userRole
      });

      const token = jwt.sign({ id: newUser._id, email: newUser.email, name: newUser.name, role: newUser.role }, JWT_SECRET);
      return res.json({ token, user: { id: newUser._id, name: newUser.name, email: newUser.email, phone: newUser.phone, rfidCardId: cleanRfid, hostelName: cleanHostel, role: newUser.role } });
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
        hostelName: cleanHostel,
        role: userRole,
        createdAt: new Date()
      };
      inMemoryStore.users.push(newUser);
      const token = jwt.sign({ id: newUser._id, email: newUser.email, name: newUser.name, role: newUser.role }, JWT_SECRET);
      return res.json({ token, user: { id: newUser._id, name: newUser.name, email: newUser.email, phone: newUser.phone, rfidCardId: cleanRfid, hostelName: cleanHostel, role: newUser.role } });
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
        hostelName: userObj.hostelName || 'Main PG / Hostel',
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

  // 1. Direct JavaScript Date comparison (with 10-min buffer before start)
  const start = new Date(b.startTime);
  const end   = new Date(b.endTime);
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
  try {
    const istDateString = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const istTimeStr    = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
    const [currentHour, currentMin] = istTimeStr.split(':').map(Number);
    const nowTotalMins  = currentHour * 60 + currentMin;

    const bDate = b.date ? String(b.date).trim() : '';
    if (bDate === istDateString && b.timeSlot) {
      const parts = String(b.timeSlot).split(' - ');
      const parseSlotTime = (tStr) => {
        const cleanStr = tStr.replace(/^[^\d]*/, '').trim();
        const spaceIdx = cleanStr.lastIndexOf(' ');
        if (spaceIdx === -1) return null;
        const timePart = cleanStr.substring(0, spaceIdx);
        const modifier = cleanStr.substring(spaceIdx + 1).toUpperCase();
        let [h, m] = timePart.split(':').map(Number);
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
        message: 'No active booking.'
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
        const userBookings = await Booking.find({
          user: registeredUser._id,
          paymentStatus: 'PAID'
        }).sort({ createdAt: -1 });

        // Verify booking belongs to this user and current time is inside booking slot
        activeBooking = userBookings.find(b => {
          const bUser = String(b.user);
          const rUser = String(registeredUser._id);
          const bCard = b.rfidCardId ? b.rfidCardId.replace(/[^A-F0-9]/g, '') : '';
          return bUser === rUser && bCard === cleanedScanId && isBookingActiveNow(b, now);
        });
      }
    } else {
      // IN-MEMORY MODE
      registeredUser = inMemoryStore.users.find(u => u.rfidCardId && u.rfidCardId.replace(/[^A-F0-9]/g, '') === cleanedScanId);

      if (registeredUser) {
        const userBookings = inMemoryStore.bookings.filter(b =>
          String(b.user) === String(registeredUser._id) && b.paymentStatus === 'PAID'
        );
        activeBooking = userBookings.find(b => {
          const bCard = b.rfidCardId ? b.rfidCardId.replace(/[^A-F0-9]/g, '') : '';
          return bCard === cleanedScanId && isBookingActiveNow(b, now);
        });
      }
    }

    let machineDoc = null;
    if (!useInMemory && mongoose.connection.readyState === 1) {
      machineDoc = await Machine.findOne({ machineId: 'HABBITT-M01' });
    } else {
      machineDoc = inMemoryStore.machine;
    }

    const currentActiveUserId = machineDoc && machineDoc.activeUserId ? String(machineDoc.activeUserId) : null;
    const rfidOwnerId = registeredUser ? String(registeredUser._id || registeredUser.id) : null;

    // 1. If Card is NOT registered or User has NO active paid booking slot right now
    if (!registeredUser || !activeBooking || !rfidOwnerId) {
      console.warn(`❌ ACCESS DENIED: Unregistered card or no active paid slot for RFID [${cleanedScanId}]`);
      return res.status(403).json({
        success: false,
        relayState: false,
        message: 'No active booking.'
      });
    }

    // 2. Check if machine is currently active & owned by ANOTHER user
    if (currentActiveUserId && currentActiveUserId !== rfidOwnerId && machineDoc?.relayState) {
      console.warn(`❌ ACCESS DENIED: Machine is owned by another active user session.`);
      return res.status(403).json({
        success: false,
        relayState: false,
        message: 'Machine is currently unavailable.'
      });
    }

    // 3. VALID CARD + MATCHING BOOKING USER + ACTIVE SLOT FOUND! Activate Machine Relay!
    console.log(`🎉 ACCESS GRANTED! User ID: ${rfidOwnerId} | Slot: ${activeBooking.timeSlot} | Relay ON!`);

    activeBooking.relayActivationStatus = 'ACTIVATED';
    activeBooking.lastScanTime = new Date();

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
          activeUserId: rfidOwnerId,
          activeRfidCardId: activeBooking.rfidCardId,
          lastCardScanned: rawId,
          lastScanTime: new Date(),
          lastScanStatus: 'ACCESS_GRANTED',
          slotEndTime: endTime
        }
      );
    } else {
      inMemoryStore.machine = {
        ...inMemoryStore.machine,
        relayState: true,
        status: 'RUNNING',
        activeBookingId: activeBooking.bookingId,
        activeUser: registeredUser.name,
        activeUserId: rfidOwnerId,
        activeRfidCardId: activeBooking.rfidCardId,
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
      message: 'Access granted.',
      timeSlot: activeBooking.timeSlot,
      bookingId: activeBooking.bookingId
    });
  } catch (err) {
    console.error('Error in /api/rfid/scan:', err);
    res.status(500).json({ success: false, relayState: false, message: 'No active booking.' });
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
      machineDoc = await Machine.findOne({ machineId: 'HABBITT-M01' });
      if (machineDoc) machineObj = machineDoc.toObject();
    } else {
      machineObj = { ...inMemoryStore.machine };
    }

    if (!machineObj) {
      machineObj = { machineId: 'HABBITT-M01', status: 'STANDBY', relayState: false, activeUserId: null };
    }

    const now = new Date();

    // Auto-turn OFF machine when booked slot duration expires
    if (machineObj && machineObj.relayState && machineObj.slotEndTime) {
      const endTime = new Date(machineObj.slotEndTime);
      if (now >= endTime) {
        console.log(`⏰ [SLOT EXPIRED] Machine slot finished! Clearing active session & turning OFF Relay.`);
        machineObj.relayState = false;
        machineObj.status = 'IDLE';
        machineObj.activeBookingId = null;
        machineObj.activeUser = null;
        machineObj.activeUserId = null;
        machineObj.activeRfidCardId = null;
        machineObj.slotEndTime = null;

        if (!useInMemory && mongoose.connection.readyState === 1) {
          try {
            await Machine.findOneAndUpdate(
              { machineId: 'HABBITT-M01' },
              {
                relayState: false,
                status: 'IDLE',
                activeBookingId: null,
                activeUser: null,
                activeUserId: null,
                activeRfidCardId: null,
                slotEndTime: null
              }
            );
          } catch (e) {}
        } else {
          inMemoryStore.machine.relayState = false;
          inMemoryStore.machine.status = 'IDLE';
          inMemoryStore.machine.activeBookingId = null;
          inMemoryStore.machine.activeUser = null;
          inMemoryStore.machine.activeUserId = null;
          inMemoryStore.machine.activeRfidCardId = null;
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

    const isEsp32OrAdmin =
      Boolean(req.query.esp32) ||
      Boolean(req.headers['x-device-key']) ||
      Boolean(req.headers['user-agent']?.includes('ESP32')) ||
      (req.user && req.user.role === 'admin');

    if (isEsp32OrAdmin) {
      return res.json({
        ...machineObj,
        status: computedStatus,
        isOnline,
        lastHeartbeat: new Date(lastEsp32Heartbeat).toISOString(),
        lastHeartbeatSecondsAgo: secondsAgo
      });
    }

    // Extract current authenticated user ID
    const currentUserId = req.user ? String(req.user.id) : null;
    const activeUserId = machineObj.activeUserId ? String(machineObj.activeUserId) : null;
    const isMySession = Boolean(currentUserId && activeUserId && currentUserId === activeUserId);

    // Calculate remaining seconds for active session
    let remainingSeconds = 0;
    if (machineObj.slotEndTime) {
      remainingSeconds = Math.max(0, Math.floor((new Date(machineObj.slotEndTime).getTime() - Date.now()) / 1000));
    }

    // Check if current user has an active paid booking slot right now
    let userHasActiveBookingNow = false;
    if (currentUserId) {
      if (!useInMemory && mongoose.connection.readyState === 1) {
        const userBookings = await Booking.find({ user: currentUserId, paymentStatus: 'PAID' }).sort({ createdAt: -1 });
        userHasActiveBookingNow = userBookings.some(b => isBookingActiveNow(b, now));
      } else {
        const userBookings = inMemoryStore.bookings.filter(b => String(b.user) === currentUserId && b.paymentStatus === 'PAID');
        userHasActiveBookingNow = userBookings.some(b => isBookingActiveNow(b, now));
      }
    }

    // 1. OWNER OF ACTIVE SESSION RESPONSE
    if (machineObj.relayState && isMySession) {
      return res.json({
        success: true,
        machineId: machineObj.machineId || 'HABBITT-M01',
        status: 'RUNNING',
        relayState: true,
        isMySession: true,
        canControl: true,
        remainingSeconds: remainingSeconds,
        isOnline,
        lastHeartbeat: new Date(lastEsp32Heartbeat).toISOString(),
        lastHeartbeatSecondsAgo: secondsAgo
      });
    }

    // 2. NON-OWNER RESPONSE FOR ACTIVE SESSION (STRICT USER ISOLATION - ZERO PRIVATE DATA LEAKED)
    if (machineObj.relayState && !isMySession) {
      return res.json({
        success: true,
        machineId: machineObj.machineId || 'HABBITT-M01',
        status: 'UNAVAILABLE',
        relayState: false,
        isMySession: false,
        canControl: false,
        isOnline,
        lastHeartbeat: new Date(lastEsp32Heartbeat).toISOString(),
        lastHeartbeatSecondsAgo: secondsAgo
      });
    }

    // 3. IDLE / STANDBY MACHINE RESPONSE
    return res.json({
      success: true,
      machineId: machineObj.machineId || 'HABBITT-M01',
      status: isOnline ? 'STANDBY' : 'OFFLINE',
      relayState: false,
      isMySession: false,
      canControl: userHasActiveBookingNow,
      isOnline,
      lastHeartbeat: new Date(lastEsp32Heartbeat).toISOString(),
      lastHeartbeatSecondsAgo: secondsAgo
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Background Heartbeat Monitor & Auto-Turn OFF Timer (Runs every 3 seconds)
setInterval(async () => {
  try {
    const now = Date.now();
    const secondsAgo = Math.max(0, Math.floor((now - lastEsp32Heartbeat) / 1000));
    const isOnline = secondsAgo <= 10;

    const machine = inMemoryStore.machine;
    if (machine) {
      if (!isOnline) {
        machine.status = 'OFFLINE';
      } else {
        machine.status = machine.relayState ? 'RUNNING' : 'STANDBY';
      }
    }

    if (!useInMemory && mongoose.connection.readyState === 1) {
      const machineDoc = await Machine.findOne({ machineId: 'HABBITT-M01' });
      if (machineDoc && machineDoc.relayState && machineDoc.slotEndTime) {
        if (now >= new Date(machineDoc.slotEndTime).getTime()) {
          console.log(`⏰ [BACKGROUND AUTO-OFF] Booked slot time finished! Turning OFF Machine Relay automatically.`);
          await Machine.findOneAndUpdate(
            { machineId: 'HABBITT-M01' },
            {
              relayState: false,
              status: 'IDLE',
              activeBookingId: null,
              activeUser: null,
              activeUserId: null,
              activeRfidCardId: null,
              slotEndTime: null
            }
          );
        }
      }
    } else {
      const machine = inMemoryStore.machine;
      if (machine && machine.relayState && machine.slotEndTime) {
        if (now >= new Date(machine.slotEndTime).getTime()) {
          console.log(`⏰ [BACKGROUND AUTO-OFF] Booked slot time finished! Turning OFF Machine Relay automatically.`);
          machine.relayState = false;
          machine.status = 'IDLE';
          machine.activeBookingId = null;
          machine.activeUser = null;
          machine.activeUserId = null;
          machine.activeRfidCardId = null;
          machine.slotEndTime = null;
        }
      }
    }
  } catch (err) {
    console.error('Error in background auto-off task:', err.message);
  }
}, 3000);

// Toggle Machine Relay Manually (For Dashboard Controls & Session Control)
app.post('/api/machine/toggle', authenticate, async (req, res) => {
  try {
    const { relayState } = req.body; // true or false
    const now = new Date();
    const currentUserId = String(req.user.id);
    const isAdminUser = Boolean(req.user && req.user.role === 'admin');

    let machineDoc = null;
    let registeredUser = null;
    let userActiveBooking = null;

    if (!useInMemory && mongoose.connection.readyState === 1) {
      machineDoc = await Machine.findOne({ machineId: 'HABBITT-M01' });
      registeredUser = await User.findById(req.user.id);
      if (registeredUser) {
        const bookings = await Booking.find({ user: registeredUser._id, paymentStatus: 'PAID' }).sort({ createdAt: -1 });
        userActiveBooking = bookings.find(b => isBookingActiveNow(b, now));
      }
    } else {
      machineDoc = inMemoryStore.machine;
      registeredUser = inMemoryStore.users.find(u => String(u._id) === currentUserId || u.email === req.user.email);
      if (registeredUser) {
        const bookings = inMemoryStore.bookings.filter(b =>
          String(b.user) === String(registeredUser._id) && b.paymentStatus === 'PAID'
        );
        userActiveBooking = bookings.find(b => isBookingActiveNow(b, now));
      }
    }

    const activeUserId = machineDoc && machineDoc.activeUserId ? String(machineDoc.activeUserId) : null;
    const isSessionOwner = Boolean(activeUserId && activeUserId === currentUserId);

    // ------------------------------------------------------------------------
    // CASE 1: MANUAL STOP / TURNING OFF THE MACHINE (relayState === false)
    // ------------------------------------------------------------------------
    if (!relayState) {
      if (isSessionOwner || isAdminUser) {
        if (!useInMemory && mongoose.connection.readyState === 1) {
          const updated = await Machine.findOneAndUpdate(
            { machineId: 'HABBITT-M01' },
            {
              relayState: false,
              status: 'IDLE',
              activeBookingId: null,
              activeUser: null,
              activeUserId: null,
              activeRfidCardId: null,
              slotEndTime: null
            },
            { new: true }
          );
          return res.json({
            success: true,
            message: 'Machine stopped successfully.',
            relayState: false,
            status: 'IDLE',
            isMySession: false,
            canControl: false
          });
        } else {
          inMemoryStore.machine.relayState = false;
          inMemoryStore.machine.status = 'IDLE';
          inMemoryStore.machine.activeBookingId = null;
          inMemoryStore.machine.activeUser = null;
          inMemoryStore.machine.activeUserId = null;
          inMemoryStore.machine.activeRfidCardId = null;
          inMemoryStore.machine.slotEndTime = null;
          return res.json({
            success: true,
            message: 'Machine stopped successfully.',
            relayState: false,
            status: 'IDLE',
            isMySession: false,
            canControl: false
          });
        }
      }

      // Non-owner attempting to stop someone else's active machine session -> HTTP 403 Generic Error
      return res.status(403).json({
        success: false,
        message: 'Machine is currently unavailable.'
      });
    }

    // ------------------------------------------------------------------------
    // CASE 2: MANUAL START / TURNING ON THE MACHINE (relayState === true)
    // ------------------------------------------------------------------------
    if (relayState) {
      // 1. If another user owns active machine session -> Reject HTTP 403
      if (activeUserId && activeUserId !== currentUserId && !isAdminUser) {
        return res.status(403).json({
          success: false,
          message: 'Machine is currently unavailable.'
        });
      }

      // 2. User MUST have a valid PAID booking for the CURRENT TIME SLOT
      if (!userActiveBooking && !isAdminUser) {
        return res.status(403).json({
          success: false,
          message: 'No active booking is available for this time.'
        });
      }

      const nowMs = Date.now();
      let targetSlotEndTime = null;
      if (userActiveBooking) {
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
      } else {
        targetSlotEndTime = new Date(nowMs + 60 * 60 * 1000);
      }

      const activeBId = userActiveBooking ? userActiveBooking.bookingId : (machineDoc ? machineDoc.activeBookingId : null);
      const activeUName = registeredUser ? registeredUser.name : 'User';
      const activeCardId = userActiveBooking ? userActiveBooking.rfidCardId : (registeredUser ? registeredUser.rfidCardId : null);

      if (!useInMemory && mongoose.connection.readyState === 1) {
        await Machine.findOneAndUpdate(
          { machineId: 'HABBITT-M01' },
          {
            relayState: true,
            status: 'RUNNING',
            activeBookingId: activeBId,
            activeUser: activeUName,
            activeUserId: currentUserId,
            activeRfidCardId: activeCardId,
            slotEndTime: targetSlotEndTime
          },
          { new: true }
        );
        return res.json({
          success: true,
          message: 'Machine started successfully.',
          relayState: true,
          status: 'RUNNING',
          isMySession: true,
          canControl: true
        });
      } else {
        inMemoryStore.machine.relayState = true;
        inMemoryStore.machine.status = 'RUNNING';
        inMemoryStore.machine.activeBookingId = activeBId;
        inMemoryStore.machine.activeUser = activeUName;
        inMemoryStore.machine.activeUserId = currentUserId;
        inMemoryStore.machine.activeRfidCardId = activeCardId;
        inMemoryStore.machine.slotEndTime = targetSlotEndTime;
        return res.json({
          success: true,
          message: 'Machine started successfully.',
          relayState: true,
          status: 'RUNNING',
          isMySession: true,
          canControl: true
        });
      }
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
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
