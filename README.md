# Habbitt Smart Laundry — Production Deployment & Uptime Monitoring Guide

Habbitt Smart Laundry is an end-to-end IoT & Web platform featuring a Node.js/Express backend, MongoDB Atlas database, React/Vite web application, and ESP32 RFID hardware controller.

---

## Production Uptime Monitoring & Keep-Alive Setup (Render)

Render free tier web services automatically spin down after 15 minutes of inactivity. To keep your backend responsive for ESP32 hardware and web users **without implementing aggressive backend self-ping loops**, use an external uptime monitoring service.

### 1. Health Check Endpoint Details

- **Endpoint Path**: `GET /api/health`
- **Full Production URL**: `https://<your-backend-name>.onrender.com/api/health`
- **Authentication**: None (Public Endpoint for external monitoring)
- **Database Overhead**: Zero (Pure lightweight timestamp response)
- **Response Format**:
  ```json
  {
    "success": true,
    "status": "OK",
    "timestamp": "2026-08-09T10:48:47.000Z"
  }
  ```

---

### 2. External Keep-Alive Service Setup (Recommended)

Use a free external monitoring service such as **UptimeRobot**, **Cron-job.org**, or **Better Stack**:

1. Create a new HTTP Monitor in your chosen monitoring tool.
2. Set **HTTP Method**: `GET`
3. Set **URL**: `https://<your-backend-service-url>.onrender.com/api/health`
4. Set **Check Interval**: **Every 10 to 14 minutes** (e.g. 10 minutes).
5. Save the monitor.

> [!TIP]
> An external 10-minute check ping maintains 100% backend availability without placing extra load on your Node.js event loop or MongoDB Atlas cluster.

---

## Required Environment Variables

### Backend (`backend/.env`)
- `NODE_ENV`: `production`
- `PORT`: `5000` (Render sets this dynamically)
- `MONGODB_URI`: `mongodb+srv://<username>:<password>@<cluster>.mongodb.net/habbitt_laundry?retryWrites=true&w=majority`
- `JWT_SECRET`: `<strong_production_secret_key>`
- `FRONTEND_URL`: `https://<your-frontend-app>.onrender.com`
- `DEVICE_API_KEY`: `<strong_device_secret_key>`

### Frontend (`frontend/.env`)
- `VITE_API_URL`: `https://<your-backend-service-url>.onrender.com`
