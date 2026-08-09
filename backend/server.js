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
const JWT_SECRET = process.env.JWT_SECRET || 'habbitt_secret_key_2026';

const allowedOrigins = process.env.FRONTEND_URL 
  ? [process.env.FRONTEND_URL.replace(/\/$/, ''), 'http://localhost:5173', 'http://localhost:3000']
  : '*';

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins === '*' || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true);
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

// Connect MongoDB Atlas using process.env.MONGODB_URI
const MONGODB_URI = process.env.MONGODB_URI;

if (MONGODB_URI) {
  console.log('📡 Attempting MongoDB Atlas Connection...');
  mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
    .then(async () => {
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
    })
    .catch(err => {
      console.warn('⚠️ MongoDB Atlas Connection Warning:', err.message);
      console.warn('💡 Tip: Ensure your server IP / Render environment is allowed in MongoDB Atlas Network Access (0.0.0.0/0).');
      console.warn('⚡ Operating in In-Memory Database Fallback Mode!');
      useInMemory = true;
    });
} else {
  console.warn('⚠️ MONGODB_URI environment variable is not set. Operating in In-Memory Fallback Mode.');
  useInMemory = true;
}

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
    const { name, email, phone, password, rfidCardId } = req.body;
    if (!name || !email || !phone || !password || !rfidCardId) {
      return res.status(400).json({ message: 'All fields are required including RFID Card ID' });
    }

    const cleanRfid = rfidCardId.trim().toUpperCase().replace(/\s+/g, ':');

    if (!useInMemory && mongoose.connection.readyState === 1) {
      const existingUser = await User.findOne({ email });
      if (existingUser) return res.status(400).json({ message: 'Email already registered' });

      const hashedPassword = await bcrypt.hash(password, 8);
      const newUser = await User.create({
        name,
        email,
        phone,
        password: hashedPassword,
        rfidCardId: cleanRfid
      });

      const token = jwt.sign({ id: newUser._id, email: newUser.email, name: newUser.name }, JWT_SECRET);
      return res.json({ token, user: { id: newUser._id, name, email, phone, rfidCardId: cleanRfid } });
    } else {
      const existing = inMemoryStore.users.find(u => u.email === email);
      if (existing) return res.status(400).json({ message: 'Email already registered' });

      const newUser = {
        _id: 'u_' + Date.now(),
        name,
        email,
        phone,
        password: bcrypt.hashSync(password, 8),
        rfidCardId: cleanRfid,
        createdAt: new Date()
      };
      inMemoryStore.users.push(newUser);
      const token = jwt.sign({ id: newUser._id, email: newUser.email, name: newUser.name }, JWT_SECRET);
      return res.json({ token, user: { id: newUser._id, name, email, phone, rfidCardId: cleanRfid } });
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

    let userObj = null;
    if (!useInMemory && mongoose.connection.readyState === 1) {
      userObj = await User.findOne({ $or: [{ email: identifier }, { phone: identifier }] });
    } else {
      userObj = inMemoryStore.users.find(u => u.email === identifier || u.phone === identifier);
    }

    if (!userObj) return res.status(400).json({ message: 'User not found. Please register.' });

    const isMatch = await bcrypt.compare(password, userObj.password);
    if (!isMatch) return res.status(400).json({ message: 'Incorrect password' });

    const token = jwt.sign({ id: userObj._id, email: userObj.email, name: userObj.name }, JWT_SECRET);
    return res.json({
      token,
      user: {
        id: userObj._id,
        name: userObj.name,
        email: userObj.email,
        phone: userObj.phone,
        rfidCardId: userObj.rfidCardId
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
      userObj = inMemoryStore.users.find(u => u._id === req.user.id);
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
      const user = await User.findByIdAndUpdate(req.user.id, { rfidCardId: cleanRfid }, { new: true }).select('-password');
      return res.json({ message: 'RFID Card updated successfully', user });
    } else {
      let user = inMemoryStore.users.find(u => u._id === req.user.id || u.email === req.user.email);
      if (!user) user = inMemoryStore.users[0];
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

// Helper to generate dynamic 2-minute time slots for testing mode
const get2MinTestingSlots = () => {
  const slots = [];
  const now = new Date();
  const baseMinutes = Math.floor(now.getMinutes() / 2) * 2;
  const baseTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), baseMinutes);

  for (let i = 0; i < 12; i++) {
    const start = new Date(baseTime.getTime() + i * 2 * 60 * 1000);
    const end = new Date(start.getTime() + 2 * 60 * 1000);
    const sStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const eStr = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    slots.push(`${sStr} - ${eStr}`);
  }
  return slots;
};

// Available slots for a date
app.get('/api/slots/available', async (req, res) => {
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];

  const currentTestingSlots = get2MinTestingSlots();

  let bookedSlots = [];
  if (!useInMemory && mongoose.connection.readyState === 1) {
    const bookings = await Booking.find({ date: targetDate, paymentStatus: 'PAID' });
    bookedSlots = bookings.map(b => b.timeSlot);
  } else {
    bookedSlots = inMemoryStore.bookings
      .filter(b => b.date === targetDate && b.paymentStatus === 'PAID')
      .map(b => b.timeSlot);
  }

  const slotList = currentTestingSlots.map(slot => ({
    timeSlot: slot,
    isAvailable: !bookedSlots.some(b => b && b.includes(slot)),
    price: 60
  }));

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
      userObj = inMemoryStore.users.find(u => u._id === req.user.id || u.email === req.user.email) || inMemoryStore.users[0];
    }

    if (!userObj) return res.status(404).json({ message: 'User not found' });

    let startTime, endTime, finalSlotName, bookingDate;
    if (customDurationMinutes) {
      const minutes = Math.max(1, parseInt(customDurationMinutes) || 1);
      const now = new Date();
      startTime = now;
      endTime = new Date(now.getTime() + minutes * 60 * 1000);
      bookingDate = now.toISOString().split('T')[0];
      const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      finalSlotName = `Slot (${minutes} Mins - Started ${timeString})`;
    } else {
      if (!date || !timeSlot) {
        return res.status(400).json({ message: 'Date and time slot required' });
      }
      bookingDate = date;
      finalSlotName = timeSlot;

      // Parse start and end time for 2-minute slot
      const parts = timeSlot.split(' - ');
      const parseTime = (timeStr) => {
        const cleanStr = timeStr.trim();
        const spaceIdx = cleanStr.lastIndexOf(' ');
        const timePart = cleanStr.substring(0, spaceIdx);
        const modifier = cleanStr.substring(spaceIdx + 1).toUpperCase();
        let [hours, minutes] = timePart.split(':').map(Number);
        if (modifier === 'PM' && hours < 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;
        const [year, month, day] = bookingDate.split('-').map(Number);
        return new Date(year, month - 1, day, hours, minutes, 0, 0);
      };

      try {
        startTime = parseTime(parts[0]);
        endTime = new Date(startTime.getTime() + 2 * 60 * 1000); // 2 Minutes Duration
      } catch (e) {
        const now = new Date();
        startTime = now;
        endTime = new Date(now.getTime() + 2 * 60 * 1000);
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

// My Bookings
app.get('/api/bookings/my-history', authenticate, async (req, res) => {
  try {
    let bookings = [];
    if (!useInMemory && mongoose.connection.readyState === 1) {
      bookings = await Booking.find({ $or: [{ user: req.user.id }, { rfidCardId: req.user.rfidCardId }] }).sort({ createdAt: -1 });
    } else {
      bookings = inMemoryStore.bookings.filter(b => 
        String(b.user) === String(req.user.id) || 
        b.user === 'u1' ||
        (b.userPhone && req.user.phone && b.userPhone === req.user.phone) ||
        (b.rfidCardId && req.user.rfidCardId && b.rfidCardId.replace(/[^A-F0-9]/g, '') === req.user.rfidCardId.replace(/[^A-F0-9]/g, '')) ||
        true
      );
    }
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Receipt Details by Booking ID
app.get('/api/bookings/receipt/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let booking = null;
    if (!useInMemory && mongoose.connection.readyState === 1) {
      booking = await Booking.findOne({ $or: [{ bookingId: id }, { _id: mongoose.Types.ObjectId.isValid(id) ? id : null }] });
    } else {
      booking = inMemoryStore.bookings.find(b => b.bookingId === id || b._id === id);
    }

    if (!booking) return res.status(404).json({ message: 'Receipt / Booking not found' });
    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// -------------------------------------------------------------
// 3. ESP32 RFID HARDWARE & MACHINE CONTROLLER ROUTES
// -------------------------------------------------------------

// ESP32 RFID Scan Endpoint
// Receives JSON from ESP32: { "rfidCardId": "2C:4F:6D:05" }
app.post('/api/rfid/scan', async (req, res) => {
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
        activeBooking = userBookings.find(b => {
          const start = new Date(b.startTime);
          const end   = new Date(b.endTime);
          const bufferBefore = new Date(start.getTime() - 10 * 60 * 1000);
          return now >= bufferBefore && now <= end;
        });
      }

      // Fallback: Check if any active booking explicitly was assigned this card ID
      if (!activeBooking) {
        const paidBookings = await Booking.find({ paymentStatus: 'PAID' }).sort({ createdAt: -1 });
        activeBooking = paidBookings.find(b => {
          const bCard = b.rfidCardId ? b.rfidCardId.replace(/[^A-F0-9]/g, '') : '';
          if (bCard !== cleanedScanId) return false;
          const start = new Date(b.startTime);
          const end   = new Date(b.endTime);
          const bufferBefore = new Date(start.getTime() - 10 * 60 * 1000);
          return now >= bufferBefore && now <= end;
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
        activeBooking = userBookings.find(b => {
          const start = new Date(b.startTime);
          const end   = new Date(b.endTime);
          const bufferBefore = new Date(start.getTime() - 10 * 60 * 1000);
          return now >= bufferBefore && now <= end;
        });
      }

      // Fallback: Check bookings explicitly matching rfidCardId
      if (!activeBooking) {
        const matchingBooking = inMemoryStore.bookings.find(b => {
          if (b.paymentStatus !== 'PAID') return false;
          const bCard = b.rfidCardId ? b.rfidCardId.replace(/[^A-F0-9]/g, '') : '';
          if (bCard !== cleanedScanId) return false;
          const start = new Date(b.startTime);
          const end   = new Date(b.endTime);
          const bufferBefore = new Date(start.getTime() - 10 * 60 * 1000);
          return now >= bufferBefore && now <= end;
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

    const endTime = new Date(activeBooking.endTime);

    if (!useInMemory && mongoose.connection.readyState === 1) {
      try {
        await Booking.findByIdAndUpdate(activeBooking._id, {
          relayActivationStatus: 'ACTIVATED',
          lastScanTime: new Date()
        });
        await Machine.findOneAndUpdate(
          { machineId: 'HABBITT-M01' },
          {
            relayState: true,
            status: 'RUNNING',
            activeBookingId: activeBooking.bookingId,
            activeUser: registeredUser.name,
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
    if (req.query.esp32 || req.headers['user-agent']?.includes('ESP32')) {
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
        if (!useInMemory && mongoose.connection.readyState === 1) {
          try {
            await Machine.findOneAndUpdate(
              { machineId: 'HABBITT-M01' }, 
              { relayState: false, status: 'STANDBY', activeBookingId: null, activeUser: null }
            );
          } catch(e){}
        } else {
          inMemoryStore.machine.relayState = false;
          inMemoryStore.machine.status = 'STANDBY';
          inMemoryStore.machine.activeBookingId = null;
          inMemoryStore.machine.activeUser = null;
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

    res.json({
      ...machineObj,
      status: computedStatus,
      isOnline,
      lastHeartbeat: new Date(lastEsp32Heartbeat).toISOString(),
      lastHeartbeatSecondsAgo: secondsAgo
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
            { relayState: false, status: 'IDLE', activeBookingId: null, activeUser: null }
          );
        }
      }
    } else {
      const machine = inMemoryStore.machine;
      if (machine && machine.relayState && machine.slotEndTime) {
        if (now > new Date(machine.slotEndTime)) {
          console.log(`⏰ [BACKGROUND AUTO-OFF] Booked slot time finished! Turning OFF Machine Relay automatically.`);
          machine.relayState = false;
          machine.status = 'IDLE';
          machine.activeBookingId = null;
          machine.activeUser = null;
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

    let activeBooking = null;
    let registeredUser = null;

    if (!useInMemory && mongoose.connection.readyState === 1) {
      const users = await User.find();
      registeredUser = users.find(u => u._id.toString() === req.user.id);
      if (registeredUser) {
        const bookings = await Booking.find({ user: registeredUser._id, paymentStatus: 'PAID' }).sort({ createdAt: -1 });
        activeBooking = bookings.find(b => {
          const start = new Date(b.startTime);
          const end = new Date(b.endTime);
          return now >= start && now <= end;
        });
      }
    } else {
      registeredUser = inMemoryStore.users.find(u => u._id === req.user.id || u.email === req.user.email) || inMemoryStore.users[0];
      if (registeredUser) {
        const bookings = inMemoryStore.bookings.filter(b => 
          (String(b.user) === String(registeredUser._id) || (b.rfidCardId && registeredUser.rfidCardId && b.rfidCardId.replace(/[^A-F0-9]/g, '') === registeredUser.rfidCardId.replace(/[^A-F0-9]/g, ''))) &&
          b.paymentStatus === 'PAID'
        );
        activeBooking = bookings.find(b => {
          const start = new Date(b.startTime);
          const end = new Date(b.endTime);
          return now >= start && now <= end;
        });
      }
    }

    // Security Check when turning ON: Must have active slot AND must have scanned RFID card at least once!
    if (relayState) {
      if (!activeBooking) {
        return res.status(400).json({
          success: false,
          message: '❌ No active paid slot found right now! Please book a time slot first.'
        });
      }

      if (activeBooking.relayActivationStatus !== 'ACTIVATED') {
        return res.status(400).json({
          success: false,
          message: '🔒 Security Lock: Please tap your physical RFID Card at the machine scanner first to unlock & start your session!'
        });
      }
    }

    const targetStatus = relayState ? 'RUNNING' : 'PAUSED';

    if (!useInMemory && mongoose.connection.readyState === 1) {
      const updated = await Machine.findOneAndUpdate(
        { machineId: 'HABBITT-M01' },
        { relayState: Boolean(relayState), status: targetStatus },
        { new: true }
      );
      return res.json(updated);
    } else {
      inMemoryStore.machine.relayState = Boolean(relayState);
      inMemoryStore.machine.status = targetStatus;
      return res.json(inMemoryStore.machine);
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`🚀 HABBITT SMART LAUNDRY BACKEND RUNNING ON PORT ${PORT}`);
  console.log(`=======================================================`);
});
