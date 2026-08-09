import React, { useState, useContext } from 'react';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { RegisterPage } from './pages/Register';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { SlotBookingPage } from './pages/SlotBooking';
import { PaymentPage } from './pages/Payment';
import { ReceiptModal } from './components/ReceiptModal';
import { RFIDSimulatorModal } from './components/RFIDSimulatorModal';

function MainApp() {
  const { currentView, user, viewingReceipt, setViewingReceipt } = useContext(AuthContext);
  const [isRfidSimulatorOpen, setIsRfidSimulatorOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-orange-500 selection:text-white">
      
      {/* Top Navigation */}
      <Navbar onOpenRfidSimulator={() => setIsRfidSimulatorOpen(true)} />

      {/* Main Content Router */}
      <main className="flex-1">
        {currentView === 'login' && <LoginPage />}
        {currentView === 'register' && <RegisterPage />}
        {currentView === 'dashboard' && <DashboardPage onOpenRfidSimulator={() => setIsRfidSimulatorOpen(true)} />}
        {currentView === 'book-slot' && <SlotBookingPage />}
        {currentView === 'payment' && <PaymentPage />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-orange-100 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-medium">© 2026 Habbitt Smart Laundry Systems. All rights reserved.</p>
          <div className="flex items-center gap-4 text-slate-600 font-bold">
            <span>ESP32 + RC522 RFID Hub</span>
            <span>•</span>
            <span>Relay GPIO 4</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      {viewingReceipt && (
        <ReceiptModal
          booking={viewingReceipt}
          onClose={() => setViewingReceipt(null)}
        />
      )}

      <RFIDSimulatorModal
        isOpen={isRfidSimulatorOpen}
        onClose={() => setIsRfidSimulatorOpen(false)}
      />

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
