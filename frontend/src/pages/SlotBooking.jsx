import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { API_BASE_URL } from '../config/api';
import { Calendar, Clock, ArrowRight, CheckCircle2, AlertCircle, WashingMachine, ChevronLeft, CreditCard, Zap } from 'lucide-react';

export const SlotBookingPage = () => {
  const { user, token, setSelectedSlot, setCurrentView } = useContext(AuthContext);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pickedSlot, setPickedSlot] = useState(null);

  const fetchSlots = async (dateStr) => {
    setLoading(true);
    setPickedSlot(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/slots/available?date=${dateStr}`);
      if (res.ok) {
        const data = await res.json();
        setSlots(data.slots);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlots(selectedDate);
  }, [selectedDate]);

  const handleProceedToPayment = () => {
    if (!pickedSlot) return;
    setSelectedSlot({
      date: selectedDate,
      timeSlot: pickedSlot.timeSlot,
      price: pickedSlot.price || 60
    });
    setCurrentView('payment');
  };

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
        body: JSON.stringify({
          customDurationMinutes: mins
        })
      });
      const data = await res.json();
      if (res.ok) {
        setTrialMessage(`✅ Trial slot booked for ${mins} minute(s)! Touch RFID card on reader to test.`);
      } else {
        setTrialMessage(`❌ Failed: ${data.message}`);
      }
    } catch (err) {
      setTrialMessage(`❌ Error: ${err.message}`);
    } finally {
      setTrialBookingLoading(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6 overflow-x-hidden">
      
      {/* Back Button */}
      <button
        onClick={() => setCurrentView('dashboard')}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-orange-600 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Back to Dashboard
      </button>

      {/* Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-soft border border-orange-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1 text-xs font-extrabold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-md mb-2">
            <WashingMachine className="w-3.5 h-3.5" /> Habbitt Machine #1 Slot Scheduler
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Book Laundry Time Slot
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-0.5">
            Select an available 1-hour slot for your RFID Card <span className="font-mono font-bold text-orange-600">({user?.rfidCardId})</span>
          </p>
        </div>

        {/* Date Selection Control */}
        <div className="bg-slate-50 p-2 rounded-2xl border border-slate-200 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-orange-600 ml-2" />
          <input
            type="date"
            value={selectedDate}
            min={new Date().toISOString().split('T')[0]}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-transparent font-bold text-sm text-slate-800 focus:outline-none pr-2 cursor-pointer"
          />
        </div>
      </div>

      {/* Slot Grid */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-soft border border-orange-100 space-y-6">
        
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-600" /> Available Time Slots for {selectedDate}
          </h2>
          <span className="text-xs font-semibold text-slate-400">Fixed Rate: ₹60 / Slot</span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 font-medium">Checking slot availability...</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {slots.map((item, idx) => {
              const isSelected = pickedSlot && pickedSlot.timeSlot === item.timeSlot;
              const isAvailable = item.isAvailable;

              return (
                <button
                  key={idx}
                  disabled={!isAvailable}
                  onClick={() => setPickedSlot(item)}
                  className={`py-2.5 px-3 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                    !isAvailable
                      ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                      : isSelected
                      ? 'bg-orange-50 border-orange-500 shadow-orange-glow ring-2 ring-orange-500 text-slate-900'
                      : 'bg-white hover:bg-orange-50/50 border-slate-200 hover:border-orange-300 text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between w-full gap-1">
                    <span className="font-extrabold text-xs font-sans tracking-tight truncate">
                      {item.timeSlot}
                    </span>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-orange-600 flex-shrink-0" />
                    )}
                  </div>

                  <div className="flex items-center justify-between w-full pt-1.5 mt-1.5 border-t border-slate-100 text-[11px]">
                    <span className="font-bold text-slate-600">₹{item.price}</span>
                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase ${
                      isAvailable 
                        ? 'bg-orange-100 text-orange-700' 
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      {isAvailable ? 'AVAILABLE' : 'BOOKED'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

      </div>



      {/* Sticky Bottom Bar for Action */}
      {pickedSlot && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 max-w-xl w-[90%] bg-slate-900 text-white rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-4 z-40 border border-slate-800 animate-in slide-in-from-bottom duration-200">
          <div>
            <div className="text-xs text-orange-400 font-bold uppercase tracking-wider">Selected Slot</div>
            <div className="text-sm font-extrabold text-white">{pickedSlot.timeSlot}</div>
          </div>
          <button
            onClick={handleProceedToPayment}
            className="px-6 py-3 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white font-extrabold text-sm rounded-xl shadow-orange-glow flex items-center gap-2 transition-all"
          >
            <span>Proceed to Payment (₹60)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

    </div>
  );
};
