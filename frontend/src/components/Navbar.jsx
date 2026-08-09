import React, { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { WashingMachine, LogOut, CreditCard } from 'lucide-react';

export const Navbar = () => {
  const { user, logout, setCurrentView } = useContext(AuthContext);

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-orange-100 shadow-soft">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        {/* Brand Logo */}
        <div 
          onClick={() => user ? setCurrentView('dashboard') : setCurrentView('login')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white shadow-orange-glow group-hover:scale-105 transition-transform duration-300">
            <WashingMachine className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xl tracking-tight text-slate-900">Habbitt</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 uppercase tracking-wider">Smart IoT</span>
            </div>
            <p className="text-xs text-slate-500 font-medium">Automated RFID Laundry Station</p>
          </div>
        </div>

        {/* User Profile & Logout */}
        {user ? (
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <div className="text-sm font-bold text-slate-900">{user.name}</div>
              <div className="text-xs font-mono font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded inline-flex items-center gap-1">
                <CreditCard className="w-3 h-3" />
                {user.rfidCardId}
              </div>
            </div>

            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-sm border border-orange-200">
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>

            <button
              onClick={logout}
              title="Logout"
              className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all ml-1"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentView('login')}
              className="px-4 py-2 text-sm font-bold text-slate-700 hover:text-orange-600 transition-colors"
            >
              Log In
            </button>
            <button
              onClick={() => setCurrentView('register')}
              className="px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 rounded-xl shadow-orange-glow transition-all"
            >
              Create Account
            </button>
          </div>
        )}

      </div>
    </header>
  );
};
