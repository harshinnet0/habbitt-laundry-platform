import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { API_BASE_URL } from '../config/api';
import { WashingMachine, Power, User, Phone, CheckCircle2, ShieldCheck, Zap, Calendar, CreditCard, Clock, RefreshCw, Building2 } from 'lucide-react';

export const DashboardPage = () => {
  const { user, token, setCurrentView, machineStatus, toggleRelay } = useContext(AuthContext);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const isMachineOn = machineStatus?.relayState || false;

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings/my-history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBookings(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [token]);

  const handleQuickTrialBook = async (duration) => {
    const mins = duration || trialMinutes;
    if (!mins || mins < 1) return;
    setTrialBookingLoading(true);
    setTrialMessage('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ customDurationMinutes: mins })
      });
      const data = await res.json();
      if (res.ok) {
        setTrialMessage(`✅ Time slot booked for ${mins} minute(s)! Touch registered RFID card on reader to activate machine.`);
        fetchBookings();
      } else {
        setTrialMessage(`❌ Failed: ${data.message}`);
      }
    } catch (err) {
      setTrialMessage(`❌ Error: ${err.message}`);
    } finally {
      setTrialBookingLoading(false);
    }
  };

  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    const updateCountdown = () => {
      let targetTime = null;

      if (machineStatus?.slotEndTime) {
        targetTime = new Date(machineStatus.slotEndTime).getTime();
      } else if (bookings && bookings.length > 0) {
        const latestBooking = bookings[0];
        if (latestBooking && latestBooking.endTime) {
          targetTime = new Date(latestBooking.endTime).getTime();
        }
      }

      if (targetTime) {
        const diff = Math.max(0, Math.floor((targetTime - Date.now()) / 1000));
        setRemainingSeconds(diff);
      } else {
        setRemainingSeconds(0);
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [machineStatus, bookings]);

  const formatCountdown = (totalSecs) => {
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return { mm, ss };
  };

  const formatLastHeartbeat = (secondsAgo) => {
    if (secondsAgo === undefined || secondsAgo === null) return 'No heartbeat yet';
    if (secondsAgo <= 2) return 'Just now';
    if (secondsAgo < 60) return `${secondsAgo} seconds ago`;
    const mins = Math.floor(secondsAgo / 60);
    return `${mins} minute${mins > 1 ? 's' : ''} ago`;
  };

  const isOffline = machineStatus?.status === 'OFFLINE' || machineStatus?.isOnline === false;

  return (
    <div className="w-full max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 overflow-x-hidden">
      
      {/* Top Grid: User Profile (Left) & Compact Machine Status Widget (Right) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        
        {/* User Profile Details (Left 2 columns) */}
        <div className="md:col-span-2 bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-soft border border-orange-100 flex flex-col justify-between gap-3 sm:gap-4 overflow-hidden">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center font-extrabold text-lg sm:text-xl shadow-orange-glow shrink-0">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight truncate">
                {user?.name || 'User Profile'}
              </h1>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs font-semibold text-slate-500 mt-0.5">
                <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-orange-600 shrink-0" /> {user?.phone || 'No phone'}</span>
                <span className="text-slate-300 hidden xs:inline">•</span>
                <span className="flex items-center gap-1 font-mono text-[11px] sm:text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200 truncate">
                  <CreditCard className="w-3 h-3 shrink-0" /> Card: {user?.rfidCardId || 'N/A'}
                </span>
                <span className="text-slate-300 hidden xs:inline">•</span>
                <span className="flex items-center gap-1 text-[11px] sm:text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 truncate font-semibold">
                  <Building2 className="w-3 h-3 shrink-0" /> {user?.hostelName || 'Main PG / Hostel'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Account Metrics Grid */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-3 p-2 sm:p-3 bg-orange-50/60 rounded-xl sm:rounded-2xl border border-orange-100/80">
            <div className="flex flex-col items-center justify-center text-center p-1.5 sm:p-2 bg-white rounded-lg sm:rounded-xl shadow-xs border border-orange-100 min-w-0">
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate w-full">Bookings</span>
              <span className="text-sm sm:text-base font-extrabold text-orange-600 mt-0.5">{bookings ? bookings.length : 0}</span>
            </div>

            <div className="flex flex-col items-center justify-center text-center p-1.5 sm:p-2 bg-white rounded-lg sm:rounded-xl shadow-xs border border-orange-100 min-w-0">
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate w-full">Account</span>
              <span className="text-[11px] sm:text-xs font-extrabold text-emerald-600 flex items-center justify-center gap-0.5 sm:gap-1 mt-0.5 sm:mt-1">
                <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" /> Active
              </span>
            </div>

            <div className="flex flex-col items-center justify-center text-center p-1.5 sm:p-2 bg-white rounded-lg sm:rounded-xl shadow-xs border border-orange-100 min-w-0">
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate w-full">RFID Access</span>
              <span className="text-[11px] sm:text-xs font-extrabold text-amber-600 flex items-center justify-center gap-0.5 sm:gap-1 mt-0.5 sm:mt-1">
                <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" /> Tap Ready
              </span>
            </div>
          </div>

          <button
            onClick={() => setCurrentView('book-slot')}
            className="w-full py-3 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white font-extrabold text-sm rounded-2xl shadow-orange-glow flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
          >
            <Calendar className="w-4 h-4" />
            <span>Book Laundry Time Slot</span>
          </button>
        </div>

        {/* Machine Status Card with Smartwatch Display & Real-Time Heartbeat (Right Column) */}
        {(() => {
          const isMySession = machineStatus?.isMySession === true;
          const canControl = machineStatus?.canControl === true;
          const isOccupiedByOther = machineStatus?.status === 'UNAVAILABLE' || (!isMySession && machineStatus?.relayState === true);
          const isMachineOn = machineStatus?.relayState === true || (isMySession && machineStatus?.status === 'RUNNING');

          let badgeText = 'STANDBY';
          let badgeColor = 'bg-slate-100 text-slate-600 border-slate-200';
          let dotColor = 'bg-slate-400';

          if (isOffline) {
            badgeText = 'OFFLINE';
            badgeColor = 'bg-red-100 text-red-700 border-red-200';
            dotColor = 'bg-red-500';
          } else if (isOccupiedByOther) {
            badgeText = 'UNAVAILABLE';
            badgeColor = 'bg-amber-100 text-amber-800 border-amber-200';
            dotColor = 'bg-amber-500';
          } else if (isMachineOn && isMySession) {
            badgeText = 'RUNNING';
            badgeColor = 'bg-orange-100 text-orange-700 border-orange-200';
            dotColor = 'bg-orange-500 animate-ping';
          }

          return (
            <div className={`rounded-3xl p-5 border flex flex-col justify-between gap-3 transition-all duration-300 ${
              isOffline 
                ? 'bg-red-50/50 border-red-200 shadow-soft' 
                : isOccupiedByOther
                ? 'bg-amber-50/40 border-amber-200 shadow-soft'
                : isMachineOn 
                ? 'bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-amber-500/5 border-orange-300 shadow-orange-glow' 
                : 'bg-white border-slate-200 shadow-soft'
            }`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isOffline 
                      ? 'bg-red-100 text-red-600 border border-red-200' 
                      : (isMachineOn && isMySession)
                      ? 'bg-orange-600 text-white shadow-orange-glow' 
                      : 'bg-slate-100 text-slate-400'
                  }`}>
                    <WashingMachine className={`w-5 h-5 ${(isMachineOn && isMySession && !isOffline) ? 'animate-pulse' : ''}`} />
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold text-slate-900 leading-tight">Machine Status</h3>
                    <p className="text-[10px] text-slate-500 font-semibold">
                      Last Heartbeat: <span className={isOffline ? 'text-red-600 font-bold' : 'text-emerald-700 font-bold'}>
                        {formatLastHeartbeat(machineStatus?.lastHeartbeatSecondsAgo)}
                      </span>
                    </p>
                  </div>
                </div>

                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${badgeColor}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
                  {badgeText}
                </span>
              </div>

              {/* Smartwatch Digital OLED Countdown Display (Only for active session owner) */}
              {isMySession && isMachineOn ? (
                <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 shadow-inner flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-orange-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 animate-spin text-orange-500" /> Wash Time Remaining
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">Smartwatch Digital Display</div>
                  </div>

                  <div className="bg-black/90 px-3 py-1.5 rounded-xl border border-orange-500/40 shadow-orange-glow font-mono flex items-center gap-0.5">
                    <span className="text-xl font-black text-orange-500 tracking-tight">
                      {formatCountdown(machineStatus?.remainingSeconds || remainingSeconds).mm}
                    </span>
                    <span className="text-xl font-black text-orange-500 animate-pulse">:</span>
                    <span className="text-xl font-black text-orange-500 tracking-tight">
                      {formatCountdown(machineStatus?.remainingSeconds || remainingSeconds).ss}
                    </span>
                  </div>
                </div>
              ) : isOccupiedByOther ? (
                <div className="bg-amber-950/20 p-3.5 rounded-2xl border border-amber-200/40 text-center">
                  <div className="text-xs font-bold text-amber-800 flex items-center justify-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-600" /> Machine Currently Unavailable
                  </div>
                  <p className="text-[10px] text-amber-700 font-medium mt-0.5">Station is currently in use. Please book an upcoming time slot.</p>
                </div>
              ) : (
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-center">
                  <div className="text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Machine Ready & Standby
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                    {canControl ? 'You have an active booking! Click Manual Turn ON or tap your RFID card.' : 'Book a time slot to access the washing machine.'}
                  </p>
                </div>
              )}

              {isOffline && (
                <div className="p-3 rounded-2xl bg-red-100/80 border border-red-200 text-red-800 text-xs space-y-1 animate-in fade-in duration-200">
                  <div className="font-extrabold flex items-center gap-1 text-red-900">
                    ⚠️ ESP32 is not responding.
                  </div>
                  <p className="text-[10px] text-red-700 font-semibold mt-0.5">Possible reasons:</p>
                  <ul className="text-[10px] text-red-700 list-disc list-inside font-medium space-y-0.5">
                    <li>Power Failure</li>
                    <li>ESP32 Disconnected</li>
                    <li>WiFi Connection Lost</li>
                  </ul>
                </div>
              )}

              {/* Machine Controls: Available strictly for Session Owner or Authorized user */}
              <div>
                {isMySession && isMachineOn ? (
                  <button
                    onClick={() => toggleRelay(false)}
                    className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>Manual Stop</span>
                  </button>
                ) : isOccupiedByOther ? (
                  <div className="w-full py-2 bg-slate-100 text-slate-400 font-extrabold text-xs rounded-xl border border-slate-200 flex items-center justify-center gap-1.5 cursor-not-allowed">
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                    <span>Machine Currently Unavailable</span>
                  </div>
                ) : canControl ? (
                  <button
                    onClick={() => toggleRelay(true)}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5"
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>Manual Turn ON</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setCurrentView('book-slot')}
                    className="w-full py-2 bg-slate-100 hover:bg-orange-50 text-slate-600 hover:text-orange-700 font-extrabold text-xs rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Calendar className="w-3.5 h-3.5 text-orange-600" />
                    <span>Book Time Slot</span>
                  </button>
                )}
              </div>
            </div>
          );
        })()}

      </div>

      {/* Booked Slots History Section (Last 5 Only) */}
      <div className="bg-white rounded-3xl p-5 shadow-soft border border-orange-100 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-orange-600" /> My Booked Slots History <span className="text-xs text-slate-400 font-normal">(Last 5)</span>
          </h2>
          <button
            onClick={fetchBookings}
            className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
            title="Refresh history"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="py-6 text-center text-slate-400 text-xs font-medium">Loading slots...</div>
        ) : bookings.length === 0 ? (
          <div className="py-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-1" />
            <p className="text-slate-600 font-bold text-xs">No active booked slots found</p>
            <button
              onClick={() => setCurrentView('book-slot')}
              className="mt-2 px-4 py-1.5 bg-orange-600 text-white text-xs font-bold rounded-lg shadow-orange-glow hover:bg-orange-700 transition-all inline-flex items-center gap-1"
            >
              <Calendar className="w-3.5 h-3.5" /> Book Slot Now
            </button>
          </div>
        ) : (
          <div>
            {/* Mobile Responsive View: Card List (< sm screens) */}
            <div className="block sm:hidden space-y-3">
              {bookings.slice(0, 5).map((item) => (
                <div 
                  key={item._id || item.bookingId} 
                  className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-extrabold text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-xs">
                      {item.bookingId}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200">
                      <CheckCircle2 className="w-3 h-3 text-orange-600" /> PAID / READY
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-orange-600" /> {item.date}
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium pl-4">{item.timeSlot}</div>
                    </div>

                    <span className="font-mono text-[11px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200 flex-shrink-0">
                      {item.rfidCardId}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop / Tablet View: Full Table (>= sm screens) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    <th className="py-2 px-3">Booking ID</th>
                    <th className="py-2 px-3">Date & Slot</th>
                    <th className="py-2 px-3">RFID Card</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {bookings.slice(0, 5).map((item) => (
                    <tr key={item._id || item.bookingId} className="hover:bg-orange-50/40 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {item.bookingId}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">{item.date}</div>
                        <div className="text-[11px] text-slate-500 font-normal">{item.timeSlot}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono text-[11px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">
                          {item.rfidCardId}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200">
                          <CheckCircle2 className="w-3 h-3 text-orange-600" /> PAID / READY
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
