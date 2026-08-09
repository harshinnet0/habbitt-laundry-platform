import React, { createContext, useState, useEffect } from 'react';
import { API_BASE_URL } from '../config/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('habbitt_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [token, setToken] = useState(() => localStorage.getItem('habbitt_token') || null);
  const [currentView, setCurrentView] = useState(() => user ? 'dashboard' : 'login');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [lastCreatedBooking, setLastCreatedBooking] = useState(null);
  const [viewingReceipt, setViewingReceipt] = useState(null);
  const [machineStatus, setMachineStatus] = useState({
    machineId: 'HABBITT-M01',
    name: 'Habbitt Ultra Wash X1',
    relayState: false,
    status: 'IDLE',
    lastCardScanned: null,
    lastScanStatus: null
  });

  // Save to localStorage
  useEffect(() => {
    if (user && token) {
      localStorage.setItem('habbitt_user', JSON.stringify(user));
      localStorage.setItem('habbitt_token', token);
    } else {
      localStorage.removeItem('habbitt_user');
      localStorage.removeItem('habbitt_token');
    }
  }, [user, token]);

  // Poll Machine Status every 3 seconds
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/machine/status`);
        if (res.ok) {
          const data = await res.json();
          setMachineStatus(data);
        }
      } catch (err) {
        // Silently ignore if backend offline
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  // Silent Backend Keep-Alive Service (Fires GET /api/health every 5 minutes to prevent Render sleep)
  useEffect(() => {
    const pingHealth = async () => {
      try {
        await fetch(`${API_BASE_URL}/api/health`);
      } catch (e) {
        // Silently ignore errors and retry on next interval
      }
    };

    pingHealth();
    const keepAliveInterval = setInterval(pingHealth, 300000); // 5 minutes

    return () => clearInterval(keepAliveInterval);
  }, []);

  const login = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
    setCurrentView('dashboard');
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setCurrentView('login');
  };

  const toggleRelay = async (targetState) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/machine/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ relayState: Boolean(targetState) })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || 'Failed to toggle relay');
        return { success: false, message: data.message };
      }
      setMachineStatus(data);
      return data;
    } catch (err) {
      console.error('Failed to toggle relay:', err);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      setUser,
      token,
      login,
      logout,
      currentView,
      setCurrentView,
      selectedSlot,
      setSelectedSlot,
      lastCreatedBooking,
      setLastCreatedBooking,
      viewingReceipt,
      setViewingReceipt,
      machineStatus,
      setMachineStatus,
      toggleRelay
    }}>
      {children}
    </AuthContext.Provider>
  );
};
