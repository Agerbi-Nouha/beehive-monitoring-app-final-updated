# Beehive Monitoring App

IoT beehive monitoring system using ESP32, sensors, MongoDB, Express, React, Tailwind, Recharts, and Socket.IO.

## Features
- Live + simulated hive monitoring
- History grouped into environmental conditions, hive status, sound activity, status indicators, and hive events
- Smart sound alerts with thresholds and sustained anomaly logic
- Admin/viewer authentication
- Device API keys for ESP32 ingestion
- CSV/PDF export
- Global floating chatbot

## Run locally

### Backend
```powershell
cd backend
copy .env.example .env
npm install
npm run dev
```

### Frontend
```powershell
cd frontend
copy .env.example .env
npm install
npm run dev
```

## Default admin
- Email: `admin@local.dev`
- Password: `admin1234`

## ESP32 ingestion
Create a device key from **Admin → Device Keys** and send JSON to:

`POST /api/sensors`

Header:

`x-api-key: <YOUR_DEVICE_KEY>`

Minimal example:

```json
{
  "rain": 1
}
```

The backend fills missing fields from the previous measurement/default values so single-sensor testing is easier.


Developed by:
- Agerbi Nouha
- Yahyaoui Soulaima
