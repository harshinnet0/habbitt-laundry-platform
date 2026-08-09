import React, { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { WashingMachine, LogOut, CreditCard } from 'lucide-react';

export const Navbar = () => {
  const { user, logout, setCurrentView } = useContext(AuthContext);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-orange-100 shadow-soft w-full overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
        
        {/* Brand Logo */}
        <div 
          onClick={() => user ? setCurrentView('dashboard') : setCurrentView('login')}
          className="flex items-center gap-2 sm:gap-3 cursor-pointer group shrink-0"
        >
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white shadow-orange-glow group-hover:scale-105 transition-transform duration-300">
            <WashingMachine className="w-5 h-5 sm:w-7 sm:h-7" />
          </div>
          <div>
            <div className="flex items-center gap-1 sm:gap-1.5">
              <span className="font-extrabold text-base sm:text-xl tracking-tight text-slate-900">Habbitt</span>
              <span className="text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 uppercase tracking-wider">Smart IoT</span>
            </div>
            <p className="hidden sm:block text-xs text-slate-500 font-medium">Automated RFID Laundry Station</p>
          </div>
        </div>

        {/* User Profile & Logout */}
        {user ? (
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden sm:block text-right">
              <div className="text-sm font-bold text-slate-900">{user.name}</div>
              <div className="text-xs font-mono font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded inline-flex items-center gap-1">
                <CreditCard className="w-3 h-3" />
                {user.rfidCardId}
              </div>
            </div>

            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-xs sm:text-sm border border-orange-200">
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>

            <button
              onClick={logout}
              title="Logout"
              className="p-1.5 sm:p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg sm:rounded-xl transition-all"
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <button
              onClick={() => setCurrentView('login')}
              className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold text-slate-700 hover:text-orange-600 transition-colors"
            >
              Log In
            </button>
            <button
              onClick={() => setCurrentView('register')}
              className="px-3 sm:px-5 py-1.5 sm:py-2.5 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 rounded-lg sm:rounded-xl shadow-orange-glow transition-all whitespace-nowrap"
            >
              Create Account
            </button>
          </div>
        )}

      </div>
    </header>
  );
};
