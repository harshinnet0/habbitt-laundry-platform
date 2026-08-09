import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { API_BASE_URL } from '../config/api';
import { Radio, CheckCircle2, XCircle, Zap, ShieldCheck, Loader2, X } from 'lucide-react';

export const RFIDSimulatorModal = ({ isOpen, onClose }) => {
  const { user, token } = useContext(AuthContext);
  const [testCardId, setTestCardId] = useState(user ? user.rfidCardId : 'A3:B4:5C:D6');
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  if (!isOpen) return null;

  const handleSimulateScan = async (cardToScan) => {
    const idToUse = cardToScan || testCardId;
    setLoading(true);
    setScanResult(null);

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE_URL}/api/rfid/scan`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ rfidCardId: idToUse })
      });

      const data = await res.json();
      setScanResult(data);
    } catch (err) {
      setScanResult({
        success: false,
        relayState: false,
        message: 'Could not connect to Habbitt Backend Server (Make sure server is running on port 5000).'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-orange-100 relative animate-in fade-in zoom-in duration-200">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 p-2 rounded-full hover:bg-slate-100 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">ESP32 RFID Tester</h3>
            <p className="text-xs text-slate-500 font-medium">Simulate Hardware Scan Event from Browser</p>
          </div>
        </div>

        {/* Simulator Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
              Enter / Select RFID Card UID
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={testCardId}
                onChange={(e) => setTestCardId(e.target.value)}
                placeholder="e.g. A3:B4:5C:D6"
                className="flex-1 px-4 py-3 border border-slate-200 rounded-xl font-mono text-sm uppercase focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
              <button
                onClick={() => handleSimulateScan(testCardId)}
                disabled={loading}
                className="px-5 py-3 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white font-bold text-sm rounded-xl shadow-orange-glow flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                <span>Scan Now</span>
              </button>
            </div>
          </div>

          {/* Quick Presets */}
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              Quick Test Cards:
            </span>
            <div className="flex flex-wrap gap-2">
              {user && (
                <button
                  onClick={() => {
                    setTestCardId(user.rfidCardId);
                    handleSimulateScan(user.rfidCardId);
                  }}
                  className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-lg text-xs font-mono font-bold flex items-center gap-1"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  My Card ({user.rfidCardId})
                </button>
              )}
              <button
                onClick={() => {
                  setTestCardId('2C:4F:6D:05');
                  handleSimulateScan('2C:4F:6D:05');
                }}
                className="px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-800 rounded-lg text-xs font-mono font-bold"
              >
                Physical Card #1 (2C:4F:6D:05)
              </button>
              <button
                onClick={() => {
                  setTestCardId('B4:91:6E:05');
                  handleSimulateScan('B4:91:6E:05');
                }}
                className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-xs font-mono font-bold"
              >
                Physical Card #2 (B4:91:6E:05)
              </button>
              <button
                onClick={() => {
                  setTestCardId('FF:FF:FF:FF');
                  handleSimulateScan('FF:FF:FF:FF');
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-mono font-medium"
              >
                Invalid Card (FF:FF:FF:FF)
              </button>
            </div>
          </div>

          {/* Result Card */}
          {scanResult && (
            <div className={`p-4 rounded-2xl border transition-all ${
              scanResult.success
                ? 'bg-orange-50/70 border-orange-300 text-slate-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}>
              <div className="flex items-start gap-3">
                {scanResult.success ? (
                  <CheckCircle2 className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="font-bold text-sm">
                    {scanResult.success ? 'ACCESS GRANTED - RELAY ON! ⚡' : 'ACCESS DENIED ⛔'}
                  </h4>
                  <p className="text-xs mt-1 text-slate-600 leading-relaxed">
                    {scanResult.message}
                  </p>

                  {scanResult.success && (
                    <div className="mt-3 pt-3 border-t border-orange-200/60 flex flex-wrap gap-4 text-xs font-semibold text-slate-700">
                      <div>Relay GPIO: <span className="font-mono text-orange-600">GPIO 4 (HIGH)</span></div>
                      <div>Booking: <span className="font-mono text-slate-900">{scanResult.bookingId}</span></div>
                      <div>Time Slot: <span className="text-slate-900">{scanResult.timeSlot}</span></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ESP32 Hardware Info Note */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-1">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <span>ESP32 API Endpoint:</span>
              <span className="font-mono text-orange-600">{API_BASE_URL}/api/rfid/scan</span>
            </div>
            <p className="text-slate-500">
              When physical RFID card is swiped on RC522 reader, ESP32 posts JSON request to this endpoint and triggers Relay ON/OFF automatically.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};
