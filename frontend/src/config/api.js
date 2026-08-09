// Centralized API Base URL configuration for Habbitt Smart Laundry
// Reads VITE_API_URL from environment variables in production, defaulting to http://localhost:5000 for local development.
export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
