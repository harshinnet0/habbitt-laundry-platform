import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { API_BASE_URL } from '../config/api';
import { QrCode, CreditCard, Banknote, ShieldCheck, CheckCircle2, Loader2, ArrowRight, ChevronLeft, WashingMachine } from 'lucide-react';
import confetti from 'canvas-confetti';

export const PaymentPage = () => {
  const { user, token, selectedSlot, setLastCreatedBooking, setViewingReceipt, setCurrentView } = useContext(AuthContext);
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!selectedSlot) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-3xl text-center space-y-4">
        <p className="text-slate-600 font-bold">No slot selected.</p>
        <button
          onClick={() => setCurrentView('book-slot')}
          className="px-5 py-2.5 bg-orange-600 text-white rounded-xl font-bold text-xs"
        >
          Select Time Slot
        </button>
      </div>
    );
  }

  const handlePayNow = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          date: selectedSlot.date,
          timeSlot: selectedSlot.timeSlot,
          paymentMethod: paymentMethod === 'UPI' ? 'UPI / QR Code' : paymentMethod === 'CARD' ? 'Credit/Debit Card' : 'Cash at Station'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Payment processing failed');

      // Trigger Confetti Celebration!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      setLastCreatedBooking(data.booking);
      setViewingReceipt(data.booking);
      setCurrentView('dashboard');

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      <button
        onClick={() => setCurrentView('book-slot')}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-orange-600 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Change Time Slot
      </button>

      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-soft border border-orange-100 space-y-6">
        
        {/* Header */}
        <div className="border-b border-slate-100 pb-6">
          <div className="inline-flex items-center gap-1 text-xs font-extrabold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-md mb-2">
            <ShieldCheck className="w-3.5 h-3.5" /> 256-Bit Encrypted Secure Payment
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Complete Payment & Book Slot</h1>
          <p className="text-xs text-slate-500 font-medium">Habbitt Smart Laundry Machine #01</p>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
            ⚠️ {error}
          </div>
        )}

        {/* Booking Summary Box */}
        <div className="bg-orange-50/70 p-5 rounded-2xl border border-orange-200 space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500 font-semibold">Date & Time Slot:</span>
            <span className="font-bold text-slate-900">{selectedSlot.date} ({selectedSlot.timeSlot})</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500 font-semibold">Linked RFID Card:</span>
            <span className="font-mono font-bold text-orange-700 bg-white px-2 py-0.5 rounded border border-orange-200">
              {user?.rfidCardId}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500 font-semibold">Base Price:</span>
            <span className="font-semibold text-slate-900">₹60.00</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500 font-semibold">Platform Fee & Taxes:</span>
            <span className="font-semibold text-slate-900">₹0.00 (Waived)</span>
          </div>
          <div className="pt-3 border-t border-orange-200 flex justify-between items-center">
            <span className="font-extrabold text-slate-900 text-sm">Total Payable Amount:</span>
            <span className="text-2xl font-extrabold text-orange-600">₹60.00</span>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Select Payment Method</label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            
            {/* UPI QR */}
            <button
              type="button"
              onClick={() => setPaymentMethod('UPI')}
              className={`p-4 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-2 ${
                paymentMethod === 'UPI'
                  ? 'bg-orange-50 border-orange-500 shadow-orange-glow ring-2 ring-orange-500 text-slate-900'
                  : 'bg-white border-slate-200 hover:border-orange-300 text-slate-700'
              }`}
            >
              <QrCode className="w-6 h-6 text-orange-600" />
              <span className="text-xs font-bold">UPI / QR Code</span>
            </button>

            {/* Card */}
            <button
              type="button"
              onClick={() => setPaymentMethod('CARD')}
              className={`p-4 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-2 ${
                paymentMethod === 'CARD'
                  ? 'bg-orange-50 border-orange-500 shadow-orange-glow ring-2 ring-orange-500 text-slate-900'
                  : 'bg-white border-slate-200 hover:border-orange-300 text-slate-700'
              }`}
            >
              <CreditCard className="w-6 h-6 text-orange-600" />
              <span className="text-xs font-bold">Credit / Debit Card</span>
            </button>

            {/* Cash */}
            <button
              type="button"
              onClick={() => setPaymentMethod('CASH')}
              className={`p-4 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-2 ${
                paymentMethod === 'CASH'
                  ? 'bg-orange-50 border-orange-500 shadow-orange-glow ring-2 ring-orange-500 text-slate-900'
                  : 'bg-white border-slate-200 hover:border-orange-300 text-slate-700'
              }`}
            >
              <Banknote className="w-6 h-6 text-orange-600" />
              <span className="text-xs font-bold">Cash at Counter</span>
            </button>

          </div>
        </div>

        {/* UPI QR Display Preview */}
        {paymentMethod === 'UPI' && (
          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-3">
            <div className="w-40 h-40 bg-white p-3 rounded-2xl border border-slate-200 mx-auto shadow-soft flex items-center justify-center">
              {/* Dynamic SVG QR */}
              <svg viewBox="0 0 100 100" className="w-full h-full text-slate-900">
                <rect width="100" height="100" fill="#ffffff" />
                <rect x="10" y="10" width="30" height="30" fill="#000000" />
                <rect x="15" y="15" width="20" height="20" fill="#ffffff" />
                <rect x="20" y="20" width="10" height="10" fill="#000000" />

                <rect x="60" y="10" width="30" height="30" fill="#000000" />
                <rect x="65" y="15" width="20" height="20" fill="#ffffff" />
                <rect x="70" y="20" width="10" height="10" fill="#000000" />

                <rect x="10" y="60" width="30" height="30" fill="#000000" />
                <rect x="15" y="65" width="20" height="20" fill="#ffffff" />
                <rect x="20" y="70" width="10" height="10" fill="#000000" />

                <rect x="50" y="50" width="12" height="12" fill="#FF6B00" />
                <rect x="70" y="50" width="15" height="15" fill="#000000" />
                <rect x="50" y="70" width="15" height="15" fill="#000000" />
              </svg>
            </div>
            <p className="text-xs text-slate-500 font-medium">Scan using Google Pay, PhonePe, Paytm or BHIM UPI</p>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handlePayNow}
          disabled={loading}
          className="w-full py-4 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white font-extrabold text-sm rounded-2xl shadow-orange-glow flex items-center justify-center gap-2 transition-all disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Processing Payment & Issuing Receipt...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              <span>Pay ₹60.00 & Generate Receipt</span>
            </>
          )}
        </button>

      </div>
    </div>
  );
};
