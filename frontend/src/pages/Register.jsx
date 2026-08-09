import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { API_BASE_URL } from '../config/api';
import { WashingMachine, User, Mail, Phone, Lock, CreditCard, ArrowRight, ShieldCheck } from 'lucide-react';

export const RegisterPage = () => {
  const { login, setCurrentView } = useContext(AuthContext);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    rfidCardId: 'A3:B4:5C:D6'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      login(data.user, data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-4 sm:p-6 bg-slate-50">
      <div className="bg-white rounded-3xl max-w-xl w-full p-8 sm:p-10 shadow-soft border border-orange-100">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white mx-auto flex items-center justify-center shadow-orange-glow mb-3">
            <WashingMachine className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Create Habbitt Account</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Register your details & link your RFID Card UID</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Full Name</label>
            <div className="relative">
              <User className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Harsh Kumar"
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Email & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="harsh@example.com"
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Phone Number</label>
              <div className="relative">
                <Phone className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="9876543210"
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all"
                />
              </div>
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* RFID Card UID */}
          <div className="p-4 bg-orange-50/70 border border-orange-200 rounded-2xl">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-extrabold text-orange-900 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-orange-600" /> RFID Card UID / Tag ID
              </label>
              <span className="text-[10px] font-bold bg-orange-200 text-orange-800 px-2 py-0.5 rounded">REQUIRED</span>
            </div>

            <input
              type="text"
              required
              value={formData.rfidCardId}
              onChange={(e) => setFormData({ ...formData, rfidCardId: e.target.value })}
              placeholder="e.g. A3:B4:5C:D6"
              className="w-full px-4 py-3 bg-white border border-orange-300 rounded-xl text-sm font-mono font-bold text-orange-900 uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
            />

            <div className="mt-3 flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-500 font-medium">Quick Presets:</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, rfidCardId: 'A3:B4:5C:D6' })}
                  className="px-2.5 py-1 bg-white hover:bg-orange-100 text-orange-700 rounded border border-orange-200 font-mono text-[11px] font-bold"
                >
                  A3:B4:5C:D6
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, rfidCardId: '14:A2:9B:04' })}
                  className="px-2.5 py-1 bg-white hover:bg-orange-100 text-orange-700 rounded border border-orange-200 font-mono text-[11px] font-bold"
                >
                  14:A2:9B:04
                </button>
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white font-extrabold text-sm rounded-2xl shadow-orange-glow flex items-center justify-center gap-2 transition-all mt-6 disabled:opacity-50"
          >
            <span>{loading ? 'Creating Account...' : 'Create Account & Continue'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Login redirect */}
        <div className="text-center mt-6 pt-6 border-t border-slate-100">
          <p className="text-xs text-slate-500 font-medium">
            Already have an account?{' '}
            <button
              onClick={() => setCurrentView('login')}
              className="font-bold text-orange-600 hover:underline"
            >
              Sign In Here
            </button>
          </p>
        </div>

      </div>
    </div>
  );
};
