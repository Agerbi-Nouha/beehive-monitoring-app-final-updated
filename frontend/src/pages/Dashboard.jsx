import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { Link } from 'react-router-dom';

function Dashboard() {
  const [hives, setHives] = useState([]);
  const [activeEvents, setActiveEvents] = useState([]);

  useEffect(() => {
    async function fetchData() {
      const [hRes, eRes] = await Promise.all([axios.get('/api/hives'), axios.get('/api/events?status=Active')]);
      setHives(hRes.data);
      setActiveEvents(eRes.data);
    }
    fetchData();

    const socket = io(); // use Vite proxy (/socket.io)
    socket.on('sensor_update', () => fetchData());
    return () => socket.disconnect();
  }, []);

  const total = hives.length;
  const live = hives.filter((h) => h.status === 'LIVE').length;
  const simulated = hives.filter((h) => h.status === 'SIMULATED').length;
  const offline = hives.filter((h) => h.status === 'OFFLINE').length;
  const avgHealth = hives.length ? Math.round(hives.reduce((sum, h) => sum + (h.health || 0), 0) / hives.length) : 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="text-sm text-muted">Overview of hive health and alerts.</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KPI title="Total" value={total} />
        <KPI title="Live" value={live} />
        <KPI title="Simulated" value={simulated} />
        <KPI title="Offline" value={offline} />
        <KPI title="Avg Health" value={`${avgHealth}%`} />
        <KPI title="Active Alerts" value={activeEvents.length} />
      </div>

      <div>
        <div className="flex items-end justify-between mb-2">
          <h2 className="text-lg font-semibold">Hives</h2>
          <Link to="/hives" className="text-sm text-accent hover:underline">
            View all
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {hives.map((hive) => (
            <HiveCard key={hive.hiveId} hive={hive} />
          ))}
        </div>
      </div>
    </div>
  );
}

function KPI({ title, value }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-muted">{title}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

function statusBadge(status) {
  if (status === 'LIVE') return 'bg-ok text-white';
  if (status === 'SIMULATED') return 'bg-simulated text-white';
  return 'bg-offline text-white';
}

function HiveCard({ hive }) {
  return (
    <Link to={`/hives/${hive.hiveId}`} className="card p-4 hover:shadow-soft transition-shadow">
      <div className="flex justify-between items-center mb-2">
        <div>
          <div className="font-semibold">{hive.name || hive.hiveId}</div>
          <div className="text-xs text-muted">{hive.hiveId}</div>
        </div>
        <span className={`badge ${statusBadge(hive.status)}`}>{hive.status}</span>
      </div>

      <div className="text-sm">
        Health: <span className="font-semibold">{hive.health ?? 0}%</span>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3 text-sm text-muted">
        <div>Temp: <span className="text-text">{hive.values.temperature ?? '—'}°C</span></div>
        <div>Hum: <span className="text-text">{hive.values.humidity ?? '—'}%</span></div>
        <div>Weight: <span className="text-text">{hive.values.weight ?? '—'}kg</span></div>
        <div>Battery: <span className="text-text">{hive.values.battery ?? '—'}%</span></div>
      </div>
    </Link>
  );
}

export default Dashboard;
